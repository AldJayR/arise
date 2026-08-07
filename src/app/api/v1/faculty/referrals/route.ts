import { withActorTransaction } from "@/server/auth/actor";
import { errorResponse, jsonResponse } from "@/server/http/response";
import { listFacultyReferrals } from "@/server/services/interventions";

export async function GET(request: Request) {
  try {
    return await withActorTransaction(request, async (transaction, actor) => {
      return jsonResponse(await listFacultyReferrals(transaction, actor));
    });
  } catch (error) {
    return errorResponse(error);
  }
}
