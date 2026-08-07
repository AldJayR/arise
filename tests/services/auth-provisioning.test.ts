import { describe, expect, it, vi } from "vitest";

const { deleteUser } = vi.hoisted(() => ({ deleteUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  auth: {
    $context: Promise.resolve({ internalAdapter: { deleteUser } }),
    api: {},
  },
}));

import {
  cleanupAuthUser,
  sendProvisioningEmails,
} from "@/server/services/auth-provisioning";

describe("authentication provisioning", () => {
  it("cleans up an auth user through the server-only adapter", async () => {
    await cleanupAuthUser("orphaned-user");

    expect(deleteUser).toHaveBeenCalledWith("orphaned-user");
  });

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
