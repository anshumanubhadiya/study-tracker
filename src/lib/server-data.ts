import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  exams,
  pastRecords,
  planEntries,
  planOverrides,
  scans,
  semesters,
  sessionTopics,
  studySessions,
  subjects,
  topicProgress,
  topics,
  units,
  users,
} from "@/db/schema";
import { ensureDb } from "./bootstrap";
import { SEM3, SEMESTERS, type SeedSubject } from "./seed-data";
import { DEFAULT_SETTINGS, type AppState, type Mastery, type SubjectDTO, type UserDTO, type UserSettings } from "./types";
import { nextStability, scheduleNextReview, toDayKey } from "./srs";

/* ------------------------------------------------------------- seeding --- */

async function runSeed(): Promise<void> {
  await ensureDb();

  // every supported semester exists (1..8) — new programs are added for free
  const existing = await db.select().from(semesters);
  const have = new Set(existing.map((s) => s.number));
  const missing = SEMESTERS.filter((s) => !have.has(s.number));
  if (missing.length) await db.insert(semesters).values(missing);

  // the built-in sample library (GTU BCA Sem 3) is seeded exactly once
  const [sem3] = await db.select().from(semesters).where(eq(semesters.number, 3)).limit(1);
  if (!sem3) return;
  const [cnt] = await db.select({ n: sql<number>`count(*)::int` }).from(subjects).where(eq(subjects.semesterId, sem3.id));
  if ((cnt?.n ?? 0) > 0) return;
  for (const subject of SEM3) await insertSubjectTree(sem3.id, subject, "seed", null);
}

let seedOnce: Promise<void> | null = null;

/** runs the bootstrap + sample seed exactly once per process (no first-request race) */
export function ensureSeed(): Promise<void> {
  seedOnce ??= runSeed().catch((e) => {
    seedOnce = null;
    throw e;
  });
  return seedOnce;
}

export async function insertSubjectTree(
  semesterId: number,
  subject: SeedSubject,
  source: string,
  createdBy: number | null,
) {
  const [row] = await db
    .insert(subjects)
    .values({
      semesterId,
      name: subject.name,
      code: subject.code,
      credits: subject.credits,
      color: subject.color,
      icon: subject.icon,
      source,
      createdBy,
    })
    .returning();

  for (const unit of subject.units) {
    const [u] = await db
      .insert(units)
      .values({ subjectId: row.id, number: unit.number, title: unit.title, weightage: Math.round(unit.weightage) })
      .returning();
    if (unit.topics.length) {
      await db.insert(topics).values(
        unit.topics.map((t) => ({
          unitId: u.id,
          title: t.title,
          weightage: Math.round(t.weightage),
          difficulty: t.difficulty ?? 2,
          estMinutes: t.estMinutes ?? 40,
          source,
          createdBy,
        })),
      );
    }
  }
  return row;
}

/* ----------------------------------------------------------- read state -- */

export function toUserDTO(u: typeof users.$inferSelect): UserDTO {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    isGuest: u.isGuest,
    university: u.university,
    course: u.course,
    semester: u.semester,
    theme: (u.theme as "dark" | "light") ?? "dark",
    accent: u.accent,
    settings: { ...DEFAULT_SETTINGS, ...(u.settings as Partial<UserSettings>) },
  };
}

export async function loadLibrary(): Promise<{ semesters: AppState["semesters"]; subjects: SubjectDTO[] }> {
  const semRows = await db.select().from(semesters).orderBy(asc(semesters.number));
  const subRows = await db.select().from(subjects).orderBy(asc(subjects.id));
  const unitRows = await db.select().from(units).orderBy(asc(units.number), asc(units.id));
  const topicRows = await db.select().from(topics).orderBy(asc(topics.id));

  const semById = new Map(semRows.map((s) => [s.id, s]));
  const topicsByUnit = new Map<number, typeof topicRows>();
  for (const t of topicRows) {
    const list = topicsByUnit.get(t.unitId) ?? [];
    list.push(t);
    topicsByUnit.set(t.unitId, list);
  }
  const unitsBySubject = new Map<number, typeof unitRows>();
  for (const u of unitRows) {
    const list = unitsBySubject.get(u.subjectId) ?? [];
    list.push(u);
    unitsBySubject.set(u.subjectId, list);
  }

  const subjectDTOs: SubjectDTO[] = subRows.map((s) => ({
    id: s.id,
    semesterId: s.semesterId,
    semesterNumber: semById.get(s.semesterId)?.number ?? 0,
    name: s.name,
    code: s.code,
    credits: s.credits,
    color: s.color,
    icon: s.icon,
    source: s.source,
    units: (unitsBySubject.get(s.id) ?? []).map((u) => ({
      id: u.id,
      subjectId: u.subjectId,
      number: u.number,
      title: u.title,
      weightage: u.weightage,
      topics: (topicsByUnit.get(u.id) ?? []).map((t) => ({
        id: t.id,
        unitId: t.unitId,
        title: t.title,
        weightage: t.weightage,
        difficulty: t.difficulty,
        estMinutes: t.estMinutes,
        source: t.source,
      })),
    })),
  }));

  return {
    semesters: semRows.map((s) => ({
      id: s.id,
      number: s.number,
      name: s.name,
      subjectCount: subjectDTOs.filter((x) => x.semesterId === s.id).length,
    })),
    subjects: subjectDTOs,
  };
}

export async function loadState(user: typeof users.$inferSelect): Promise<AppState> {
  await ensureSeed();
  const library = await loadLibrary();

  const [progressRows, sessionRows, planRows, overrideRows, examRows, pastRows] = await Promise.all([
    db.select().from(topicProgress).where(eq(topicProgress.userId, user.id)),
    db.select().from(studySessions).where(eq(studySessions.userId, user.id)).orderBy(desc(studySessions.startedAt)).limit(500),
    db.select().from(planEntries).where(eq(planEntries.userId, user.id)).orderBy(asc(planEntries.position)),
    db.select().from(planOverrides).where(eq(planOverrides.userId, user.id)),
    db.select().from(exams).where(eq(exams.userId, user.id)),
    db.select().from(pastRecords).where(eq(pastRecords.userId, user.id)),
  ]);

  const sessionIds = sessionRows.map((s) => s.id);
  const stRows = sessionIds.length
    ? await db.select().from(sessionTopics).where(inArray(sessionTopics.sessionId, sessionIds))
    : [];
  const stBySession = new Map<number, typeof stRows>();
  for (const st of stRows) {
    const list = stBySession.get(st.sessionId) ?? [];
    list.push(st);
    stBySession.set(st.sessionId, list);
  }

  return {
    user: toUserDTO(user),
    semesters: library.semesters,
    subjects: library.subjects,
    progress: progressRows.map((p) => ({
      topicId: p.topicId,
      mastery: p.mastery as Mastery,
      confidence: p.confidence,
      reviewCount: p.reviewCount,
      totalMinutes: p.totalMinutes,
      lastStudiedAt: p.lastStudiedAt ? p.lastStudiedAt.toISOString() : null,
      nextReviewAt: p.nextReviewAt ? p.nextReviewAt.toISOString() : null,
      stability: p.stability,
    })),
    sessions: sessionRows.map((s) => ({
      id: s.id,
      day: s.day,
      kind: s.kind as "pomodoro" | "long" | "combined",
      minutes: s.minutes,
      focusQuality: s.focusQuality,
      pomodoros: s.pomodoros,
      notes: s.notes,
      startedAt: s.startedAt.toISOString(),
      topics: (stBySession.get(s.id) ?? []).map((st) => ({
        topicId: st.topicId,
        minutes: st.minutes,
        masteryAfter: st.masteryAfter as Mastery,
        confidenceAfter: st.confidenceAfter,
      })),
    })),
    plan: planRows.map((p) => ({
      id: p.id,
      weekday: p.weekday,
      subjectId: p.subjectId,
      topicIds: p.topicIds ?? [],
      targetMinutes: p.targetMinutes,
      position: p.position,
    })),
    overrides: overrideRows.map((o) => ({ id: o.id, fromDay: o.fromDay, toDay: o.toDay })),
    exams: examRows.map((e) => ({ id: e.id, subjectId: e.subjectId, examDay: e.examDay })),
    pastRecords: pastRows.map((p) => ({
      id: p.id,
      label: p.label,
      marks: p.marks,
      outOf: p.outOf,
      attendance: p.attendance,
      semester: p.semester,
    })),
  };
}

/* ------------------------------------------------- write: topic progress -- */

export async function applyTopicProgress(
  userId: number,
  topicId: number,
  input: { mastery?: Mastery; confidence?: number; minutes?: number; when?: Date; difficulty?: number },
) {
  const when = input.when ?? new Date();
  const existing = (
    await db
      .select()
      .from(topicProgress)
      .where(and(eq(topicProgress.userId, userId), eq(topicProgress.topicId, topicId)))
      .limit(1)
  )[0];

  const mastery = (input.mastery ?? (existing?.mastery as Mastery) ?? "learning") as Mastery;
  const confidence = input.confidence ?? existing?.confidence ?? 3;
  const minutes = input.minutes ?? 0;
  const stability = nextStability(existing?.stability ?? 1.5, confidence, input.difficulty ?? 2);
  const nextReviewAt = scheduleNextReview(mastery, confidence, stability, when);

  if (existing) {
    await db
      .update(topicProgress)
      .set({
        mastery,
        confidence,
        stability,
        nextReviewAt,
        lastStudiedAt: when,
        reviewCount: existing.reviewCount + (minutes > 0 ? 1 : 0),
        totalMinutes: existing.totalMinutes + minutes,
        updatedAt: new Date(),
      })
      .where(eq(topicProgress.id, existing.id));
  } else {
    await db.insert(topicProgress).values({
      userId,
      topicId,
      mastery,
      confidence,
      stability,
      nextReviewAt,
      lastStudiedAt: when,
      reviewCount: minutes > 0 ? 1 : 0,
      totalMinutes: minutes,
    });
  }
}

/* --------------------------------------------------------- demo profile -- */

/** fills a fresh account with ~10 weeks of believable history so the charts,
    heatmap, streak and readiness curves have something to show.
    The whole history is generated in JS first and written with a handful of
    batched statements — a guest click must never be slow enough to time out. */
export async function seedDemoData(userId: number) {
  await ensureSeed();
  const library = await loadLibrary();
  const sample = library.subjects.filter((s) => s.semesterNumber === 3);
  if (!sample.length) return;

  // weekly plan: one subject per weekday (Sunday off)
  const planValues = sample.slice(0, 6).map((s, i) => ({
    userId,
    weekday: (i + 1) % 7,
    subjectId: s.id,
    topicIds: s.units[0]?.topics.slice(0, 2).map((t) => t.id) ?? [],
    targetMinutes: 50,
    position: i,
  }));
  if (planValues.length) await db.insert(planEntries).values(planValues);

  // exam dates ~3-6 weeks out
  const today = new Date();
  await db.insert(exams).values(
    sample.slice(0, 4).map((s, i) => ({
      userId,
      subjectId: s.id,
      examDay: toDayKey(new Date(today.getTime() + (21 + i * 4) * 86400000)),
    })),
  );

  await db.insert(pastRecords).values([
    { userId, label: "Sem 2 — Overall", marks: 72, outOf: 100, attendance: 81, semester: 2 },
    { userId, label: "Sem 3 — Unit Test 1", marks: 24, outOf: 40, attendance: 78, semester: 3 },
  ]);

  const allTopics = sample.flatMap((s) => s.units.flatMap((u) => u.topics.map((t) => ({ t, u, s }))));
  let rnd = 20260214;
  const rand = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);

  // accumulate the per-topic end state in JS instead of one round trip each
  type Acc = { mastery: Mastery; confidence: number; minutes: number; when: Date; stability: number; count: number };
  const progress = new Map<number, Acc>();

  const sessionRows: {
    userId: number;
    day: string;
    kind: "pomodoro" | "long";
    minutes: number;
    focusQuality: number;
    pomodoros: number;
    notes: string;
    startedAt: Date;
    endedAt: Date;
  }[] = [];
  const stRows: { slot: number; topicId: number; minutes: number; masteryAfter: Mastery; confidenceAfter: number }[] = [];

  // 70 days of history, ~5 study days a week
  for (let dayOffset = 69; dayOffset >= 0; dayOffset--) {
    const date = new Date(today.getTime() - dayOffset * 86400000);
    const dow = date.getDay();
    if (dow === 0 && rand() < 0.7) continue;
    if (rand() < 0.22) continue;

    const blocks = 1 + Math.floor(rand() * 3);
    const minutes = blocks * 25 + Math.floor(rand() * 20);
    date.setHours(18, 0, 0, 0);
    sessionRows.push({
      userId,
      day: toDayKey(date),
      kind: rand() < 0.2 ? "long" : "pomodoro",
      minutes,
      focusQuality: 3 + Math.round(rand()),
      pomodoros: blocks,
      notes: "",
      startedAt: date,
      endedAt: new Date(date.getTime() + minutes * 60000),
    });
    const slot = sessionRows.length - 1;

    const picked = new Set<number>();
    for (let i = 0; i < blocks; i++) {
      const idx = Math.floor(rand() * allTopics.length * 0.75); // bias to earlier units
      const entry = allTopics[Math.min(idx, allTopics.length - 1)];
      if (!entry || picked.has(entry.t.id)) continue;
      picked.add(entry.t.id);
      const roll = rand();
      const mastery: Mastery = roll < 0.45 ? "learning" : roll < 0.8 ? "revised" : "exam_ready";
      const confidence = 2 + Math.floor(rand() * 4);
      const tMin = Math.round(minutes / blocks);
      stRows.push({ slot, topicId: entry.t.id, minutes: tMin, masteryAfter: mastery, confidenceAfter: confidence });

      const acc =
        progress.get(entry.t.id) ??
        ({ mastery: "learning", confidence: 3, minutes: 0, when: date, stability: 1.5, count: 0 } as Acc);
      acc.stability = nextStability(acc.stability, confidence, entry.t.difficulty);
      acc.mastery = mastery;
      acc.confidence = confidence;
      acc.minutes += tMin;
      acc.when = date;
      acc.count += 1;
      progress.set(entry.t.id, acc);
    }
  }

  const sessions = sessionRows.length
    ? await db.insert(studySessions).values(sessionRows).returning()
    : [];
  if (stRows.length && sessions.length) {
    await db.insert(sessionTopics).values(
      stRows.map((s) => ({
        sessionId: sessions[s.slot]?.id ?? sessions[0]!.id,
        topicId: s.topicId,
        minutes: s.minutes,
        masteryAfter: s.masteryAfter,
        confidenceAfter: s.confidenceAfter,
      })),
    );
  }

  // one upsert for the whole 70-day progress history (was ~150 round trips)
  if (progress.size) {
    await db
      .insert(topicProgress)
      .values(
        [...progress.entries()].map(([topicId, a]) => ({
          userId,
          topicId,
          mastery: a.mastery,
          confidence: a.confidence,
          stability: a.stability,
          reviewCount: a.count,
          totalMinutes: a.minutes,
          lastStudiedAt: a.when,
          nextReviewAt: scheduleNextReview(a.mastery, a.confidence, a.stability, a.when),
        })),
      )
      .onConflictDoUpdate({
        target: [topicProgress.userId, topicProgress.topicId],
        set: {
          mastery: sql`excluded.mastery`,
          confidence: sql`excluded.confidence`,
          stability: sql`excluded.stability`,
          nextReviewAt: sql`excluded.next_review_at`,
          lastStudiedAt: sql`excluded.last_studied_at`,
          reviewCount: sql`${topicProgress.reviewCount} + excluded.review_count`,
          totalMinutes: sql`${topicProgress.totalMinutes} + excluded.total_minutes`,
          updatedAt: sql`now()`,
        },
      });
  }

  await db.insert(scans).values({
    userId,
    fileName: "sample-syllabus-oop-java.pdf",
    rawText: "Sample scan kept as history — Syllabus Scanner import",
    parsed: null,
    status: "saved",
    semesterNumber: 3,
  });
}
