import { withActorTransaction } from "@/server/auth/actor";
import { parseInput } from "@/server/http/request";
import { errorResponse, jsonResponse } from "@/server/http/response";
import { getFacultyRoster } from "@/server/services/academic";
import { sectionRouteParamsSchema } from "@/server/validation/faculty";

type RouteContext = { params: Promise<{ sectionId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const params = parseInput(sectionRouteParamsSchema, await context.params);
    return await withActorTransaction(request, async (transaction, actor) => {
      return jsonResponse(
        await getFacultyRoster(transaction, actor, params.sectionId),
      );
    });
  } catch (error) {
    return errorResponse(error);
  }
}
