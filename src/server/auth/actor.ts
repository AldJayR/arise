import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  type Database,
  getDatabase,
  type RlsContext,
  type RlsTransaction,
  withRlsContext,
} from "@/db/client";
import {
  employees,
  roles as identityRoles,
  persons,
  students,
  userAccounts,
  userRoles,
} from "@/db/schema";
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
  rls: RlsContext;
};

const actorIdSchema = z.uuid();

export function getDevelopmentActorId(request: Request) {
  if (process.env.NODE_ENV === "production") {
    throw unauthorized("Development actor headers are disabled in production");
  }

  const result = actorIdSchema.safeParse(
    request.headers.get("x-arise-actor-id"),
  );

  if (!result.success) {
    throw unauthorized("A valid x-arise-actor-id header is required");
  }

  return result.data;
}

export async function resolveActor(
  request: Request,
  database: Database = getDatabase(),
): Promise<Actor> {
  const userAccountId = getDevelopmentActorId(request);
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
    .where(eq(userAccounts.id, userAccountId))
    .limit(1);

  if (!identity) {
    throw unauthorized("The development actor is invalid or inactive");
  }

  if (
    identity.accountStatus !== "active" ||
    identity.personStatus !== "active" ||
    (identity.studentId && identity.studentStatus !== "active") ||
    (identity.employeeId && identity.employeeStatus !== "active")
  ) {
    throw unauthorized("The development actor is invalid or inactive");
  }

  const roleRows = await database
    .select({ code: identityRoles.code })
    .from(userRoles)
    .innerJoin(identityRoles, eq(identityRoles.id, userRoles.roleId))
    .where(eq(userRoles.userAccountId, userAccountId));

  if (roleRows.length === 0) {
    throw unauthorized("The development actor has no assigned role");
  }

  const roles = roleRows.map((role) => role.code);
  return {
    userAccountId: identity.userAccountId,
    personId: identity.personId,
    studentId: identity.studentId ?? undefined,
    employeeId: identity.employeeId ?? undefined,
    roles,
    rls: {
      userAccountId: identity.userAccountId,
      personId: identity.personId,
      studentId: identity.studentId ?? undefined,
      employeeId: identity.employeeId ?? undefined,
    },
  };
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
  const actor = await resolveActor(request, resolvedDatabase);

  return withRlsContext(resolvedDatabase, actor.rls, (transaction) =>
    work(transaction, actor),
  );
}
