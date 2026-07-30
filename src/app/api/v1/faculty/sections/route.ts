import { requireActorRole, withActorTransaction } from "@/server/auth/actor";
import { errorResponse, jsonResponse } from "@/server/http/response";
import { listFacultySections } from "@/server/services/academic";

export async function GET(request: Request) {
  try {
    return await withActorTransaction(request, async (transaction, actor) => {
      requireActorRole(actor, "faculty");
      return jsonResponse(await listFacultySections(transaction, actor));
    });
  } catch (error) {
    return errorResponse(error);
  }
}
