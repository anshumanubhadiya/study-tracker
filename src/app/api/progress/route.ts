import { currentUser, unauthorized } from "@/lib/auth";
import { readJsonBody } from "@/lib/http";
import { applyTopicProgress, loadState } from "@/lib/server-data";
import type { Mastery } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = {
  topicId: number;
  mastery?: Mastery;
  confidence?: number;
  minutes?: number;
  difficulty?: number;
};

export async function POST(req: Request) {
  const user = await currentUser(req);
  if (!user) return unauthorized();

  const body = await readJsonBody<Body | Body[]>(req);
  if (!body) return Response.json({ error: "Invalid request body" }, { status: 400 });
  const items = Array.isArray(body) ? body : [body];
  for (const item of items) {
    if (!item?.topicId) continue;
    await applyTopicProgress(user.id, item.topicId, {
      mastery: item.mastery,
      confidence: item.confidence,
      minutes: item.minutes ?? 0,
      difficulty: item.difficulty,
    });
  }
  const state = await loadState(user);
  return Response.json({ ok: true, progress: state.progress });
}
