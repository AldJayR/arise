import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { RlsTransaction } from "@/db/client";
import { auditEvents } from "@/db/schema";
import type { Actor } from "@/server/auth/actor";

type AuditAction = "insert" | "update" | "delete" | "read" | "export";

type AuditInput = {
  actor: Actor;
  action: AuditAction;
  targetSchema: string;
  targetTable: string;
  targetRecordId?: string;
  targetStudentId?: string;
  metadata: Record<string, unknown>;
};

export async function recordAuditEvent(
  transaction: RlsTransaction,
  input: AuditInput,
) {
  const [previous] = await transaction
    .select({ eventHash: auditEvents.eventHash })
    .from(auditEvents)
    .where(eq(auditEvents.actorUserAccountId, input.actor.userAccountId))
    .orderBy(desc(auditEvents.occurredAt))
    .limit(1);
  const payload = JSON.stringify({
    actorUserAccountId: input.actor.userAccountId,
    action: input.action,
    targetSchema: input.targetSchema,
    targetTable: input.targetTable,
    targetRecordId: input.targetRecordId ?? null,
    targetStudentId: input.targetStudentId ?? null,
    metadata: input.metadata,
  });
  const eventHash = createHash("sha256")
    .update(`${previous?.eventHash ?? ""}:${payload}`)
    .digest("hex");

  const [event] = await transaction
    .insert(auditEvents)
    .values({
      actorUserAccountId: input.actor.userAccountId,
      targetStudentId: input.targetStudentId,
      action: input.action,
      targetSchema: input.targetSchema,
      targetTable: input.targetTable,
      targetRecordId: input.targetRecordId,
      previousHash: previous?.eventHash,
      eventHash,
      metadata: input.metadata,
    })
    .returning({ id: auditEvents.id, eventHash: auditEvents.eventHash });

  return event;
}
