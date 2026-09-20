import { db } from "@/db";
import { sessionTopics, studySessions } from "@/db/schema";
import { currentUser, unauthorized } from "@/lib/auth";
import { readJsonBody } from "@/lib/http";
import { applyTopicProgress, loadState } from "@/lib/server-data";
import { toDayKey } from "@/lib/srs";
import type { Mastery } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = {
  kind?: "pomodoro" | "long" | "combined";
  minutes: number;
  focusQuality?: number;
  pomodoros?: number;
  notes?: string;
  startedAt?: string;
  topics: { topicId: number; minutes: number; mastery: Mastery; confidence: number; difficulty?: number }[];
};

export async function POST(req: Request) {
  const user = await currentUser(req);
  if (!user) return unauthorized();
  const body = await readJsonBody<Body>(req);
  if (!body) return Response.json({ error: "Invalid request body" }, { status: 400 });

  const started = body.startedAt ? new Date(body.startedAt) : new Date();
  const minutes = Math.max(0, Math.round(body.minutes || 0));

  const [session] = await db
    .insert(studySessions)
    .values({
      userId: user.id,
      day: toDayKey(started),
      kind: body.kind ?? "pomodoro",
      minutes,
      focusQuality: Math.min(5, Math.max(1, body.focusQuality ?? 3)),
      pomodoros: body.pomodoros ?? 0,
      notes: body.notes ?? "",
      startedAt: started,
      endedAt: new Date(started.getTime() + minutes * 60000),
    })
    .returning();

  for (const t of body.topics ?? []) {
    if (!t.topicId) continue;
    await db.insert(sessionTopics).values({
      sessionId: session.id,
      topicId: t.topicId,
      minutes: Math.round(t.minutes || 0),
      masteryAfter: t.mastery,
      confidenceAfter: t.confidence,
    });
    await applyTopicProgress(user.id, t.topicId, {
      mastery: t.mastery,
      confidence: t.confidence,
      minutes: Math.round(t.minutes || 0),
      difficulty: t.difficulty,
    });
  }

  const state = await loadState(user);
  return Response.json({ ok: true, state });
}
