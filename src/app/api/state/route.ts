import { currentUser, unauthorized } from "@/lib/auth";
import { loadState } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  const state = await loadState(user);
  return Response.json(state);
}
