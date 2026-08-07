import { withActorTransaction } from "@/server/auth/actor";
import { parseInput, parseJson } from "@/server/http/request";
import { createdResponse, errorResponse } from "@/server/http/response";
import { addInterventionNote } from "@/server/services/interventions";
import {
  interventionNoteInputSchema,
  interventionRouteParamsSchema,
} from "@/server/validation/interventions";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = parseInput(
      interventionRouteParamsSchema,
      await context.params,
    );
    const input = await parseJson(request, interventionNoteInputSchema);
    return await withActorTransaction(request, async (transaction, actor) => {
      return createdResponse({
        note: await addInterventionNote(
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
