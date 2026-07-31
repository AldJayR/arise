import { requireActorRole, withActorTransaction } from "@/server/auth/actor";
import { parseInput } from "@/server/http/request";
import { errorResponse, jsonResponse } from "@/server/http/response";
import { listCounselorCases } from "@/server/services/interventions";
import { counselorCaseListQuerySchema } from "@/server/validation/interventions";

export async function GET(request: Request) {
  try {
    const query = parseInput(
      counselorCaseListQuerySchema,
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return await withActorTransaction(request, async (transaction, actor) => {
      requireActorRole(actor, "counselor");
      return jsonResponse(
        await listCounselorCases(transaction, actor, query.status),
      );
    });
  } catch (error) {
    return errorResponse(error);
  }
}
