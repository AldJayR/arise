import { withActorTransaction } from "@/server/auth/actor";
import { parseInput } from "@/server/http/request";
import { errorResponse, jsonResponse } from "@/server/http/response";
import { getCounselorCase } from "@/server/services/interventions";
import { interventionRouteParamsSchema } from "@/server/validation/interventions";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const params = parseInput(
      interventionRouteParamsSchema,
      await context.params,
    );
    return await withActorTransaction(request, async (transaction, actor) => {
      return jsonResponse(
        await getCounselorCase(transaction, actor, params.caseId),
      );
    });
  } catch (error) {
    return errorResponse(error);
  }
}
