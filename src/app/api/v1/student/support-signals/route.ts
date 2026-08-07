import { withActorTransaction } from "@/server/auth/actor";
import { createdResponse, errorResponse } from "@/server/http/response";
import { createSupportSignal } from "@/server/services/support";

export async function POST(request: Request) {
  try {
    return await withActorTransaction(request, async (transaction, actor) => {
      return createdResponse({
        supportSignal: await createSupportSignal(transaction, actor),
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
