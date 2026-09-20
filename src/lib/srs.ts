/* ============================================================================
   Spaced repetition + exam-readiness engine  (pure functions, no I/O)
   ----------------------------------------------------------------------------
   The whole "is this student ready" question is answered by three small ideas:

   1. A topic has a MASTERY LEVEL (not started → learning → revised → exam-ready)
      and a CONFIDENCE (1-5). Level says what you did, confidence says how it felt.
   2. Knowledge DECAYS. Ebbinghaus: retention R(t) = exp(-t / S) where S is the
      memory "stability" in days. Every successful review multiplies S, a weak
      confidence rating shrinks it — so shaky topics come back sooner, forever.
   3. READINESS is the weighted average of (level × retention) over a subject,
      weighted by GTU exam marks. A 14-mark unit you never opened hurts far more
      than a 3-mark side topic.
   ========================================================================== */

import type { Mastery, ProgressDTO, SubjectDTO, TopicDTO, UnitDTO } from "./types";

export const DAY_MS = 86_400_000;

/** base score a level is worth once it is perfectly fresh */
export const LEVEL_SCORE: Record<Mastery, number> = {
  not_started: 0,
  learning: 0.45,
  revised: 0.75,
  exam_ready: 1,
};

/** the classic 3 / 7 / 15 day ladder, per level */
export const BASE_INTERVAL: Record<Mastery, number> = {
  not_started: 1,
  learning: 3,
  revised: 7,
  exam_ready: 15,
};

export function daysBetween(a: Date | string | number, b: Date | string | number): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / DAY_MS;
}

export function toDayKey(d: Date | string | number): string {
  const date = new Date(d);
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${m}-${day}`;
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * New stability after a review.
 * Confidence 5 nearly doubles it, confidence 1 halves it. Difficulty 3 topics
 * grow slower than easy ones — that is what makes weak topics resurface more.
 */
export function nextStability(prev: number, confidence: number, difficulty = 2): number {
  const conf = Math.min(5, Math.max(1, confidence || 3));
  const factor = 0.55 + conf * 0.29; // 0.84 … 2.0
  const diffPenalty = 1 - (difficulty - 1) * 0.12; // 1 / .88 / .76
  return Math.max(0.8, Math.min(120, prev * factor * diffPenalty));
}

/** when should this topic resurface? */
export function scheduleNextReview(
  mastery: Mastery,
  confidence: number,
  stability: number,
  from: Date = new Date(),
): Date {
  if (mastery === "not_started") return new Date(from.getTime() + DAY_MS);
  const base = BASE_INTERVAL[mastery];
  // blend the fixed ladder with the learned stability so early reviews stay
  // predictable (3/7/15) and later ones stretch with the student's actual recall
  const conf = Math.min(5, Math.max(1, confidence || 3));
  const confScale = 0.55 + conf * 0.15; // .7 … 1.3
  const interval = Math.max(1, Math.round((base * 0.6 + stability * 0.6) * confScale));
  return new Date(from.getTime() + interval * DAY_MS);
}

/** Ebbinghaus retention right now, 0…1 */
export function retention(p: Pick<ProgressDTO, "lastStudiedAt" | "stability">, now = new Date()): number {
  if (!p.lastStudiedAt) return 0;
  const elapsed = Math.max(0, daysBetween(p.lastStudiedAt, now));
  const s = Math.max(0.5, p.stability || 1.5);
  return Math.exp(-elapsed / (s * 2.2));
}

/**
 * What a topic is worth to the exam right now: the level score, faded by how
 * much of it has leaked away. Never falls below 45 % of the level — you do not
 * forget everything, you just need a refresher.
 */
export function effectiveScore(p: ProgressDTO | undefined, now = new Date()): number {
  if (!p || p.mastery === "not_started") return 0;
  const r = retention(p, now);
  return LEVEL_SCORE[p.mastery] * (0.45 + 0.55 * r);
}

export function topicWeight(topic: TopicDTO, unit: UnitDTO): number {
  if (topic.weightage > 0) return topic.weightage;
  if (unit.weightage > 0 && unit.topics.length) return unit.weightage / unit.topics.length;
  return 1;
}

export type ReadinessRow = {
  subjectId: number;
  name: string;
  readiness: number; // 0..100
  coverage: number; // % of topics touched at all
  weakTopics: number;
  dueTopics: number;
  totalTopics: number;
  untouchedUnits: string[];
};

export function subjectReadiness(
  subject: SubjectDTO,
  progressById: Map<number, ProgressDTO>,
  now = new Date(),
): ReadinessRow {
  let weightSum = 0;
  let scoreSum = 0;
  let touched = 0;
  let total = 0;
  let weak = 0;
  let due = 0;
  const untouchedUnits: string[] = [];

  for (const unit of subject.units) {
    let unitTouched = false;
    for (const topic of unit.topics) {
      total += 1;
      const w = topicWeight(topic, unit);
      const p = progressById.get(topic.id);
      weightSum += w;
      scoreSum += w * effectiveScore(p, now);
      if (p && p.mastery !== "not_started") {
        touched += 1;
        unitTouched = true;
        if (p.confidence > 0 && p.confidence <= 2) weak += 1;
        if (p.nextReviewAt && new Date(p.nextReviewAt) <= now && p.mastery !== "exam_ready") due += 1;
        else if (p.nextReviewAt && new Date(p.nextReviewAt) <= now) due += 1;
      }
    }
    if (!unitTouched && unit.topics.length) untouchedUnits.push(`Unit ${unit.number}`);
  }

  return {
    subjectId: subject.id,
    name: subject.name,
    readiness: weightSum ? Math.round((scoreSum / weightSum) * 100) : 0,
    coverage: total ? Math.round((touched / total) * 100) : 0,
    weakTopics: weak,
    dueTopics: due,
    totalTopics: total,
    untouchedUnits,
  };
}

export function overallReadiness(rows: ReadinessRow[]): number {
  if (!rows.length) return 0;
  const totals = rows.reduce((a, r) => a + r.totalTopics, 0);
  if (!totals) return 0;
  return Math.round(rows.reduce((a, r) => a + r.readiness * r.totalTopics, 0) / totals);
}

export type DueTopic = {
  topic: TopicDTO;
  unit: UnitDTO;
  subject: SubjectDTO;
  progress: ProgressDTO | undefined;
  dueInDays: number;
  urgency: number;
  reason: string;
};

/**
 * The revision queue. Sorted by urgency:
 *   overdue days  +  low confidence  +  exam weightage  +  exam proximity
 */
export function dueQueue(
  subjects: SubjectDTO[],
  progressById: Map<number, ProgressDTO>,
  opts: { now?: Date; examDays?: Map<number, string>; limit?: number } = {},
): DueTopic[] {
  const now = opts.now ?? new Date();
  const out: DueTopic[] = [];

  for (const subject of subjects) {
    const examDay = opts.examDays?.get(subject.id);
    const daysToExam = examDay ? Math.max(0, daysBetween(now, fromDayKey(examDay))) : null;
    for (const unit of subject.units) {
      for (const topic of unit.topics) {
        const p = progressById.get(topic.id);
        if (!p || p.mastery === "not_started") continue;
        if (!p.nextReviewAt) continue;
        const dueIn = daysBetween(now, p.nextReviewAt);
        if (dueIn > 2) continue; // only what's due (or due within 48h)
        const overdue = Math.max(0, -dueIn);
        const confPenalty = p.confidence ? (5 - p.confidence) * 1.2 : 2;
        const weight = topicWeight(topic, unit) / 4;
        const examBoost = daysToExam !== null ? Math.max(0, 14 - daysToExam) / 3 : 0;
        const urgency = overdue * 2 + confPenalty + weight + examBoost - retention(p, now) * 3;
        out.push({
          topic,
          unit,
          subject,
          progress: p,
          dueInDays: Math.round(dueIn),
          urgency,
          reason:
            overdue >= 1
              ? `${Math.round(overdue)}d overdue`
              : p.confidence <= 2
                ? "low confidence"
                : examBoost > 0
                  ? "exam close"
                  : "scheduled review",
        });
      }
    }
  }

  out.sort((a, b) => b.urgency - a.urgency);
  return opts.limit ? out.slice(0, opts.limit) : out;
}

/** next untouched / weakest topics to actually learn (not revise) */
export function suggestNewTopics(
  subjects: SubjectDTO[],
  progressById: Map<number, ProgressDTO>,
  limit = 6,
): DueTopic[] {
  const out: DueTopic[] = [];
  for (const subject of subjects) {
    for (const unit of subject.units) {
      for (const topic of unit.topics) {
        const p = progressById.get(topic.id);
        if (p && p.mastery !== "not_started") continue;
        out.push({
          topic,
          unit,
          subject,
          progress: p,
          dueInDays: 0,
          urgency: topicWeight(topic, unit) + unit.weightage / 10,
          reason: `${Math.round(topicWeight(topic, unit))} marks`,
        });
      }
    }
  }
  out.sort((a, b) => b.urgency - a.urgency);
  return out.slice(0, limit);
}

/* --------------------------------------------------------------- streaks -- */

export function streakFromDays(dayKeys: Set<string>, now = new Date()): { current: number; best: number } {
  let current = 0;
  const cursor = new Date(now);
  // today not studied yet does not break the streak
  if (!dayKeys.has(toDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (dayKeys.has(toDayKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const sorted = [...dayKeys].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of sorted) {
    const d = fromDayKey(key);
    if (prev && Math.round(daysBetween(prev, d)) === 1) run += 1;
    else run = 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current) };
}
