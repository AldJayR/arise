import { withActorTransaction } from "@/server/auth/actor";
import { errorResponse, jsonResponse } from "@/server/http/response";
import { getStudentDashboard } from "@/server/services/student";

export async function GET(request: Request) {
  try {
    return await withActorTransaction(request, async (transaction, actor) => {
      return jsonResponse(await getStudentDashboard(transaction, actor));
    });
  } catch (error) {
    return errorResponse(error);
  }
}
