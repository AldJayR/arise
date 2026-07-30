import { requireActorRole, withActorTransaction } from "@/server/auth/actor";
import { parseInput, parseJson } from "@/server/http/request";
import { createdResponse, errorResponse } from "@/server/http/response";
import { createClassSession } from "@/server/services/academic";
import {
  sectionRouteParamsSchema,
  sessionCreationSchema,
} from "@/server/validation/faculty";

type RouteContext = { params: Promise<{ sectionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = parseInput(sectionRouteParamsSchema, await context.params);
    const input = await parseJson(request, sessionCreationSchema);
    return await withActorTransaction(request, async (transaction, actor) => {
      requireActorRole(actor, "faculty");
      return createdResponse({
        session: await createClassSession(
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
