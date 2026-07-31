import { z } from "zod";

const roleProfileSchema = z.enum(["student", "faculty", "counselor"]);

export const authUserProvisioningSchema = z
  .object({
    institutionalStudentNumber: z.string().trim().min(1).optional(),
    employeeNumber: z.string().trim().min(1).optional(),
    roleProfile: roleProfileSchema,
  })
  .strict()
  .superRefine((input, context) => {
    const hasStudentNumber = input.institutionalStudentNumber !== undefined;
    const hasEmployeeNumber = input.employeeNumber !== undefined;

    if (hasStudentNumber === hasEmployeeNumber) {
      context.addIssue({
        code: "custom",
        path: ["institutionalStudentNumber"],
        message: "Provide exactly one institutional identity number",
      });
      return;
    }

    if (input.roleProfile === "student" && !hasStudentNumber) {
      context.addIssue({
        code: "custom",
        path: ["institutionalStudentNumber"],
        message: "Student profiles require an institutional student number",
      });
    }

    if (input.roleProfile !== "student" && !hasEmployeeNumber) {
      context.addIssue({
        code: "custom",
        path: ["employeeNumber"],
        message: "Employee profiles require an employee number",
      });
    }
  });

export type AuthUserProvisioningInput = z.infer<
  typeof authUserProvisioningSchema
>;
