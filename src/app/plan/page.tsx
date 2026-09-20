"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icons";
import { Card, Header, Row, Section, Sheet, Stepper } from "@/components/ui";
import {
  buildTopicIndex,
  fmtMinutes,
  mySubjects,
  planForDate,
  studiedMinutes,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  weekDates,
} from "@/lib/derive";
import { toDayKey } from "@/lib/srs";
import { useApp } from "@/store/useApp";

export default function PlanPage() {
  const { state, planAction, setToast } = useApp();
  const [selected, setSelected] = useState(() => toDayKey(new Date()));
  const [addOpen, setAddOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  const [draftSubject, setDraftSubject] = useState<number | null>(null);
  const [draftTopics, setDraftTopics] = useState<number[]>([]);
  const [draftMinutes, setDraftMinutes] = useState(50);
  const [draftWeekday, setDraftWeekday] = useState(new Date().getDay());

  const index = useMemo(() => (state ? buildTopicIndex(state.subjects) : new Map()), [state]);
  const subjects = useMemo(() => (state ? mySubjects(state) : []), [state]);

  if (!state) return null;

  const base = new Date();
  base.setDate(base.getDate() + weekOffset * 7);
  const dates = weekDates(base);
  const selectedDate = new Date(`${selected}T00:00:00`);
  const dayPlan = planForDate(state, selectedDate);
  const subjectsById = new Map(state.subjects.map((s) => [s.id, s]));

  async function addEntry() {
    if (!draftSubject) return;
    await planAction({
      action: "add",
      weekday: draftWeekday,
      subjectId: draftSubject,
      topicIds: draftTopics,
      targetMinutes: draftMinutes,
    });
    setAddOpen(false);
    setDraftTopics([]);
    setToast("Added to the weekly plan");
  }

  async function move(toDay: string | null) {
    await planAction({ action: "reschedule", fromDay: selected, toDay });
    setMoveOpen(false);
    setToast(toDay ? `Moved to ${new Date(`${toDay}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" })}` : "Day skipped");
  }

  function sharePlan() {
    const payload = {
      app: "gtu-study-tracker",
      kind: "study-plan",
      semester: state!.user.semester,
      plan: state!.plan.map((p) => ({
        weekday: p.weekday,
        subject: subjectsById.get(p.subjectId)?.name ?? "",
        subjectId: p.subjectId,
        topicIds: p.topicIds,
        targetMinutes: p.targetMinutes,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gtu-study-plan-sem${state!.user.semester}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setToast("Plan file saved — send it to a classmate");
  }

  const weeklyMinutes = state.plan.reduce((a, p) => a + p.targetMinutes, 0);

  return (
    <>
      <Header
        title="Weekly Plan"
        sub={`${state.plan.length} blocks · ${fmtMinutes(weeklyMinutes)} planned per week`}
        actions={
          <>
            <button className="iconbtn" onClick={sharePlan} aria-label="Share plan">
              <Icon name="share" />
            </button>
            <button className="iconbtn" onClick={() => window.print()} aria-label="Print timetable">
              <Icon name="printer" />
            </button>
          </>
        }
      />

      <Card>
        <div className="row between" style={{ marginBottom: 6 }}>
          <button className="iconbtn" onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Previous week">
            <Icon name="back" />
          </button>
          <span className="t-foot muted">
            {dates[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })} –{" "}
            {dates[6].toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          </span>
          <button className="iconbtn" onClick={() => setWeekOffset(weekOffset + 1)} aria-label="Next week">
            <Icon name="chevron" />
          </button>
        </div>
        <div className="week">
          {dates.map((d) => {
            const key = toDayKey(d);
            const p = planForDate(state, d);
            const done = studiedMinutes(state, d) > 0;
            return (
              <button
                key={key}
                className={`wday ${key === toDayKey(new Date()) ? "today" : ""} ${key === selected ? "sel" : ""}`}
                onClick={() => setSelected(key)}
              >
                <div className="lbl">{WEEKDAY_SHORT[d.getDay()]}</div>
                <div className="num">{d.getDate()}</div>
                <div className={`dot ${done ? "done" : p.movedFrom.length || p.movedAway ? "ovr" : p.entries.length ? "plan" : ""}`} />
              </button>
            );
          })}
        </div>
      </Card>

      <Section
        title={`${selectedDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}${
          dayPlan.movedAway ? " · moved away" : ""
        }`}
        footer="Sick day or a busy shift? Move the whole day — your weekly plan stays exactly as it is."
      >
        {dayPlan.entries.length ? (
          dayPlan.entries.map((e) => {
            const subject = subjectsById.get(e.subjectId);
            const topicNames = e.topicIds.map((id) => index.get(id)?.topic.title).filter(Boolean);
            return (
              <Row
                key={`${e.id}-${e.weekday}`}
                icon={subject?.icon ?? "book"}
                tint="var(--acc)"
                title={subject?.name ?? "Subject"}
                sub={topicNames.length ? topicNames.join(" · ") : `${fmtMinutes(e.targetMinutes)} block`}
                value={fmtMinutes(e.targetMinutes)}
              />
            );
          })
        ) : (
          <Row icon="coffee" tint="var(--grey)" title="Nothing planned" sub="A rest day is part of the plan too" />
        )}
        <Row icon="calendar" tint="var(--orange)" title="Reschedule this day" sub="Move it without touching the weekly plan" chevron onClick={() => setMoveOpen(true)} />
      </Section>

      {WEEKDAY_LONG.map((label, weekday) => {
        const entries = state.plan.filter((p) => p.weekday === weekday);
        return (
          <Section key={label} title={label}>
            {entries.length ? (
              entries.map((e) => {
                const subject = subjectsById.get(e.subjectId);
                const topicNames = e.topicIds.map((id) => index.get(id)?.topic.title).filter(Boolean);
                return (
                  <Row
                    key={e.id}
                    icon={subject?.icon ?? "book"}
                    tint="var(--blue)"
                    title={subject?.name ?? "Subject"}
                    sub={topicNames.length ? topicNames.join(" · ") : "No topics pinned"}
                    value={fmtMinutes(e.targetMinutes)}
                    right={
                      <button
                        className="iconbtn"
                        style={{ width: 28, height: 28, fontSize: 14 }}
                        onClick={() => void planAction({ action: "delete", id: e.id })}
                        aria-label="Remove"
                      >
                        <Icon name="trash" />
                      </button>
                    }
                  />
                );
              })
            ) : (
              <Row
                icon="plus"
                tint="var(--surface-3)"
                title="Add a study block"
                sub="Subject + topics for this weekday"
                chevron
                onClick={() => {
                  setDraftWeekday(weekday);
                  setDraftSubject(subjects[0]?.id ?? null);
                  setAddOpen(true);
                }}
              />
            )}
          </Section>
        );
      })}

      <button
        className="btn primary"
        onClick={() => {
          setDraftWeekday(new Date().getDay());
          setDraftSubject(subjects[0]?.id ?? null);
          setAddOpen(true);
        }}
      >
        <Icon name="plus" />
        Add study block
      </button>

      {/* --------------------------------------------------------- add sheet */}
      <Sheet open={addOpen} title="Add study block" onClose={() => setAddOpen(false)}>
        <span className="sect-t">Weekday</span>
        <div className="chips" style={{ marginBottom: 14 }}>
          {WEEKDAY_SHORT.map((d, i) => (
            <button key={d} className={`chip ${draftWeekday === i ? "on" : ""}`} onClick={() => setDraftWeekday(i)}>
              {d}
            </button>
          ))}
        </div>

        <span className="sect-t">Subject</span>
        <div className="chips" style={{ marginBottom: 14 }}>
          {subjects.map((s) => (
            <button
              key={s.id}
              className={`chip ${draftSubject === s.id ? "on" : ""}`}
              onClick={() => {
                setDraftSubject(s.id);
                setDraftTopics([]);
              }}
            >
              {s.name}
            </button>
          ))}
        </div>

        <span className="sect-t">Topics (optional)</span>
        <div className="sect-b" style={{ maxHeight: 260, overflowY: "auto", marginBottom: 14 }}>
          {subjects
            .find((s) => s.id === draftSubject)
            ?.units.flatMap((u) =>
              u.topics.map((t) => (
                <Row
                  key={t.id}
                  title={t.title}
                  sub={`Unit ${u.number} · ${t.weightage} marks`}
                  onClick={() =>
                    setDraftTopics((prev) => (prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]))
                  }
                  right={draftTopics.includes(t.id) ? <Icon name="check" className="lrow-c" style={{ color: "var(--acc)" }} /> : undefined}
                />
              )),
            )}
        </div>

        <div className="row between" style={{ marginBottom: 16 }}>
          <span className="t-sub muted">Target minutes</span>
          <div style={{ width: 150 }}>
            <Stepper value={draftMinutes} step={5} min={10} max={240} suffix="m" onChange={setDraftMinutes} />
          </div>
        </div>

        <button className="btn primary" onClick={() => void addEntry()} disabled={!draftSubject}>
          <Icon name="check" />
          Add to {WEEKDAY_LONG[draftWeekday]}
        </button>
      </Sheet>

      {/* ---------------------------------------------------- reschedule sheet */}
      <Sheet open={moveOpen} title="Move this day" onClose={() => setMoveOpen(false)}>
        <div className="sect-b" style={{ marginBottom: 14 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(selectedDate);
            d.setDate(d.getDate() + i + 1);
            return (
              <Row
                key={toDayKey(d)}
                icon="calendar"
                tint="var(--blue)"
                title={d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
                chevron
                onClick={() => void move(toDayKey(d))}
              />
            );
          })}
        </div>
        <button className="btn danger" onClick={() => void move(null)}>
          <Icon name="close" />
          Skip this day entirely
        </button>
      </Sheet>
    </>
  );
}
