import { getDatabase, withRlsContext } from "@/db/client";
import { resolveAuthenticatedActor } from "@/server/auth/actor";
import { parseJson } from "@/server/http/request";
import { createdResponse, errorResponse } from "@/server/http/response";
import {
  provisionAuthUser,
  sendProvisioningEmails,
} from "@/server/services/auth-provisioning";
import { requireActorPermission } from "@/server/services/authorization";
import { authUserProvisioningSchema } from "@/server/validation/auth";

export async function POST(request: Request) {
  try {
    const database = getDatabase();
    const actor = await resolveAuthenticatedActor(request, database);
    requireActorPermission(actor, "auth:provision");
    const input = await parseJson(request, authUserProvisioningSchema);

    const result = await withRlsContext(
      database,
      { ...actor.rls, databaseRole: "arise_app_service" },
      (transaction) =>
        provisionAuthUser(transaction, actor, input),
    );

    await sendProvisioningEmails(result.email);

    return createdResponse({
      roleProfile: result.roleProfile,
      activation: "email_sent",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
