"use client";

import { useMemo, useState } from "react";
import { Bars, Heatmap, LineChart, Ring } from "@/components/charts";
import { Icon } from "@/components/Icons";
import { Card, Header, Row, Section, Sheet } from "@/components/ui";
import {
  daysUntil,
  dailyMinutesSeries,
  fmtMinutes,
  minutesByDay,
  mySubjects,
  progressMap,
  readinessRows,
  readinessSeries,
  WEEKDAY_SHORT,
  weekDates,
} from "@/lib/derive";
import { effectiveScore, overallReadiness, streakFromDays, toDayKey } from "@/lib/srs";
import { useApp } from "@/store/useApp";

export default function ProgressPage() {
  const { state, examAction, setToast } = useApp();
  const [examSubject, setExamSubject] = useState<number | null>(null);
  const [examDay, setExamDay] = useState("");

  const view = useMemo(() => {
    if (!state) return null;
    const pm = progressMap(state.progress);
    const rows = readinessRows(state);
    const subjects = mySubjects(state);
    const days = new Set(state.sessions.filter((s) => s.minutes > 0).map((s) => s.day));
    const totalMinutes = state.sessions.reduce((a, s) => a + s.minutes, 0);
    const examReady = state.progress.filter((p) => p.mastery === "exam_ready").length;
    const allTopics = subjects.reduce((a, s) => a + s.units.reduce((b, u) => b + u.topics.length, 0), 0);
    return {
      pm,
      rows,
      subjects,
      streak: streakFromDays(days),
      totalMinutes,
      examReady,
      allTopics,
      readiness: overallReadiness(rows),
      minutesMap: minutesByDay(state),
    };
  }, [state]);

  if (!state || !view) return null;
  const examMap = new Map(state.exams.map((e) => [e.subjectId, e.examDay]));

  const weekBars = weekDates().map((d) => ({
    label: WEEKDAY_SHORT[d.getDay()],
    value: view.minutesMap[toDayKey(d)] ?? 0,
  }));

  return (
    <>
      <Header title="Progress" sub="Readiness, coverage and everything you have logged" />

      <Card>
        <div className="row" style={{ gap: 16 }}>
          <Ring value={view.readiness} sub="exam ready" />
          <div className="grow">
            <div className="t-head">Overall readiness</div>
            <p className="t-foot muted" style={{ marginTop: 4 }}>
              Mastery × exam-marks weightage, faded by the forgetting curve. It goes down if you stop revising — that is the point.
            </p>
            <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <span className="tag">{view.examReady} exam-ready topics</span>
              <span className="tag">{view.allTopics} in syllabus</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="tiles">
        <div className="tile">
          <div className="l">
            <Icon name="clock" /> Total logged
          </div>
          <div className="v">{fmtMinutes(view.totalMinutes)}</div>
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
            <Icon name="target" /> Sessions
          </div>
          <div className="v">{state.sessions.length}</div>
        </div>
        <div className="tile">
          <div className="l">
            <Icon name="brain" /> Avg focus
          </div>
          <div className="v">
            {state.sessions.length
              ? (state.sessions.reduce((a, s) => a + s.focusQuality, 0) / state.sessions.length).toFixed(1)
              : "—"}
          </div>
          <div className="s">out of 5</div>
        </div>
      </div>

      <div className="cols">
        <div>
          <Card>
            <h2>Readiness curve · 8 weeks</h2>
            <LineChart points={readinessSeries(state, 8)} unit="%" goal={80} />
          </Card>

          <Card>
            <h2>This week</h2>
            <Bars points={weekBars} />
          </Card>
        </div>

        <div>
          <Card>
            <h2>Study minutes · 30 days</h2>
            <LineChart points={dailyMinutesSeries(state, 30)} goal={state.user.settings.dailyTargetMinutes} />
          </Card>

          <Section title="Subject readiness" footer="Tap a subject to set its exam date — the closer it is, the harder its topics push in the queue.">
            {view.rows.length === 0 ? (
              <Row
                icon="scan"
                tint="var(--blue)"
                title={`No subjects in Semester ${state.user.semester} yet`}
                sub="Add your syllabus in the Library — readiness appears here the moment you log progress"
              />
            ) : null}
            {view.rows.map((r) => (
              <Row
                key={r.subjectId}
                title={r.name}
                sub={`${r.coverage}% covered · ${r.weakTopics} weak · ${r.dueTopics} due${
                  examMap.get(r.subjectId) ? ` · exam in ${daysUntil(examMap.get(r.subjectId)!)}d` : ""
                }`}
                value={`${r.readiness}%`}
                chevron
                onClick={() => {
                  setExamSubject(r.subjectId);
                  setExamDay(examMap.get(r.subjectId) ?? "");
                }}
              />
            ))}
          </Section>
        </div>
      </div>

      {/* ------------------------------------------------------- coverage map */}
      <Card>
        <h2>Subject / unit coverage map</h2>
        <p className="t-foot muted" style={{ marginBottom: 12 }}>
          One cell per unit, shaded by how much of it is actually in your head. Outlined cells are untouched.
        </p>
        {view.subjects.map((s) => (
          <div key={s.id} style={{ marginBottom: 14 }}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="t-foot ellip">{s.name}</span>
              <span className="t-cap dim">{s.units.length} units</span>
            </div>
            <div className="cov">
              {s.units.map((u) => {
                const scores = u.topics.map((t) => effectiveScore(view.pm.get(t.id)));
                const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
                const level = avg === 0 ? "warn" : avg < 0.3 ? "l1" : avg < 0.55 ? "l2" : avg < 0.8 ? "l3" : "l4";
                return (
                  <div key={u.id} className={`cov-c ${level}`} title={`${u.title} · ${Math.round(avg * 100)}%`}>
                    {u.number}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </Card>

      <Card>
        <h2>Study heatmap · 12 months</h2>
        <Heatmap minutesByDay={view.minutesMap} />
      </Card>

      {state.pastRecords.length ? (
        <Section title="Imported past data" footer="Old marks and attendance give the coach context about where you usually slip.">
          {state.pastRecords.map((r) => (
            <Row
              key={r.id}
              icon="doc"
              tint="var(--indigo)"
              title={r.label}
              sub={`Attendance ${r.attendance}%`}
              value={`${Math.round((r.marks / r.outOf) * 100)}%`}
            />
          ))}
        </Section>
      ) : null}

      <Sheet open={examSubject !== null} title="Exam date" onClose={() => setExamSubject(null)}>
        <p className="t-sub muted" style={{ marginBottom: 14 }}>
          {state.subjects.find((s) => s.id === examSubject)?.name}
        </p>
        <input className="field" type="date" value={examDay} onChange={(e) => setExamDay(e.target.value)} />
        <button
          className="btn primary"
          style={{ marginTop: 14 }}
          disabled={!examDay}
          onClick={async () => {
            await examAction({ action: "setExam", subjectId: examSubject, examDay });
            setExamSubject(null);
            setToast("Exam date saved — countdown started");
          }}
        >
          <Icon name="check" />
          Save exam date
        </button>
        <button
          className="btn danger"
          onClick={async () => {
            await examAction({ action: "clearExam", subjectId: examSubject });
            setExamSubject(null);
          }}
        >
          Remove
        </button>
      </Sheet>
    </>
  );
}
