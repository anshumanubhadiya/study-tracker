import { subjectReadiness, toDayKey, type ReadinessRow } from "./srs";
import type { AppState, PlanEntryDTO, ProgressDTO, SubjectDTO, TopicDTO, UnitDTO } from "./types";

export type TopicRef = { topic: TopicDTO; unit: UnitDTO; subject: SubjectDTO };

export function buildTopicIndex(subjects: SubjectDTO[]): Map<number, TopicRef> {
  const map = new Map<number, TopicRef>();
  for (const subject of subjects)
    for (const unit of subject.units) for (const topic of unit.topics) map.set(topic.id, { topic, unit, subject });
  return map;
}

export function progressMap(progress: ProgressDTO[]): Map<number, ProgressDTO> {
  return new Map(progress.map((p) => [p.topicId, p]));
}

export function minutesByDay(state: AppState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of state.sessions) out[s.day] = (out[s.day] ?? 0) + s.minutes;
  return out;
}

export function mySubjects(state: AppState): SubjectDTO[] {
  const sem = state.user.semester;
  const mine = state.subjects.filter((s) => s.semesterNumber === sem);
  return mine.length ? mine : state.subjects;
}

export function readinessRows(state: AppState, now = new Date()): ReadinessRow[] {
  const pm = progressMap(state.progress);
  return mySubjects(state)
    .map((s) => subjectReadiness(s, pm, now))
    .sort((a, b) => a.readiness - b.readiness);
}

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** the 7 dates of the week containing `ref` (weeks start on Monday) */
export function weekDates(ref = new Date()): Date[] {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  const diff = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/**
 * What is actually planned for a given date, after reschedules.
 * A day whose plan was moved away shows nothing; the destination day shows
 * both its own plan and the moved one — the weekly plan itself never changes.
 */
export function planForDate(state: AppState, date: Date): { entries: PlanEntryDTO[]; movedFrom: string[]; movedAway: boolean } {
  const key = toDayKey(date);
  const movedAway = state.overrides.some((o) => o.fromDay === key && o.toDay !== key);
  const incoming = state.overrides.filter((o) => o.toDay === key && o.fromDay !== key);

  const ownWeekday = date.getDay();
  const own = movedAway ? [] : state.plan.filter((p) => p.weekday === ownWeekday);
  const moved = incoming.flatMap((o) => {
    const d = new Date(o.fromDay);
    return state.plan.filter((p) => p.weekday === d.getDay());
  });

  return { entries: [...own, ...moved], movedFrom: incoming.map((o) => o.fromDay), movedAway };
}

export function studiedMinutes(state: AppState, date: Date): number {
  const key = toDayKey(date);
  return state.sessions.filter((s) => s.day === key).reduce((a, s) => a + s.minutes, 0);
}

export function daysUntil(day: string, now = new Date()): number {
  const target = new Date(`${day}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** rolling daily study minutes for the last N days */
export function dailyMinutesSeries(state: AppState, days = 14): { label: string; value: number }[] {
  const byDay = minutesByDay(state);
  const out: { label: string; value: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, value: byDay[toDayKey(d)] ?? 0 });
  }
  return out;
}

/** readiness recomputed at weekly checkpoints, so the curve shows a trend */
export function readinessSeries(state: AppState, weeks = 8): { label: string; value: number }[] {
  const subjects = mySubjects(state);
  const out: { label: string; value: number }[] = [];
  const today = new Date();

  for (let w = weeks - 1; w >= 0; w--) {
    const at = new Date(today);
    at.setDate(today.getDate() - w * 7);
    // rebuild progress as it stood at `at` from the session log
    const snapshot = new Map<number, ProgressDTO>();
    for (const s of state.sessions) {
      const when = new Date(s.startedAt);
      if (when > at) continue;
      for (const t of s.topics) {
        const prev = snapshot.get(t.topicId);
        snapshot.set(t.topicId, {
          topicId: t.topicId,
          mastery: t.masteryAfter,
          confidence: t.confidenceAfter,
          reviewCount: (prev?.reviewCount ?? 0) + 1,
          totalMinutes: (prev?.totalMinutes ?? 0) + t.minutes,
          lastStudiedAt: s.startedAt,
          nextReviewAt: null,
          stability: Math.min(30, (prev?.stability ?? 1.5) * 1.5),
        });
      }
    }
    const rows = subjects.map((s) => subjectReadiness(s, snapshot, at));
    const total = rows.reduce((a, r) => a + r.totalTopics, 0);
    const value = total ? Math.round(rows.reduce((a, r) => a + r.readiness * r.totalTopics, 0) / total) : 0;
    out.push({ label: `${at.getDate()}/${at.getMonth() + 1}`, value });
  }
  return out;
}
