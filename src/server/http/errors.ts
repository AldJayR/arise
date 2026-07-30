import { z } from "zod";

export type ErrorDetails =
  | Readonly<Record<string, unknown>>
  | readonly unknown[];

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ErrorDetails;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: ErrorDetails,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(
  message = "Invalid request",
  details?: ErrorDetails,
) {
  return new AppError(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message = "Authentication required") {
  return new AppError(401, "UNAUTHORIZED", message);
}

export function forbidden(
  message = "You are not allowed to perform this action",
) {
  return new AppError(403, "FORBIDDEN", message);
}

export function notFound(message = "The requested resource was not found") {
  return new AppError(404, "NOT_FOUND", message);
}

export function conflict(
  message = "The request conflicts with the current state",
) {
  return new AppError(409, "CONFLICT", message);
}

function validationDetails(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
  }));
}

export function serializeError(error: unknown) {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
    };
  }

  if (error instanceof z.ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: "BAD_REQUEST",
          message: "Request validation failed",
          details: validationDetails(error),
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
  };
}
