import { requireActorRole, withActorTransaction } from "@/server/auth/actor";
import { parseJson } from "@/server/http/request";
import { errorResponse, jsonResponse } from "@/server/http/response";
import {
  getStudentPrivacyConsent,
  grantStudentPrivacyConsent,
} from "@/server/services/consent";
import { privacyConsentInputSchema } from "@/server/validation/consent";

export async function GET(request: Request) {
  try {
    return await withActorTransaction(request, async (transaction, actor) => {
      requireActorRole(actor, "student");
      return jsonResponse(await getStudentPrivacyConsent(transaction, actor));
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    return await withActorTransaction(request, async (transaction, actor) => {
      requireActorRole(actor, "student");
      await parseJson(request, privacyConsentInputSchema);
      return jsonResponse(await grantStudentPrivacyConsent(transaction, actor));
    });
  } catch (error) {
    return errorResponse(error);
  }
}
