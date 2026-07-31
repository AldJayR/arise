import type { Actor } from "@/server/auth/actor";
import { forbidden } from "@/server/http/errors";

export function requireActorPermission(actor: Actor, permission: string) {
  if (!actor.permissions.includes(permission)) {
    throw forbidden(`The ${permission} permission is required for this action`);
  }
}
