"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { Card, Header, Row, Section, Seg, Sheet, Stepper, Switch } from "@/components/ui";
import { coachSuggestions, type Suggestion } from "@/lib/coach";
import { fmtMinutes } from "@/lib/derive";
import { useApp } from "@/store/useApp";

const ACCENTS = [
  ["lime", "#30d158"],
  ["sky", "#0a84ff"],
  ["orange", "#ff9f0a"],
  ["violet", "#bf5af2"],
  ["pink", "#ff375f"],
  ["red", "#ff453a"],
  ["teal", "#40c8e0"],
  ["gold", "#ffd60a"],
];

type Faculty = {
  optedIn: boolean;
  summary: { students: number; avg_minutes_per_day: number; avg_active_days: number };
  topSubjects: { name: string; minutes: number }[];
};

export default function SettingsPage() {
  const router = useRouter();
  const { state, saveSettings, planAction, importData, examAction, logout, setToast } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [coachOpen, setCoachOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [facultyOpen, setFacultyOpen] = useState(false);
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [record, setRecord] = useState({ label: "", marks: 0, outOf: 100, attendance: 75 });

  if (!state) return null;
  const s = state.user.settings;

  const set = (patch: Parameters<typeof saveSettings>[0]) => void saveSettings(patch).then(() => setToast("Saved"));

  async function exportJson() {
    const res = await fetch("/api/data");
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gtu-study-tracker-backup.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setToast("Backup downloaded");
  }

  async function importJson(file: File) {
    try {
      const payload = JSON.parse(await file.text());
      await importData(payload);
      setToast("Imported — nothing was overwritten, it merged");
    } catch {
      setToast("That file could not be read");
    }
  }

  async function enableNotifications(on: boolean) {
    if (on && typeof Notification !== "undefined") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setToast("Browser blocked notifications");
        return;
      }
      new Notification("Reminders on", { body: "Revision-due nudges, exam countdown and missed-session reminders." });
    }
    set({ settings: { notifications: on } });
  }

  return (
    <>
      <Header
        title="Settings"
        sub={state.user.isGuest ? "Guest profile — export before you leave" : state.user.email}
        actions={
          <button className="iconbtn" onClick={() => router.push("/")} aria-label="Close">
            <Icon name="close" />
          </button>
        }
      />

      <Section title="Profile">
        <Row icon="user" tint="var(--blue)" title={state.user.name} sub={state.user.email} />
        <Row
          icon="cap"
          tint="var(--purple)"
          title="Current semester"
          value={`Sem ${state.user.semester}`}
          right={
            <div className="chips" style={{ maxWidth: 190 }}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button key={n} className={`chip ${state.user.semester === n ? "on" : ""}`} onClick={() => set({ semester: n })}>
                  {n}
                </button>
              ))}
            </div>
          }
        />
      </Section>

      <Card>
        <h2>Appearance</h2>
        <Seg
          value={state.user.theme}
          onChange={(v) => set({ theme: v })}
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
        />
        <div className="divider" />
        <span className="sect-t">Accent</span>
        <div className="swatches">
          {ACCENTS.map(([name, color]) => (
            <button
              key={name}
              className={`swatch ${state.user.accent === name ? "on" : ""}`}
              style={{ background: color }}
              onClick={() => set({ accent: name })}
              aria-label={name}
            />
          ))}
        </div>
      </Card>

      <Section title="Study defaults" footer="These pre-fill every guided session. The screen stays awake only while a session is running.">
        <Row
          title="Daily target"
          sub="Goal line on the home chart"
          right={<div style={{ width: 150 }}><Stepper value={s.dailyTargetMinutes} step={15} min={30} max={480} suffix="m" onChange={(v) => set({ settings: { dailyTargetMinutes: v } })} /></div>}
        />
        <Row
          title="Focus block"
          right={<div style={{ width: 150 }}><Stepper value={s.focusMinutes} step={5} min={10} max={90} suffix="m" onChange={(v) => set({ settings: { focusMinutes: v } })} /></div>}
        />
        <Row
          title="Short break"
          right={<div style={{ width: 150 }}><Stepper value={s.breakMinutes} step={1} min={2} max={20} suffix="m" onChange={(v) => set({ settings: { breakMinutes: v } })} /></div>}
        />
        <Row
          title="Long break (every 4th)"
          right={<div style={{ width: 150 }}><Stepper value={s.longBreakMinutes} step={5} min={5} max={45} suffix="m" onChange={(v) => set({ settings: { longBreakMinutes: v } })} /></div>}
        />
        <Row title="Keep screen awake" sub="While a study session is running" right={<Switch on={s.keepAwake} onChange={(v) => set({ settings: { keepAwake: v } })} />} />
        <Row
          title="Push notifications"
          sub="Revision due, exam countdown, missed session"
          right={<Switch on={s.notifications} onChange={(v) => void enableNotifications(v)} />}
        />
      </Section>

      <Section title="Optional modules" footer="Both are off until you switch them on. Nothing leaves this server either way.">
        <Row
          icon="ai"
          tint="var(--purple)"
          title="AI Study Coach"
          sub={s.aiCoach ? "On · suggestions are explained and accepted one by one" : "Off by default · needs your consent"}
          right={<Switch on={s.aiCoach} onChange={(v) => set({ settings: { aiCoach: v } })} />}
        />
        {s.aiCoach ? (
          <Row
            icon="bolt"
            tint="var(--acc)"
            title="Review my plan now"
            sub="Reads readiness, adherence and exam dates"
            chevron
            onClick={() => {
              setSuggestions(coachSuggestions(state));
              setRejected([]);
              setCoachOpen(true);
            }}
          />
        ) : null}
        <Row
          icon="users"
          tint="var(--orange)"
          title="Faculty dashboard opt-in"
          sub="Share only anonymous class averages"
          right={<Switch on={s.facultyOptIn} onChange={(v) => set({ settings: { facultyOptIn: v } })} />}
        />
        <Row
          icon="chart"
          tint="var(--teal)"
          title="Open faculty view"
          sub="Class average study time, no names"
          chevron
          onClick={async () => {
            const res = await fetch("/api/faculty");
            setFaculty(await res.json());
            setFacultyOpen(true);
          }}
        />
      </Section>

      <Section title="Your data" footer="Guest mode, JSON export/import, no telemetry. Back up the file and you have backed up everything.">
        <Row icon="download" tint="var(--green)" title="Export JSON backup" chevron onClick={() => void exportJson()} />
        <Row icon="upload" tint="var(--blue)" title="Import backup or a shared plan" chevron onClick={() => fileRef.current?.click()} />
        <Row icon="doc" tint="var(--indigo)" title="Import past marks / attendance" sub="Gives the coach context" chevron onClick={() => setRecordOpen(true)} />
        <Row icon="printer" tint="var(--grey)" title="Print timetable" chevron onClick={() => router.push("/plan")} />
        <Row icon="logout" title="Sign out" danger chevron onClick={async () => { await logout(); router.replace("/login"); }} />
      </Section>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importJson(f);
        }}
      />

      <div className="sect-f center-t" style={{ marginBottom: 20 }}>
        GTU Study Tracker · openGym-style UI, GTU syllabus brain
      </div>

      {/* ---------------------------------------------------------- AI coach */}
      <Sheet open={coachOpen} title="Coach suggestions" onClose={() => setCoachOpen(false)}>
        <p className="t-sub muted" style={{ marginBottom: 14 }}>
          Every suggestion says why it exists. Accept the ones you agree with — nothing is applied until you tap Accept.
        </p>
        {suggestions.filter((x) => !rejected.includes(x.id)).length === 0 ? (
          <p className="t-sub muted">No changes worth making right now. Your plan matches what you are actually doing.</p>
        ) : null}
        {suggestions
          .filter((x) => !rejected.includes(x.id))
          .map((x) => (
            <Card key={x.id}>
              <div className="t-head" style={{ marginBottom: 6 }}>
                {x.title}
              </div>
              <p className="t-foot muted">{x.why}</p>
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <button
                  className="btn sm primary grow"
                  onClick={async () => {
                    if (x.apply) await planAction(x.apply);
                    setRejected((r) => [...r, x.id]);
                    setToast(x.apply ? "Applied to your weekly plan" : "Noted");
                  }}
                >
                  <Icon name="check" />
                  Accept
                </button>
                <button className="btn sm grow" onClick={() => setRejected((r) => [...r, x.id])}>
                  <Icon name="close" />
                  Reject
                </button>
              </div>
            </Card>
          ))}
      </Sheet>

      {/* ----------------------------------------------------- faculty sheet */}
      <Sheet open={facultyOpen} title="Faculty dashboard" onClose={() => setFacultyOpen(false)}>
        {faculty ? (
          <>
            <div className="tiles">
              <div className="tile">
                <div className="l">Opted-in students</div>
                <div className="v">{faculty.summary.students}</div>
              </div>
              <div className="tile">
                <div className="l">Avg / day</div>
                <div className="v">{fmtMinutes(Math.round(faculty.summary.avg_minutes_per_day || 0))}</div>
              </div>
            </div>
            <Section title="Where the class spends time (28 days)">
              {faculty.topSubjects.length ? (
                faculty.topSubjects.map((t) => <Row key={t.name} title={t.name} value={fmtMinutes(t.minutes)} />)
              ) : (
                <Row title="No opted-in data yet" sub="Students switch this on in their own settings" />
              )}
            </Section>
            <p className="t-foot muted">Aggregate only — no names, no per-student rows, and only profiles that opted in are counted.</p>
          </>
        ) : null}
      </Sheet>

      {/* ------------------------------------------------------ past records */}
      <Sheet open={recordOpen} title="Import past data" onClose={() => setRecordOpen(false)}>
        <input className="field" placeholder="Label — e.g. Sem 2 · OOP Unit Test" value={record.label} onChange={(e) => setRecord({ ...record, label: e.target.value })} style={{ marginBottom: 10 }} />
        <div className="row" style={{ gap: 10, marginBottom: 10 }}>
          <input className="field" type="number" placeholder="Marks" value={record.marks} onChange={(e) => setRecord({ ...record, marks: Number(e.target.value) })} />
          <input className="field" type="number" placeholder="Out of" value={record.outOf} onChange={(e) => setRecord({ ...record, outOf: Number(e.target.value) })} />
        </div>
        <input className="field" type="number" placeholder="Attendance %" value={record.attendance} onChange={(e) => setRecord({ ...record, attendance: Number(e.target.value) })} />
        <button
          className="btn primary"
          style={{ marginTop: 14 }}
          disabled={!record.label.trim()}
          onClick={async () => {
            await examAction({ action: "addRecord", ...record, semester: state.user.semester });
            setRecordOpen(false);
            setRecord({ label: "", marks: 0, outOf: 100, attendance: 75 });
            setToast("Past record imported");
          }}
        >
          <Icon name="check" />
          Save record
        </button>
      </Sheet>
    </>
  );
}
