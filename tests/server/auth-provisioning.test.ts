import { describe, expect, it } from "vitest";
import { authUserProvisioningSchema } from "@/server/validation/auth";

describe("auth provisioning validation", () => {
  it("accepts a student profile identified by institutional student number", () => {
    expect(
      authUserProvisioningSchema.safeParse({
        institutionalStudentNumber: "2026-0001",
        roleProfile: "student",
      }).success,
    ).toBe(true);
  });

  it("requires an employee number for employee profiles", () => {
    expect(
      authUserProvisioningSchema.safeParse({
        institutionalStudentNumber: "2026-0001",
        roleProfile: "faculty",
      }).success,
    ).toBe(false);
  });

  it("rejects client-controlled Better Auth and database roles", () => {
    expect(
      authUserProvisioningSchema.safeParse({
        employeeNumber: "EMP-001",
        roleProfile: "counselor",
        role: "admin",
        databaseRole: "arise_app_admin",
      }).success,
    ).toBe(false);
  });
});
