import { describe, expect, it, vi } from "vitest";
import {
  resolveAuthenticatedActor,
  selectDatabaseRole,
} from "@/server/auth/actor";

const request = new Request("http://localhost/api");

describe("authenticated actor resolution", () => {
  it("rejects a request without a Better Auth session", async () => {
    const sessionProvider = {
      getSession: vi.fn().mockResolvedValue(null),
    };

    await expect(
      resolveAuthenticatedActor(request, undefined, sessionProvider),
    ).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });

  it("rejects a session whose institutional email is unverified", async () => {
    const sessionProvider = {
      getSession: vi.fn().mockResolvedValue({
        user: { id: "better-auth-user", emailVerified: false },
      }),
    };

    await expect(
      resolveAuthenticatedActor(request, undefined, sessionProvider),
    ).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });
});

describe("database role selection", () => {
  it("selects a deterministic portal role without accepting internal roles", () => {
    expect(selectDatabaseRole(["student", "faculty"])).toBe(
      "arise_app_faculty",
    );
    expect(selectDatabaseRole(["counselor", "registrar"])).toBe(
      "arise_app_registrar",
    );
    expect(selectDatabaseRole(["admin"])).toBe("arise_app_admin");
  });

  it("does not accept internal execution roles", () => {
    expect(() => selectDatabaseRole(["service"])).toThrow(
      "The actor has no supported database role",
    );
  });

  it("rejects an actor with no supported database role", () => {
    expect(() => selectDatabaseRole(["unknown"])).toThrow(
      "The actor has no supported database role",
    );
  });
});
