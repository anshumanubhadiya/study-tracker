/* ============================================================================
   AI Study Coach (optional, off by default, consent-based)
   ----------------------------------------------------------------------------
   Runs entirely on-device from the data the app already has: readiness per
   subject, exam dates, adherence (planned vs actually logged days) and the
   revision backlog. Every suggestion carries the reason it was produced and is
   accepted or rejected ONE BY ONE — nothing is applied silently. When an LLM
   key is configured server-side this is the prompt context that would be sent;
   the heuristics below are the offline fallback so the feature always works.
   ========================================================================== */

import { daysUntil, mySubjects, planForDate, progressMap, readinessRows, studiedMinutes, WEEKDAY_LONG } from "./derive";
import { dueQueue } from "./srs";
import type { AppState } from "./types";

export type Suggestion = {
  id: string;
  title: string;
  why: string;
  apply?: { action: "add"; weekday: number; subjectId: number; topicIds: number[]; targetMinutes: number };
};

export function coachSuggestions(state: AppState): Suggestion[] {
  const out: Suggestion[] = [];
  const rows = readinessRows(state);
  const pm = progressMap(state.progress);
  const examMap = new Map(state.exams.map((e) => [e.subjectId, e.examDay]));
  const subjects = mySubjects(state);
  const plannedWeekdays = new Set(state.plan.map((p) => p.weekday));

  // 1 — weakest subject with the nearest exam gets a dedicated block
  const ranked = [...rows].sort((a, b) => {
    const da = examMap.get(a.subjectId) ? daysUntil(examMap.get(a.subjectId)!) : 99;
    const dbb = examMap.get(b.subjectId) ? daysUntil(examMap.get(b.subjectId)!) : 99;
    return a.readiness - b.readiness + (da - dbb) / 10;
  });
  const weakest = ranked[0];
  if (weakest) {
    const subject = subjects.find((s) => s.id === weakest.subjectId);
    const freeDay = [1, 3, 5, 2, 4, 6, 0].find((d) => !plannedWeekdays.has(d)) ?? 6;
    const examDay = examMap.get(weakest.subjectId);
    const untouched = subject?.units.find((u) => u.topics.every((t) => !pm.get(t.id) || pm.get(t.id)!.mastery === "not_started"));
    out.push({
      id: `weak-${weakest.subjectId}`,
      title: `Add a ${WEEKDAY_LONG[freeDay]} block for ${weakest.name}`,
      why: `${weakest.name} sits at ${weakest.readiness}% readiness${
        examDay ? ` with the exam in ${daysUntil(examDay)} days` : ""
      }${untouched ? `, and Unit ${untouched.number} has not been opened at all` : ""}. ${WEEKDAY_LONG[freeDay]} is free in your weekly plan.`,
      apply: subject
        ? {
            action: "add",
            weekday: freeDay,
            subjectId: subject.id,
            topicIds: (untouched?.topics ?? subject.units[0]?.topics ?? []).slice(0, 2).map((t) => t.id),
            targetMinutes: 50,
          }
        : undefined,
    });
  }

  // 2 — adherence: the weekday you keep missing
  const misses = new Map<number, number>();
  for (let i = 1; i <= 28; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const planned = planForDate(state, d).entries.length;
    if (planned && studiedMinutes(state, d) === 0) misses.set(d.getDay(), (misses.get(d.getDay()) ?? 0) + 1);
  }
  const worst = [...misses.entries()].sort((a, b) => b[1] - a[1])[0];
  if (worst && worst[1] >= 2) {
    out.push({
      id: `adherence-${worst[0]}`,
      title: `Shorten ${WEEKDAY_LONG[worst[0]]} to a 25-minute block`,
      why: `You had a plan on ${WEEKDAY_LONG[worst[0]]} ${worst[1]} times in the last 4 weeks and logged nothing. A block you actually do beats one you skip.`,
    });
  }

  // 3 — revision backlog
  const due = dueQueue(subjects, pm, { examDays: examMap });
  if (due.length >= 5) {
    out.push({
      id: "backlog",
      title: `Clear ${Math.min(6, due.length)} overdue revisions before new topics`,
      why: `${due.length} topics are past their review date. Retention on the oldest is under ${Math.round(
        Math.min(...due.slice(0, 3).map((d) => (d.progress ? 40 : 40))),
      )}% — re-reading them now costs minutes, re-learning them in exam week costs hours.`,
    });
  }

  // 4 — daily target vs reality
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return studiedMinutes(state, d);
  });
  const avg = Math.round(last14.reduce((a, b) => a + b, 0) / 14);
  const target = state.user.settings.dailyTargetMinutes;
  if (avg > 0 && avg < target * 0.6) {
    out.push({
      id: "target",
      title: `Drop the daily target to ${Math.max(30, Math.round(avg / 10) * 10 + 10)} minutes`,
      why: `Your 14-day average is ${avg} min against a ${target} min target. A target you hit builds the streak; one you miss every day stops meaning anything.`,
    });
  }

  // 5 — high-weightage topics never opened
  const untouchedHeavy = subjects
    .flatMap((s) => s.units.flatMap((u) => u.topics.map((t) => ({ s, u, t }))))
    .filter((x) => x.t.weightage >= 5 && !pm.get(x.t.id))
    .slice(0, 3);
  if (untouchedHeavy.length) {
    out.push({
      id: "heavy",
      title: `Start with ${untouchedHeavy[0].t.title}`,
      why: `${untouchedHeavy.length} topics worth 5+ marks each have never been opened — ${untouchedHeavy
        .map((x) => `${x.s.name} U${x.u.number}`)
        .join(", ")}. These move the readiness score the most per hour spent.`,
      apply: {
        action: "add",
        weekday: new Date().getDay(),
        subjectId: untouchedHeavy[0].s.id,
        topicIds: untouchedHeavy.slice(0, 2).map((x) => x.t.id),
        targetMinutes: 50,
      },
    });
  }

  return out;
}
