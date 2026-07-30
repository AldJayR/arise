import { serializeError } from "./errors";

export function jsonResponse<T>(body: T, status = 200) {
  return Response.json(body, { status });
}

export function createdResponse<T>(body: T) {
  return jsonResponse(body, 201);
}

export function errorResponse(error: unknown) {
  const serialized = serializeError(error);
  return jsonResponse(serialized.body, serialized.status);
}
