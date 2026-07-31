import { describe, expect, it } from "vitest";
import { requireActorPermission } from "@/server/services/authorization";

const actor = {
  permissions: ["auth:provision"],
} as never;

describe("ARISE authorization", () => {
  it("allows an assigned permission", () => {
    expect(() => requireActorPermission(actor, "auth:provision")).not.toThrow();
  });

  it("rejects a missing permission", () => {
    expect(() =>
      requireActorPermission({ permissions: [] } as never, "auth:provision"),
    ).toThrow("The auth:provision permission is required for this action");
  });
});
