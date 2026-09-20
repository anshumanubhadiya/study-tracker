import { currentUserId, currentUser, unauthorized } from "@/lib/auth";
import { loadState } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) {
    // a valid-looking session cookie that no longer matches a user row means
    // the profile was wiped (e.g. the database was reset) — tell the client
    // so it can explain instead of silently bouncing to the login page
    if ((await currentUserId()) !== null) {
      return Response.json({ error: "stale_session" }, { status: 401 });
    }
    return unauthorized();
  }
  const state = await loadState(user);
  return Response.json(state);
}
