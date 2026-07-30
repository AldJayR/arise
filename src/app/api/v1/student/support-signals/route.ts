import { requireActorRole, withActorTransaction } from "@/server/auth/actor";
import { parseJson } from "@/server/http/request";
import { createdResponse, errorResponse } from "@/server/http/response";
import { createSupportSignal } from "@/server/services/support";
import { supportSignalInputSchema } from "@/server/validation/student";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, supportSignalInputSchema);
    return await withActorTransaction(request, async (transaction, actor) => {
      requireActorRole(actor, "student");
      return createdResponse({
        supportSignal: await createSupportSignal(transaction, actor, input),
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
