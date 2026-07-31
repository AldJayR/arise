import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import type { RlsTransaction } from "@/db/client";
import { consentRecords, privacyPolicies } from "@/db/schema";
import { type Actor, requireActorRole } from "@/server/auth/actor";
import { consentRequired, forbidden, notFound } from "@/server/http/errors";

export const requiredConsentPurposes = [
  "cross_departmental_records",
  "confidential_support_signal",
] as const;

type RequiredConsentPurpose = (typeof requiredConsentPurposes)[number];

type PrivacyPolicy = {
  id: string;
  version: string;
  title: string;
  body: string;
  effectiveAt: Date;
};

function studentIdFromActor(actor: Actor) {
  requireActorRole(actor, "student");
  if (!actor.studentId) {
    throw forbidden("The student actor has no student identity");
  }
  return actor.studentId;
}

function policyDto(policy: PrivacyPolicy) {
  return {
    id: policy.id,
    version: policy.version,
    title: policy.title,
    body: policy.body,
    effectiveAt: policy.effectiveAt.toISOString(),
  };
}

export async function getCurrentPrivacyPolicy(
  transaction: RlsTransaction,
): Promise<PrivacyPolicy> {
  const now = new Date();
  const [policy] = await transaction
    .select({
      id: privacyPolicies.id,
      version: privacyPolicies.version,
      title: privacyPolicies.title,
      body: privacyPolicies.body,
      effectiveAt: privacyPolicies.effectiveAt,
    })
    .from(privacyPolicies)
    .where(
      and(
        lte(privacyPolicies.effectiveAt, now),
        or(
          isNull(privacyPolicies.supersededAt),
          gt(privacyPolicies.supersededAt, now),
        ),
      ),
    )
    .orderBy(desc(privacyPolicies.effectiveAt))
    .limit(1);

  if (!policy) {
    throw notFound("No effective privacy policy is configured");
  }

  return policy;
}

async function getPolicyConsent(
  transaction: RlsTransaction,
  studentId: string,
  policyId: string,
) {
  return transaction
    .select({
      purpose: consentRecords.purpose,
      state: consentRecords.state,
      capturedAt: consentRecords.capturedAt,
    })
    .from(consentRecords)
    .where(
      and(
        eq(consentRecords.studentId, studentId),
        eq(consentRecords.policyId, policyId),
      ),
    );
}

export async function getStudentPrivacyConsent(
  transaction: RlsTransaction,
  actor: Actor,
) {
  const studentId = studentIdFromActor(actor);
  const policy = await getCurrentPrivacyPolicy(transaction);
  const consents = await getPolicyConsent(transaction, studentId, policy.id);

  return {
    policy: policyDto(policy),
    consents: consents.map((consent) => ({
      purpose: consent.purpose,
      state: consent.state,
      capturedAt: consent.capturedAt.toISOString(),
    })),
  };
}

export async function requireStudentConsent(
  transaction: RlsTransaction,
  studentId: string,
  purposes: readonly RequiredConsentPurpose[] = requiredConsentPurposes,
) {
  const policy = await getCurrentPrivacyPolicy(transaction);
  const consents = await getPolicyConsent(transaction, studentId, policy.id);
  const grantedPurposes = new Set(
    consents
      .filter((consent) => consent.state === "granted")
      .map((consent) => consent.purpose),
  );

  if (purposes.some((purpose) => !grantedPurposes.has(purpose))) {
    throw consentRequired(policyDto(policy));
  }
}

export async function grantStudentPrivacyConsent(
  transaction: RlsTransaction,
  actor: Actor,
) {
  const studentId = studentIdFromActor(actor);
  const policy = await getCurrentPrivacyPolicy(transaction);
  const capturedAt = new Date();

  for (const purpose of requiredConsentPurposes) {
    await transaction
      .insert(consentRecords)
      .values({
        studentId,
        policyId: policy.id,
        purpose,
        state: "granted",
        capturedAt,
        withdrawnAt: null,
      })
      .onConflictDoNothing();

    await transaction
      .update(consentRecords)
      .set({ state: "granted", capturedAt, withdrawnAt: null })
      .where(
        and(
          eq(consentRecords.studentId, studentId),
          eq(consentRecords.policyId, policy.id),
          eq(consentRecords.purpose, purpose),
          eq(consentRecords.state, "withdrawn"),
        ),
      );
  }

  return getStudentPrivacyConsent(transaction, actor);
}
