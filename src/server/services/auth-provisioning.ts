import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { RlsTransaction } from "@/db/client";
import {
  employees,
  persons,
  roles,
  students,
  userAccounts,
  userRoles,
} from "@/db/schema/identity";
import { auth } from "@/lib/auth";
import type { Actor } from "@/server/auth/actor";
import { conflict, notFound } from "@/server/http/errors";
import { recordAuditEvent } from "@/server/services/audit";
import type { AuthUserProvisioningInput } from "@/server/validation/auth";

export type AuthProvisioningApi = Pick<
  typeof auth.api,
  "createUser" | "requestPasswordReset" | "sendVerificationEmail"
>;

type AuthEmailApi = {
  requestPasswordReset: (input: {
    body: { email: string; redirectTo: string };
  }) => Promise<unknown>;
  sendVerificationEmail: (input: {
    body: { email: string; callbackURL: string };
  }) => Promise<unknown>;
};

const defaultAuthEmailApi: AuthEmailApi = {
  requestPasswordReset: (input) => auth.api.requestPasswordReset(input),
  sendVerificationEmail: (input) => auth.api.sendVerificationEmail(input),
};

type ProvisionableIdentity = {
  personId: string;
  personStatus: string;
  displayName: string;
  institutionalEmail: string | null;
  studentId: string | null;
  studentStatus: string | null;
  employeeId: string | null;
  employeeStatus: string | null;
};

type ProvisionedAuthUser = {
  email: string;
  roleProfile: AuthUserProvisioningInput["roleProfile"];
};

function createUnusablePassword() {
  return randomBytes(32).toString("base64url");
}

export async function cleanupAuthUser(userId: string) {
  const context = await auth.$context;
  await context.internalAdapter.deleteUser(userId);
}

async function findIdentity(
  transaction: RlsTransaction,
  input: AuthUserProvisioningInput,
) {
  const identity = await transaction
    .select({
      personId: persons.id,
      personStatus: persons.status,
      displayName: persons.displayName,
      institutionalEmail: persons.institutionalEmail,
      studentId: students.id,
      studentStatus: students.status,
      employeeId: employees.id,
      employeeStatus: employees.status,
    })
    .from(persons)
    .leftJoin(students, eq(students.personId, persons.id))
    .leftJoin(employees, eq(employees.personId, persons.id))
    .where(
      input.institutionalStudentNumber
        ? eq(
            students.institutionalStudentNumber,
            input.institutionalStudentNumber,
          )
        : eq(employees.employeeNumber, input.employeeNumber ?? ""),
    )
    .limit(1);

  return identity[0] as ProvisionableIdentity | undefined;
}

function assertIdentityMatchesProfile(
  identity: ProvisionableIdentity,
  input: AuthUserProvisioningInput,
) {
  const isStudent = input.roleProfile === "student";
  if (identity.personStatus !== "active") {
    throw conflict("The identity is not active");
  }

  const hasExpectedIdentity = isStudent
    ? identity.studentId !== null && identity.studentStatus === "active"
    : identity.employeeId !== null && identity.employeeStatus === "active";

  if (!hasExpectedIdentity) {
    throw conflict("The identity does not match the requested role profile");
  }

  if (!identity.institutionalEmail) {
    throw conflict("The identity has no institutional email address");
  }
}

export async function provisionAuthUser(
  transaction: RlsTransaction,
  actor: Actor,
  input: AuthUserProvisioningInput,
  authApi: AuthProvisioningApi = auth.api,
): Promise<ProvisionedAuthUser> {
  const identity = await findIdentity(transaction, input);
  if (!identity) {
    throw notFound("The requested institutional identity was not found");
  }

  if (identity.institutionalEmail === null) {
    throw conflict("The identity has no institutional email address");
  }

  assertIdentityMatchesProfile(identity, input);

  const [existingAccount] = await transaction
    .select({ id: userAccounts.id })
    .from(userAccounts)
    .where(eq(userAccounts.personId, identity.personId))
    .limit(1);
  if (existingAccount) {
    throw conflict("The identity already has an authentication account");
  }

  const [role] = await transaction
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.code, input.roleProfile))
    .limit(1);
  if (!role) {
    throw conflict(`The ${input.roleProfile} ARISE role is not configured`);
  }

  let authenticationSubject: string | undefined;
  try {
    const createdUser = await authApi.createUser({
      body: {
        email: identity.institutionalEmail,
        name: identity.displayName,
        password: createUnusablePassword(),
        role: "user",
      },
    });
    authenticationSubject = createdUser.user.id;

    const [account] = await transaction
      .insert(userAccounts)
      .values({
        personId: identity.personId,
        authenticationSubject,
        status: "active",
      })
      .returning({ id: userAccounts.id });

    await transaction.insert(userRoles).values({
      userAccountId: account.id,
      roleId: role.id,
      assignedByUserAccountId: actor.userAccountId,
    });

    await recordAuditEvent(transaction, {
      actor,
      action: "insert",
      targetSchema: "identity",
      targetTable: "user_accounts",
      targetRecordId: account.id,
      targetStudentId: identity.studentId ?? undefined,
      metadata: {
        authenticationSubject,
        roleProfile: input.roleProfile,
      },
    });
  } catch (error) {
    if (authenticationSubject) {
      await cleanupAuthUser(authenticationSubject).catch(() => undefined);
    }
    throw error;
  }

  return {
    email: identity.institutionalEmail,
    roleProfile: input.roleProfile,
  };
}

function activationUrl(path: string) {
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return new URL(path, baseUrl).toString();
}

export async function sendProvisioningEmails(
  email: string,
  authApi: AuthEmailApi = defaultAuthEmailApi,
) {
  await Promise.all([
    authApi.requestPasswordReset({
      body: {
        email,
        redirectTo: activationUrl("/auth/activate"),
      },
    }),
    authApi.sendVerificationEmail({
      body: {
        email,
        callbackURL: activationUrl("/auth/verify"),
      },
    }),
  ]);
}
