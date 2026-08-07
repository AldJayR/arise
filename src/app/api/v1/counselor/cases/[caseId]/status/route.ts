import { withActorTransaction } from "@/server/auth/actor";
import { parseInput, parseJson } from "@/server/http/request";
import { createdResponse, errorResponse } from "@/server/http/response";
import { appendCaseStatus } from "@/server/services/interventions";
import {
  caseStatusInputSchema,
  interventionRouteParamsSchema,
} from "@/server/validation/interventions";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = parseInput(
      interventionRouteParamsSchema,
      await context.params,
    );
    const input = await parseJson(request, caseStatusInputSchema);
    return await withActorTransaction(request, async (transaction, actor) => {
      return createdResponse({
        status: await appendCaseStatus(
          transaction,
          actor,
          params.caseId,
          input,
        ),
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
