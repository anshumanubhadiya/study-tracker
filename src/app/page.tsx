"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Heatmap, LineChart, Ring } from "@/components/charts";
import { Icon } from "@/components/Icons";
import { Card, Header, MasteryPill, Row, Section } from "@/components/ui";
import {
  buildTopicIndex,
  dailyMinutesSeries,
  daysUntil,
  fmtMinutes,
  minutesByDay,
  mySubjects,
  planForDate,
  progressMap,
  readinessRows,
  studiedMinutes,
  WEEKDAY_SHORT,
  weekDates,
} from "@/lib/derive";
import { dueQueue, overallReadiness, streakFromDays, toDayKey } from "@/lib/srs";
import { useApp } from "@/store/useApp";

export default function HomePage() {
  const router = useRouter();
  const state = useApp((s) => s.state);
  const startSession = useApp((s) => s.startSession);

  const view = useMemo(() => {
    if (!state) return null;
    const now = new Date();
    const pm = progressMap(state.progress);
    const index = buildTopicIndex(state.subjects);
    const rows = readinessRows(state, now);
    const examMap = new Map(state.exams.map((e) => [e.subjectId, e.examDay]));
    const due = dueQueue(mySubjects(state), pm, { now, examDays: examMap, limit: 5 });
    const days = new Set(state.sessions.filter((s) => s.minutes > 0).map((s) => s.day));
    const streak = streakFromDays(days, now);
    const today = planForDate(state, now);
    const todayMinutes = studiedMinutes(state, now);
    const nextExam = [...state.exams]
      .map((e) => ({ ...e, days: daysUntil(e.examDay, now) }))
      .filter((e) => e.days >= 0)
      .sort((a, b) => a.days - b.days)[0];

    return {
      now,
      index,
      rows,
      readiness: overallReadiness(rows),
      due,
      streak,
      today,
      todayMinutes,
      nextExam,
      subjectsById: new Map(state.subjects.map((s) => [s.id, s])),
      minutesMap: minutesByDay(state),
    };
  }, [state]);

  if (!state || !view) return null;
  const target = state.user.settings.dailyTargetMinutes;
  const firstName = state.user.name.split(" ")[0];
  const todayEntry = view.today.entries[0];
  const todaySubject = todayEntry ? view.subjectsById.get(todayEntry.subjectId) : undefined;
  const plannedTopics = (todayEntry?.topicIds ?? []).map((id) => view.index.get(id)).filter(Boolean);

  return (
    <>
      <Header
        title={`Hi, ${firstName}`}
        sub={view.now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        actions={
          <>
            <button className="iconbtn" onClick={() => router.push("/library/scan")} aria-label="Syllabus Scanner">
              <Icon name="scan" />
            </button>
            <button className="iconbtn" onClick={() => router.push("/settings")} aria-label="Settings">
              <Icon name="settings" />
            </button>
          </>
        }
      />

      {/* -------------------------------------------------------- week strip */}
      <Card>
        <div className="week">
          {weekDates(view.now).map((d) => {
            const key = toDayKey(d);
            const dayPlan = planForDate(state, d);
            const done = (view.minutesMap[key] ?? 0) > 0;
            const moved = dayPlan.movedFrom.length > 0 || dayPlan.movedAway;
            return (
              <button key={key} className={`wday ${key === toDayKey(view.now) ? "today" : ""}`} onClick={() => router.push("/plan")}>
                <div className="lbl">{WEEKDAY_SHORT[d.getDay()]}</div>
                <div className="num">{d.getDate()}</div>
                <div className={`dot ${done ? "done" : moved ? "ovr" : dayPlan.entries.length ? "plan" : ""}`} />
              </button>
            );
          })}
        </div>

        <button className="today-row" onClick={() => router.push("/session")}>
          <span style={{ minWidth: 0 }}>
            <span className="lbl2">{view.today.movedAway ? "Moved to another day" : "Today's plan"}</span>
            <span className="ttl ellip">
              {todaySubject ? todaySubject.name : "Rest day — pick any topic"}
            </span>
            {plannedTopics.length ? (
              <span className="t-foot muted ellip" style={{ display: "block", marginTop: 2 }}>
                {plannedTopics.map((t) => t!.topic.title).join(" · ")}
              </span>
            ) : null}
          </span>
          <span className="btn primary sm" style={{ flex: "none" }}>
            <Icon name="play" />
            Start
          </span>
        </button>
      </Card>

      <div className="cols">
        <div>
          {/* ---------------------------------------------------- readiness */}
          <Card>
            <h2>Exam readiness</h2>
            <div className="row" style={{ gap: 16 }}>
              <Ring value={view.readiness} sub="ready" />
              <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {view.rows.slice(0, 4).map((r) => (
                  <div key={r.subjectId}>
                    <div className="row between t-foot" style={{ marginBottom: 4 }}>
                      <span className="ellip">{r.name}</span>
                      <span className="muted">{r.readiness}%</span>
                    </div>
                    <span className="bar">
                      <i style={{ width: `${Math.max(2, r.readiness)}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="progline">
              <Icon name="info" />
              <span>
                Weighted by GTU marks and faded by the forgetting curve — a 14-mark unit you never opened costs more than a
                3-mark one.
              </span>
            </div>
          </Card>

          {/* -------------------------------------------------------- tiles */}
          <div className="tiles">
            <div className="tile">
              <div className="l">
                <Icon name="clock" /> Today
              </div>
              <div className="v">{fmtMinutes(view.todayMinutes)}</div>
              <div className="s">target {fmtMinutes(target)}</div>
            </div>
            <div className="tile">
              <div className="l">
                <Icon name="flame" /> Streak
              </div>
              <div className="v">{view.streak.current}d</div>
              <div className="s">best {view.streak.best}d</div>
            </div>
            <div className="tile">
              <div className="l">
                <Icon name="refresh" /> Revisions due
              </div>
              <div className="v">{view.due.length}</div>
              <div className="s">spaced repetition</div>
            </div>
            <div className="tile">
              <div className="l">
                <Icon name="flag" /> Next exam
              </div>
              <div className="v">{view.nextExam ? `${view.nextExam.days}d` : "—"}</div>
              <div className="s ellip">
                {view.nextExam ? view.subjectsById.get(view.nextExam.subjectId)?.name ?? "" : "set in Progress"}
              </div>
            </div>
          </div>
        </div>

        <div>
          {/* -------------------------------------------------------- chart */}
          <Card>
            <div className="row between" style={{ marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>Study minutes · 14 days</h2>
              <span className="tag acc">goal {target}m</span>
            </div>
            <LineChart points={dailyMinutesSeries(state, 14)} goal={target} />
          </Card>

          {/* ------------------------------------------------ revision queue */}
          <Section title="Due for revision" footer="Learning topics resurface after 3 / 7 / 15 days — sooner when confidence is low.">
            {view.due.length ? (
              view.due.map((d) => (
                <Row
                  key={d.topic.id}
                  icon="refresh"
                  tint={d.dueInDays < 0 ? "var(--orange)" : "var(--blue)"}
                  title={d.topic.title}
                  sub={`${d.subject.name} · Unit ${d.unit.number} · ${d.reason}`}
                  right={<MasteryPill mastery={d.progress?.mastery ?? "learning"} />}
                  onClick={() => {
                    startSession([d.topic.id], "pomodoro", state.user.settings.focusMinutes);
                    router.push("/session");
                  }}
                />
              ))
            ) : (
              <Row icon="check" tint="var(--green)" title="Nothing due right now" sub="Learn a new topic to keep the curve moving" />
            )}
          </Section>
        </div>
      </div>

      <Card>
        <h2>Study activity</h2>
        <Heatmap minutesByDay={view.minutesMap} />
      </Card>
    </>
  );
}
