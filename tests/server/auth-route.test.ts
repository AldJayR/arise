import { describe, expect, it } from "vitest";
import { isAdminAuthPath } from "@/app/api/auth/[...all]/route";

describe("Better Auth route surface", () => {
  it("recognizes admin plugin endpoints as server-only", () => {
    expect(isAdminAuthPath("/api/auth/admin/create-user")).toBe(true);
    expect(isAdminAuthPath("/api/auth/administer")).toBe(false);
    expect(isAdminAuthPath("/api/auth/sign-in/email")).toBe(false);
  });
});
