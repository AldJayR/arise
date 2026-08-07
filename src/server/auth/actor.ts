import { eq } from "drizzle-orm";
import {
  type Database,
  type DatabaseRole,
  getDatabase,
  withAuthBootstrap,
  type RlsContext,
  type RlsTransaction,
  withRlsContext,
} from "@/db/client";
import {
  employees,
  permissions,
  roles as identityRoles,
  persons,
  rolePermissions,
  students,
  userAccounts,
  userRoles,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { forbidden, unauthorized } from "@/server/http/errors";

export type ActorRole =
  | "student"
  | "faculty"
  | "counselor"
  | "registrar"
  | "dean"
  | "service"
  | "auditor"
  | "admin";

export type Actor = {
  userAccountId: string;
  personId: string;
  studentId?: string;
  employeeId?: string;
  roles: string[];
  permissions: string[];
  rls: RlsContext;
};

type AuthSession = {
  user: {
    id: string;
    emailVerified: boolean;
  };
};

export type SessionProvider = {
  getSession: (options: { headers: Headers }) => Promise<AuthSession | null>;
};

const defaultSessionProvider: SessionProvider = {
  getSession: ({ headers }) =>
    auth.api.getSession({ headers }) as Promise<AuthSession | null>,
};

const databaseRoleByPortalRole: ReadonlyArray<readonly [string, DatabaseRole]> = [
  ["admin", "arise_app_admin"],
  ["registrar", "arise_app_registrar"],
  ["dean", "arise_app_dean"],
  ["auditor", "arise_app_auditor"],
  ["counselor", "arise_app_counselor"],
  ["faculty", "arise_app_faculty"],
  ["student", "arise_app_user"],
];

export function selectDatabaseRole(roles: string[]): DatabaseRole {
  for (const [role, databaseRole] of databaseRoleByPortalRole) {
    if (roles.includes(role)) {
      return databaseRole;
    }
  }

  throw unauthorized("The actor has no supported database role");
}

function isInactiveIdentity(identity: {
  accountStatus: string;
  personStatus: string;
  studentId: string | null;
  studentStatus: string | null;
  employeeId: string | null;
  employeeStatus: string | null;
}) {
  return (
    identity.accountStatus !== "active" ||
    identity.personStatus !== "active" ||
    (identity.studentId !== null && identity.studentStatus !== "active") ||
    (identity.employeeId !== null && identity.employeeStatus !== "active")
  );
}

async function loadActorByAuthenticationSubject(
  database: Database | RlsTransaction,
  authenticationSubject: string,
): Promise<Actor> {
  const [identity] = await database
    .select({
      userAccountId: userAccounts.id,
      personId: persons.id,
      accountStatus: userAccounts.status,
      personStatus: persons.status,
      studentId: students.id,
      studentStatus: students.status,
      employeeId: employees.id,
      employeeStatus: employees.status,
    })
    .from(userAccounts)
    .innerJoin(persons, eq(persons.id, userAccounts.personId))
    .leftJoin(students, eq(students.personId, persons.id))
    .leftJoin(employees, eq(employees.personId, persons.id))
    .where(eq(userAccounts.authenticationSubject, authenticationSubject))
    .limit(1);

  if (!identity || isInactiveIdentity(identity)) {
    throw unauthorized("The authenticated identity is invalid or inactive");
  }

  const roleRows = await database
    .select({
      roleCode: identityRoles.code,
      permissionCode: permissions.code,
    })
    .from(userRoles)
    .innerJoin(identityRoles, eq(identityRoles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, identityRoles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(userRoles.userAccountId, identity.userAccountId));

  const roles = [
    ...new Set(roleRows.map((row) => row.roleCode)),
  ];
  if (roles.length === 0) {
    throw unauthorized("The authenticated identity has no assigned role");
  }

  const permissionsList = [
    ...new Set(
      roleRows.flatMap((row) =>
        row.permissionCode ? [row.permissionCode] : [],
      ),
    ),
  ];
  const databaseRole = selectDatabaseRole(roles);

  return {
    userAccountId: identity.userAccountId,
    personId: identity.personId,
    studentId: identity.studentId ?? undefined,
    employeeId: identity.employeeId ?? undefined,
    roles,
    permissions: permissionsList,
    rls: {
      userAccountId: identity.userAccountId,
      databaseRole,
      personId: identity.personId,
      studentId: identity.studentId ?? undefined,
      employeeId: identity.employeeId ?? undefined,
    },
  };
}

export async function resolveAuthenticatedActor(
  request: Request,
  database?: Database,
  sessionProvider: SessionProvider = defaultSessionProvider,
): Promise<Actor> {
  const session = await sessionProvider.getSession({
    headers: request.headers,
  });

  if (!session || !session.user.id || !session.user.emailVerified) {
    throw unauthorized("A verified Better Auth session is required");
  }

  return withAuthBootstrap(database ?? getDatabase(), (transaction) =>
    loadActorByAuthenticationSubject(transaction, session.user.id),
  );
}

export function requireActorRole(actor: Actor, role: ActorRole) {
  if (!actor.roles.includes(role)) {
    throw forbidden(`The ${role} role is required for this action`);
  }
}

export async function withActorTransaction<T>(
  request: Request,
  work: (transaction: RlsTransaction, actor: Actor) => Promise<T>,
  database?: Database,
) {
  const resolvedDatabase = database ?? getDatabase();
  const actor = await resolveAuthenticatedActor(request, resolvedDatabase);

  return withRlsContext(resolvedDatabase, actor.rls, (transaction) =>
    work(transaction, actor),
  );
}
