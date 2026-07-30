import { requireActorRole, withActorTransaction } from "@/server/auth/actor";
import { parseInput, parseJson } from "@/server/http/request";
import { errorResponse, jsonResponse } from "@/server/http/response";
import { recordGrades } from "@/server/services/academic";
import {
  gradeSubmissionSchema,
  sectionRouteParamsSchema,
} from "@/server/validation/faculty";

type RouteContext = { params: Promise<{ sectionId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const params = parseInput(sectionRouteParamsSchema, await context.params);
    const input = await parseJson(request, gradeSubmissionSchema);
    return await withActorTransaction(request, async (transaction, actor) => {
      requireActorRole(actor, "faculty");
      return jsonResponse({
        grades: await recordGrades(transaction, actor, params.sectionId, input),
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
