import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

const authHandler = toNextJsHandler(auth);

export function isAdminAuthPath(pathname: string) {
  return pathname === "/api/auth/admin" || pathname.startsWith("/api/auth/admin/");
}

function rejectAdminEndpoint(request: Request) {
  if (!isAdminAuthPath(new URL(request.url).pathname)) {
    return null;
  }

  return new Response(null, { status: 404 });
}

export async function GET(request: Request) {
  return rejectAdminEndpoint(request) ?? authHandler.GET(request);
}

export async function POST(request: Request) {
  return rejectAdminEndpoint(request) ?? authHandler.POST(request);
}
