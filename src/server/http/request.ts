import type { z } from "zod";
import { badRequest } from "./errors";

export function parseInput<T extends z.ZodType>(schema: T, input: unknown) {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw badRequest(
      "Request validation failed",
      result.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    );
  }

  return result.data;
}

export async function parseJson<T extends z.ZodType>(
  request: Request,
  schema: T,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }

  return parseInput(schema, body);
}
