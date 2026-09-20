"use client";

/* eslint-disable react-hooks/set-state-in-effect --
   A guided session IS a subscription to two external systems: the wall clock
   (the Pomodoro dial ticks from a setInterval) and the persisted session in the
   store (topics are pre-filled once the plan has loaded). Both legitimately
   write state from an effect; there is no render-time equivalent. */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ring } from "@/components/charts";
import { Icon } from "@/components/Icons";
import { Card, Header, MasteryPill, Row, Section, Seg, Sheet } from "@/components/ui";
import { buildTopicIndex, fmtMinutes, mySubjects, planForDate, progressMap } from "@/lib/derive";
import { dueQueue, suggestNewTopics } from "@/lib/srs";
import { MASTERY_LABEL, type Mastery } from "@/lib/types";
import { useApp, type ActiveTopicResult } from "@/store/useApp";

type WakeNav = Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };

function mmss(sec: number) {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${m}:${`${s}`.padStart(2, "0")}`;
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
    osc.start();
    osc.stop(ctx.currentTime + 0.95);
  } catch {
    /* audio blocked — the visual state is enough */
  }
}

export default function SessionPage() {
  const router = useRouter();
  const { state, active, startSession, updateActive, endSession, finishSession, setToast } = useApp();
  // the clock lives in state so rendering stays pure — the interval below is
  // the only thing that reads the wall clock
  const [now, setNow] = useState(0);
  const [logTopic, setLogTopic] = useState<number | null>(null);
  const [draftMastery, setDraftMastery] = useState<Mastery>("learning");
  const [draftConfidence, setDraftConfidence] = useState(3);
  const [finishOpen, setFinishOpen] = useState(false);
  const [focusQuality, setFocusQuality] = useState(4);
  const [notes, setNotes] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [kind, setKind] = useState<"pomodoro" | "long" | "combined">("pomodoro");
  const [focusMin, setFocusMin] = useState(25);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);

  const index = useMemo(() => (state ? buildTopicIndex(state.subjects) : new Map()), [state]);

  // pre-fill: today's planned topics, else the revision queue, else new topics
  useEffect(() => {
    if (!state || active || picked.length) return;
    const today = planForDate(state, new Date());
    const planned = today.entries.flatMap((e) => e.topicIds);
    if (planned.length) {
      setPicked(planned.slice(0, 3));
      return;
    }
    const pm = progressMap(state.progress);
    const due = dueQueue(mySubjects(state), pm, { limit: 2 });
    if (due.length) {
      setPicked(due.map((d) => d.topic.id));
      return;
    }
    setPicked(suggestNewTopics(mySubjects(state), pm, 2).map((d) => d.topic.id));
  }, [state, active, picked.length]);

  useEffect(() => {
    if (state) {
      setFocusMin(state.user.settings.focusMinutes);
    }
  }, [state]);

  // one tick drives the dial
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // keep the screen awake for as long as a session is running
  useEffect(() => {
    const nav = navigator as WakeNav;
    const wants = Boolean(active?.running && state?.user.settings.keepAwake);
    if (wants && nav.wakeLock && !wake.current) {
      nav.wakeLock
        .request("screen")
        .then((s) => (wake.current = s))
        .catch(() => {});
    }
    if (!wants && wake.current) {
      void wake.current.release().catch(() => {});
      wake.current = null;
    }
  }, [active?.running, state?.user.settings.keepAwake]);

  const remaining = active
    ? active.running
      ? now === 0
        ? active.phaseLength
        : Math.max(0, Math.round((active.phaseEndsAt - now) / 1000))
      : (active.pausedRemaining ?? active.phaseLength)
    : 0;

  const advance = useCallback(() => {
    if (!state || !active) return;
    beep();
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(active.phase === "focus" ? "Focus block done" : "Break over", {
        body: active.phase === "focus" ? "Log the topic and take a break." : "Back to it — next block is ready.",
      });
    }

    if (active.phase === "focus") {
      const minutes = active.minutes + Math.round(active.phaseLength / 60);
      const pomodoros = active.pomodoros + 1;
      const isCombined = active.kind === "combined";
      const hasNextInBlock = isCombined && active.index < active.topicIds.length - 1;

      if (hasNextInBlock) {
        // combined block: second topic runs back-to-back, break only after both
        const len = focusMin * 60;
        updateActive({
          minutes,
          pomodoros,
          index: active.index + 1,
          phase: "focus",
          phaseLength: len,
          phaseEndsAt: Date.now() + len * 1000,
          pausedRemaining: null,
        });
        setToast("Second topic of the combined block — no break yet");
        return;
      }

      const longEvery = pomodoros % 4 === 0;
      const len = (longEvery ? state.user.settings.longBreakMinutes : state.user.settings.breakMinutes) * 60;
      updateActive({
        minutes,
        pomodoros,
        phase: "break",
        phaseLength: len,
        phaseEndsAt: Date.now() + len * 1000,
        pausedRemaining: null,
      });
      setLogTopic(active.topicIds[active.index] ?? null);
    } else {
      const nextIndex = Math.min(active.topicIds.length - 1, active.index + 1);
      const len = focusMin * 60;
      updateActive({
        phase: "focus",
        index: nextIndex,
        phaseLength: len,
        phaseEndsAt: Date.now() + len * 1000,
        pausedRemaining: null,
      });
    }
  }, [active, state, focusMin, updateActive, setToast]);

  useEffect(() => {
    if (active?.running && remaining === 0) advance();
  }, [active?.running, remaining, advance]);

  if (!state) return null;
  const subjects = mySubjects(state);

  /* ------------------------------------------------------------ pre-start */
  if (!active) {
    const pm = progressMap(state.progress);
    const due = dueQueue(subjects, pm, { limit: 6 });
    const fresh = suggestNewTopics(subjects, pm, 6);
    const today = planForDate(state, new Date());
    const plannedIds = today.entries.flatMap((e) => e.topicIds);
    const pool = [
      ...plannedIds.map((id) => index.get(id)).filter(Boolean),
      ...due.map((d) => ({ topic: d.topic, unit: d.unit, subject: d.subject })),
      ...fresh.map((d) => ({ topic: d.topic, unit: d.unit, subject: d.subject })),
    ].filter((v, i, arr) => v && arr.findIndex((x) => x!.topic.id === v!.topic.id) === i);

    return (
      <>
        <Header title="Start Study Session" sub="It knows what day it is — today's plan is already loaded." />

        <Card>
          <h2>Session type</h2>
          <Seg
            value={kind}
            onChange={(v) => setKind(v)}
            options={[
              { value: "pomodoro", label: "Pomodoro" },
              { value: "combined", label: "Combined block" },
              { value: "long", label: "Long session" },
            ]}
          />
          <div className="progline" style={{ color: "var(--label-2)" }}>
            <Icon name="info" />
            <span>
              {kind === "pomodoro"
                ? `${focusMin} min focus, then a ${state.user.settings.breakMinutes} min break. Every 4th break is ${state.user.settings.longBreakMinutes} min.`
                : kind === "combined"
                  ? "Two related topics run back-to-back — the break comes only after both."
                  : "Assignments and practicals: one long block, logged with a focus-quality rating."}
            </span>
          </div>

          <div className="divider" />
          <span className="sect-t">Focus length</span>
          <div className="chips">
            {[15, 25, 45, 50, 90].map((m) => (
              <button key={m} className={`chip ${focusMin === m ? "on" : ""}`} onClick={() => setFocusMin(m)}>
                {m} min
              </button>
            ))}
          </div>
        </Card>

        <Section title={`Topics for this session · ${picked.length} picked`} footer="Pre-filled from today's plan and your revision queue — tap to change.">
          {pool.slice(0, 10).map((ref) => {
            const p = pm.get(ref!.topic.id);
            const on = picked.includes(ref!.topic.id);
            return (
              <Row
                key={ref!.topic.id}
                icon={on ? "check" : ref!.subject.icon}
                tint={on ? "var(--acc)" : "var(--surface-3)"}
                title={ref!.topic.title}
                sub={`${ref!.subject.name} · Unit ${ref!.unit.number} · ${ref!.topic.weightage} marks`}
                right={<MasteryPill mastery={p?.mastery ?? "not_started"} />}
                onClick={() => setPicked((prev) => (on ? prev.filter((x) => x !== ref!.topic.id) : [...prev, ref!.topic.id]))}
              />
            );
          })}
        </Section>

        <button
          className="btn primary"
          disabled={!picked.length}
          onClick={() => {
            startSession(picked, kind, kind === "long" ? Math.max(focusMin, 50) : focusMin);
            if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
            setToast("Session started — screen will stay awake");
          }}
        >
          <Icon name="play" />
          Start Study Session
        </button>
        <button className="btn ghost" onClick={() => router.push("/library")}>
          Pick a different topic from the library
        </button>
      </>
    );
  }

  /* ---------------------------------------------------------- in session */
  const currentId = active.topicIds[active.index];
  const current = index.get(currentId);
  const pct = active.phaseLength ? ((active.phaseLength - remaining) / active.phaseLength) * 100 : 0;
  const totalMinutes = active.minutes + (active.phase === "focus" ? Math.round((active.phaseLength - remaining) / 60) : 0);

  function logResult(topicId: number, mastery: Mastery, confidence: number) {
    if (!active) return;
    const results: ActiveTopicResult[] = [
      ...active.results.filter((r) => r.topicId !== topicId),
      { topicId, mastery, confidence, minutes: Math.round(active.phaseLength / 60) },
    ];
    updateActive({ results });
    setLogTopic(null);
    setToast(`${MASTERY_LABEL[mastery]} · confidence ${confidence}/5`);
  }

  async function finish() {
    if (!active || !state) return;
    const results = active.results.length
      ? active.results
      : active.topicIds.map((id) => ({ topicId: id, mastery: "learning" as Mastery, confidence: 3, minutes: totalMinutes }));
    await finishSession({
      kind: active.kind,
      minutes: Math.max(1, totalMinutes),
      focusQuality,
      pomodoros: active.pomodoros,
      notes,
      startedAt: active.startedAt,
      topics: results,
    });
    setFinishOpen(false);
    setToast(`Session logged · ${fmtMinutes(Math.max(1, totalMinutes))}`);
    router.push("/");
  }

  return (
    <>
      <Header
        title={active.phase === "focus" ? "Focus" : "Break"}
        sub={`${active.kind === "combined" ? "Combined block" : active.kind === "long" ? "Long session" : "Pomodoro"} · block ${
          active.index + 1
        } of ${active.topicIds.length}`}
        actions={
          <button className="iconbtn" onClick={() => setFinishOpen(true)} aria-label="Finish">
            <Icon name="check" />
          </button>
        }
      />

      <Card>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Ring value={pct} size={210} stroke={14} label={mmss(remaining)} sub={active.phase === "focus" ? "focus" : "break"} />
        </div>

        {current ? (
          <div className="today-row" style={{ marginTop: 4 }}>
            <span style={{ minWidth: 0 }}>
              <span className="lbl2">{current.subject.name}</span>
              <span className="ttl ellip">{current.topic.title}</span>
              <span className="t-foot muted">
                Unit {current.unit.number} · {current.topic.weightage} marks
              </span>
            </span>
            <MasteryPill mastery={active.results.find((r) => r.topicId === current.topic.id)?.mastery ?? "learning"} />
          </div>
        ) : null}

        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <button
            className="btn sm grow"
            onClick={() =>
              active.running
                ? updateActive({ running: false, pausedRemaining: remaining })
                : updateActive({ running: true, phaseEndsAt: Date.now() + (active.pausedRemaining ?? 0) * 1000, pausedRemaining: null })
            }
          >
            <Icon name={active.running ? "pause" : "play"} />
            {active.running ? "Pause" : "Resume"}
          </button>
          <button
            className="btn sm grow"
            onClick={() =>
              updateActive({
                phaseEndsAt: (active.running ? active.phaseEndsAt : Date.now() + (active.pausedRemaining ?? 0) * 1000) + 300000,
                phaseLength: active.phaseLength + 300,
                pausedRemaining: active.running ? null : (active.pausedRemaining ?? 0) + 300,
              })
            }
          >
            <Icon name="plus" />5 min
          </button>
          <button className="btn sm grow tinted" onClick={advance}>
            <Icon name="chevron" />
            {active.phase === "focus" ? "End block" : "Skip break"}
          </button>
        </div>
      </Card>

      <div className="tiles">
        <div className="tile">
          <div className="l">
            <Icon name="clock" /> Logged
          </div>
          <div className="v">{fmtMinutes(totalMinutes)}</div>
        </div>
        <div className="tile">
          <div className="l">
            <Icon name="target" /> Blocks done
          </div>
          <div className="v">{active.pomodoros}</div>
        </div>
      </div>

      <Section title="Topics in this session" footer="Rate each topic when its block ends — that rating drives when it comes back.">
        {active.topicIds.map((id, i) => {
          const ref = index.get(id);
          const res = active.results.find((r) => r.topicId === id);
          if (!ref) return null;
          return (
            <Row
              key={id}
              icon={i === active.index ? "play" : res ? "check" : ref.subject.icon}
              tint={i === active.index ? "var(--acc)" : res ? "var(--green)" : "var(--surface-3)"}
              title={ref.topic.title}
              sub={res ? `${MASTERY_LABEL[res.mastery]} · confidence ${res.confidence}/5` : ref.subject.name}
              chevron
              onClick={() => {
                setLogTopic(id);
                setDraftMastery(res?.mastery ?? "learning");
                setDraftConfidence(res?.confidence ?? 3);
              }}
            />
          );
        })}
      </Section>

      <button className="btn primary" onClick={() => setFinishOpen(true)}>
        <Icon name="check" />
        Finish session
      </button>
      <button
        className="btn ghost"
        onClick={() => {
          endSession();
          setToast("Session discarded");
        }}
      >
        Discard
      </button>

      {/* --------------------------------------------------------- log sheet */}
      <Sheet open={logTopic !== null} title="How did that go?" onClose={() => setLogTopic(null)}>
        {logTopic !== null && index.get(logTopic) ? (
          <>
            <div className="t-head" style={{ marginBottom: 4 }}>
              {index.get(logTopic)!.topic.title}
            </div>
            <div className="t-foot muted" style={{ marginBottom: 16 }}>
              {index.get(logTopic)!.subject.name} · Unit {index.get(logTopic)!.unit.number}
            </div>

            <span className="sect-t">Mastery level</span>
            <div className="sect-b" style={{ marginBottom: 16 }}>
              {(["learning", "revised", "exam_ready"] as Mastery[]).map((m) => (
                <Row
                  key={m}
                  title={MASTERY_LABEL[m]}
                  sub={
                    m === "learning"
                      ? "First pass — comes back in ~3 days"
                      : m === "revised"
                        ? "Second pass — comes back in ~7 days"
                        : "Confident — comes back in ~15 days"
                  }
                  onClick={() => setDraftMastery(m)}
                  right={draftMastery === m ? <Icon name="check" className="lrow-c" style={{ color: "var(--acc)" }} /> : undefined}
                />
              ))}
            </div>

            <span className="sect-t">Confidence</span>
            <div className="conf" style={{ marginBottom: 18 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={draftConfidence === n ? "on" : ""} onClick={() => setDraftConfidence(n)}>
                  {n}
                </button>
              ))}
            </div>

            <button className="btn primary" onClick={() => logResult(logTopic, draftMastery, draftConfidence)}>
              <Icon name="check" />
              Save rating
            </button>
          </>
        ) : null}
      </Sheet>

      {/* ------------------------------------------------------ finish sheet */}
      <Sheet open={finishOpen} title="Finish session" onClose={() => setFinishOpen(false)}>
        <div className="tiles">
          <div className="tile">
            <div className="l">Time</div>
            <div className="v">{fmtMinutes(Math.max(1, totalMinutes))}</div>
          </div>
          <div className="tile">
            <div className="l">Topics</div>
            <div className="v">{active.topicIds.length}</div>
          </div>
        </div>

        <span className="sect-t">Focus quality</span>
        <div className="conf" style={{ marginBottom: 16 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={focusQuality === n ? "on" : ""} onClick={() => setFocusQuality(n)}>
              {n}
            </button>
          ))}
        </div>

        <textarea className="field" placeholder="Notes (optional) — doubts, page numbers, what to revise next" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <button className="btn primary" style={{ marginTop: 14 }} onClick={() => void finish()}>
          <Icon name="check" />
          Save session
        </button>
      </Sheet>
    </>
  );
}
