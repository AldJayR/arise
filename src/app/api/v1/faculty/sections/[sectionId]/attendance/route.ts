import { requireActorRole, withActorTransaction } from "@/server/auth/actor";
import { parseInput, parseJson } from "@/server/http/request";
import { errorResponse, jsonResponse } from "@/server/http/response";
import { recordAttendance } from "@/server/services/academic";
import {
  bulkAttendanceSubmissionSchema,
  sectionRouteParamsSchema,
} from "@/server/validation/faculty";

type RouteContext = { params: Promise<{ sectionId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const params = parseInput(sectionRouteParamsSchema, await context.params);
    const input = await parseJson(request, bulkAttendanceSubmissionSchema);
    return await withActorTransaction(request, async (transaction, actor) => {
      requireActorRole(actor, "faculty");
      return jsonResponse({
        attendance: await recordAttendance(
          transaction,
          actor,
          params.sectionId,
          input,
        ),
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
