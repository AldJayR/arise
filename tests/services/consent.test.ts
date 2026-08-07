import { describe, expect, it } from "vitest";
import { consentRequired } from "@/server/http/errors";
import { requiredConsentPurposes } from "@/server/services/consent";

describe("privacy consent", () => {
  it("requires both dashboard and support purposes", () => {
    expect(requiredConsentPurposes).toEqual([
      "cross_departmental_records",
      "confidential_support_signal",
    ]);
  });

  it("returns policy metadata through the stable consent error", () => {
    const error = consentRequired({ id: "policy-1", version: "2026.1" });

    expect(error.code).toBe("CONSENT_REQUIRED");
    expect(error.details).toEqual({
      policy: { id: "policy-1", version: "2026.1" },
    });
  });
});
