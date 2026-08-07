import { withActorTransaction } from "@/server/auth/actor";
import { errorResponse, jsonResponse } from "@/server/http/response";
import {
  getStudentPrivacyConsent,
  grantStudentPrivacyConsent,
} from "@/server/services/consent";

export async function GET(request: Request) {
  try {
    return await withActorTransaction(request, async (transaction, actor) => {
      return jsonResponse(await getStudentPrivacyConsent(transaction, actor));
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    return await withActorTransaction(request, async (transaction, actor) => {
      return jsonResponse(await grantStudentPrivacyConsent(transaction, actor));
    });
  } catch (error) {
    return errorResponse(error);
  }
}
