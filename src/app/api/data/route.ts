import { eq } from "drizzle-orm";
import { db } from "@/db";
import { exams, pastRecords, planEntries, sessionTopics, studySessions } from "@/db/schema";
import { currentUser, unauthorized } from "@/lib/auth";
import { readJsonBody } from "@/lib/http";
import { applyTopicProgress, loadState } from "@/lib/server-data";
import { toDayKey } from "@/lib/srs";
import type { AppState } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET — full JSON backup of this profile (the "yours to keep" export) */
export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  const state = await loadState(user);
  const payload = {
    app: "study-tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    user: {
      name: state.user.name,
      university: state.user.university,
      course: state.user.course,
      semester: state.user.semester,
      settings: state.user.settings,
    },
    progress: state.progress,
    sessions: state.sessions,
    plan: state.plan,
    exams: state.exams,
    pastRecords: state.pastRecords,
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="study-tracker-backup-${toDayKey(new Date())}.json"`,
    },
  });
}

/** POST — merge a backup (or a classmate's shared plan) back in */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = await readJsonBody<Partial<AppState> & { plan?: AppState["plan"]; mode?: "merge" | "plan-only" }>(req);
  if (!body) return Response.json({ error: "Invalid request body" }, { status: 400 });

  if (body.plan?.length) {
    const existing = await db.select().from(planEntries).where(eq(planEntries.userId, user.id));
    const taken = new Set(existing.map((p) => `${p.weekday}:${p.subjectId}`));
    const rows = body.plan
      .filter((p) => !taken.has(`${p.weekday}:${p.subjectId}`))
      .map((p, i) => ({
        userId: user.id,
        weekday: p.weekday,
        subjectId: p.subjectId,
        topicIds: p.topicIds ?? [],
        targetMinutes: p.targetMinutes || 50,
        position: existing.length + i,
      }));
    if (rows.length) await db.insert(planEntries).values(rows);
  }

  if (body.mode !== "plan-only") {
    for (const s of body.sessions ?? []) {
      const [row] = await db
        .insert(studySessions)
        .values({
          userId: user.id,
          day: s.day,
          kind: s.kind,
          minutes: s.minutes,
          focusQuality: s.focusQuality,
          pomodoros: s.pomodoros,
          notes: s.notes ?? "",
          startedAt: new Date(s.startedAt),
          endedAt: new Date(new Date(s.startedAt).getTime() + s.minutes * 60000),
        })
        .returning();
      for (const t of s.topics ?? []) {
        await db.insert(sessionTopics).values({
          sessionId: row.id,
          topicId: t.topicId,
          minutes: t.minutes,
          masteryAfter: t.masteryAfter,
          confidenceAfter: t.confidenceAfter,
        });
      }
    }
    for (const p of body.progress ?? []) {
      await applyTopicProgress(user.id, p.topicId, {
        mastery: p.mastery,
        confidence: p.confidence,
        minutes: 0,
        when: p.lastStudiedAt ? new Date(p.lastStudiedAt) : new Date(),
      });
    }
    for (const e of body.exams ?? []) {
      await db.insert(exams).values({ userId: user.id, subjectId: e.subjectId, examDay: e.examDay }).onConflictDoNothing();
    }
    for (const r of body.pastRecords ?? []) {
      await db.insert(pastRecords).values({
        userId: user.id,
        label: r.label,
        marks: r.marks,
        outOf: r.outOf,
        attendance: r.attendance,
        semester: r.semester,
      });
    }
  }

  const state = await loadState(user);
  return Response.json({ ok: true, state });
}


