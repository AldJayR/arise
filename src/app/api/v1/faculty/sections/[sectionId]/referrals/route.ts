import { requireActorRole, withActorTransaction } from "@/server/auth/actor";
import { parseInput, parseJson } from "@/server/http/request";
import { createdResponse, errorResponse } from "@/server/http/response";
import { createFacultyReferral } from "@/server/services/interventions";
import { sectionRouteParamsSchema } from "@/server/validation/faculty";
import { referralInputSchema } from "@/server/validation/interventions";

type RouteContext = { params: Promise<{ sectionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = parseInput(sectionRouteParamsSchema, await context.params);
    const input = await parseJson(request, referralInputSchema);
    return await withActorTransaction(request, async (transaction, actor) => {
      requireActorRole(actor, "faculty");
      return createdResponse({
        referral: await createFacultyReferral(
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
