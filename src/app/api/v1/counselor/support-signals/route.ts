import { requireActorRole, withActorTransaction } from "@/server/auth/actor";
import { errorResponse, jsonResponse } from "@/server/http/response";
import { listCounselorSupportSignals } from "@/server/services/support";

export async function GET(request: Request) {
  try {
    return await withActorTransaction(request, async (transaction, actor) => {
      requireActorRole(actor, "counselor");
      return jsonResponse(
        await listCounselorSupportSignals(transaction, actor),
      );
    });
  } catch (error) {
    return errorResponse(error);
  }
}
