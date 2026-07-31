import { describe, expect, it, vi } from "vitest";
import { sendProvisioningEmails } from "@/server/services/auth-provisioning";

describe("authentication provisioning", () => {
  it("starts password setup and email verification without exposing tokens", async () => {
    const authApi = {
      requestPasswordReset: vi.fn().mockResolvedValue(undefined),
      sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    };

    await sendProvisioningEmails("student@example.edu", authApi);

    expect(authApi.requestPasswordReset).toHaveBeenCalledWith({
      body: {
        email: "student@example.edu",
        redirectTo: "http://localhost:3000/auth/activate",
      },
    });
    expect(authApi.sendVerificationEmail).toHaveBeenCalledWith({
      body: {
        email: "student@example.edu",
        callbackURL: "http://localhost:3000/auth/verify",
      },
    });
  });
});
