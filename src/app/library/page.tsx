"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icons";
import { Card, Empty, Header, MasteryPill, Row, Section, Sheet } from "@/components/ui";
import { daysUntil, fmtMinutes, progressMap } from "@/lib/derive";
import { effectiveScore, retention, subjectReadiness, topicWeight } from "@/lib/srs";
import { MASTERY_LABEL, type Mastery, type SubjectDTO } from "@/lib/types";
import { useApp } from "@/store/useApp";

type Filter = "all" | "high" | "weak" | "new" | "exam";

export default function LibraryPage() {
  const router = useRouter();
  const { state, libraryAction, logProgress, startSession, setToast } = useApp();
  const [semester, setSemester] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openSubject, setOpenSubject] = useState<number | null>(null);
  const [topicSheet, setTopicSheet] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newTopics, setNewTopics] = useState("");

  const pm = useMemo(() => (state ? progressMap(state.progress) : new Map()), [state]);
  if (!state) return null;

  const sem = semester ?? state.user.semester;
  const examMap = new Map(state.exams.map((e) => [e.subjectId, e.examDay]));
  const subjects = state.subjects.filter((s) => s.semesterNumber === sem);

  const matches = (s: SubjectDTO) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.units.some((u) => u.title.toLowerCase().includes(q) || u.topics.some((t) => t.title.toLowerCase().includes(q)))
    );
  };

  const topicPasses = (subjectId: number, weight: number, topicId: number) => {
    const p = pm.get(topicId);
    if (filter === "high") return weight >= 4;
    if (filter === "weak") return Boolean(p && p.mastery !== "not_started" && (p.confidence <= 2 || retention(p) < 0.5));
    if (filter === "new") return !p || p.mastery === "not_started";
    if (filter === "exam") {
      const day = examMap.get(subjectId);
      return Boolean(day && daysUntil(day) <= 21);
    }
    return true;
  };

  const shown = subjects.filter(matches);
  const topicRef = topicSheet
    ? (() => {
        for (const s of state.subjects)
          for (const u of s.units) for (const t of u.topics) if (t.id === topicSheet) return { subject: s, unit: u, topic: t };
        return null;
      })()
    : null;

  async function quickSet(topicId: number, mastery: Mastery, confidence: number) {
    await logProgress({ topicId, mastery, confidence });
    setToast(`${MASTERY_LABEL[mastery]} · next review scheduled`);
  }

  async function addCustomSubject() {
    if (!newSubject.trim()) return;
    const topics = newTopics
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => ({ title: t, weightage: 0 }));
    await libraryAction({
      action: "import",
      parsed: {
        subject: newSubject.trim(),
        code: "",
        semester: sem,
        credits: 4,
        units: [{ number: 1, title: newUnit.trim() || "Unit 1", weightage: topics.length * 3, topics }],
      },
      fileName: "manual-entry",
    });
    setAddOpen(false);
    setNewSubject("");
    setNewUnit("");
    setNewTopics("");
    setToast("Subject added to the library");
  }

  return (
    <>
      <Header
        title="Library"
        sub={`${state.user.course} · ${state.user.university} · semester → subject → unit → topic`}
        actions={
          <>
            <button className="iconbtn on" onClick={() => router.push("/library/scan")} aria-label="Syllabus Scanner">
              <Icon name="scan" />
            </button>
            <button className="iconbtn" onClick={() => setAddOpen(true)} aria-label="Add subject">
              <Icon name="plus" />
            </button>
          </>
        }
      />

      <div className="chips" style={{ marginBottom: 12 }}>
        {state.semesters.map((s) => (
          <button key={s.id} className={`chip ${s.number === sem ? "on" : ""}`} onClick={() => setSemester(s.number)}>
            Sem {s.number}
            {s.subjectCount ? ` · ${s.subjectCount}` : ""}
          </button>
        ))}
      </div>

      <div className="searchf" style={{ marginBottom: 10 }}>
        <Icon name="search" className="lead" />
        <input className="field" placeholder="Search subjects, units, topics" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="chips" style={{ marginBottom: 14 }}>
        {(
          [
            ["all", "All topics"],
            ["high", "High weightage"],
            ["weak", "Weak topics"],
            ["new", "Not started"],
            ["exam", "Exam in 3 weeks"],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button key={key} className={`chip ${filter === key ? "on" : ""}`} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      {!subjects.length ? (
        <Empty
          icon="scan"
          title={`Semester ${sem} has no subjects yet`}
          body={
            sem === state.user.semester
              ? "This is your semester — add your syllabus and the whole app works around it. Upload a copy (OCR pulls out units, topics and marks), or type subjects in manually."
              : "Nobody has scanned this semester yet. Upload your syllabus copy — OCR pulls out the units, topics and marks, you correct them, and the library grows for everyone."
          }
          action={
            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <button className="btn primary" style={{ width: "auto" }} onClick={() => router.push("/library/scan")}>
                <Icon name="scan" />
                Add via Syllabus Scanner
              </button>
              <button className="btn" style={{ width: "auto" }} onClick={() => setAddOpen(true)}>
                <Icon name="plus" />
                Add manually
              </button>
            </div>
          }
        />
      ) : (
        shown.map((s) => {
          const row = subjectReadiness(s, pm);
          const open = openSubject === s.id;
          const examDay = examMap.get(s.id);
          return (
            <Card key={s.id}>
              <button className="row between" style={{ width: "100%" }} onClick={() => setOpenSubject(open ? null : s.id)}>
                <span className="row" style={{ minWidth: 0 }}>
                  <span className="thumb" style={{ color: "var(--acc)" }}>
                    <Icon name={s.icon} />
                  </span>
                  <span style={{ minWidth: 0, textAlign: "left" }}>
                    <span className="t-head ellip" style={{ display: "block" }}>
                      {s.name}
                    </span>
                    <span className="t-foot muted">
                      {s.code ? `${s.code} · ` : ""}
                      {s.units.length} units · {row.totalTopics} topics
                      {examDay ? ` · exam in ${daysUntil(examDay)}d` : ""}
                    </span>
                  </span>
                </span>
                <span className="row" style={{ gap: 8, flex: "none" }}>
                  <span className="tag acc">{row.readiness}%</span>
                  <Icon name="chevron" className="chev" style={{ transform: open ? "rotate(90deg)" : undefined }} />
                </span>
              </button>

              <div style={{ marginTop: 10 }}>
                <span className="bar">
                  <i style={{ width: `${Math.max(2, row.readiness)}%` }} />
                </span>
              </div>

              {row.untouchedUnits.length ? (
                <div className="progline warn">
                  <Icon name="alert" />
                  <span>Untouched: {row.untouchedUnits.join(", ")} — that is where marks leak.</span>
                </div>
              ) : null}

              {open ? (
                <div style={{ marginTop: 12 }}>
                  {s.units.map((u) => {
                    const topics = u.topics.filter((t) => topicPasses(s.id, topicWeight(t, u), t.id));
                    if (!topics.length) return null;
                    return (
                      <Section key={u.id} title={`Unit ${u.number} · ${u.title} · ${u.weightage} marks`}>
                        {topics.map((t) => {
                          const p = pm.get(t.id);
                          return (
                            <Row
                              key={t.id}
                              title={t.title}
                              sub={`${Math.round(topicWeight(t, u))} marks · ${
                                p?.lastStudiedAt ? `${Math.round(effectiveScore(p) * 100)}% retained` : "not started"
                              }`}
                              right={<MasteryPill mastery={p?.mastery ?? "not_started"} />}
                              chevron
                              onClick={() => setTopicSheet(t.id)}
                            />
                          );
                        })}
                      </Section>
                    );
                  })}
                </div>
              ) : null}
            </Card>
          );
        })
      )}

      {/* --------------------------------------------------------- topic sheet */}
      <Sheet open={Boolean(topicRef)} title={topicRef?.topic.title ?? ""} onClose={() => setTopicSheet(null)}>
        {topicRef ? (
          <>
            <div className="t-foot muted" style={{ marginBottom: 14 }}>
              {topicRef.subject.name} · Unit {topicRef.unit.number} · {topicRef.unit.title}
            </div>

            <div className="tiles">
              <div className="tile">
                <div className="l">Exam weight</div>
                <div className="v">{Math.round(topicWeight(topicRef.topic, topicRef.unit))}</div>
                <div className="s">marks</div>
              </div>
              <div className="tile">
                <div className="l">Retention now</div>
                <div className="v">{Math.round((pm.get(topicRef.topic.id) ? retention(pm.get(topicRef.topic.id)!) : 0) * 100)}%</div>
                <div className="s">forgetting curve</div>
              </div>
              <div className="tile">
                <div className="l">Time spent</div>
                <div className="v">{fmtMinutes(pm.get(topicRef.topic.id)?.totalMinutes ?? 0)}</div>
              </div>
              <div className="tile">
                <div className="l">Next review</div>
                <div className="v" style={{ fontSize: 18 }}>
                  {pm.get(topicRef.topic.id)?.nextReviewAt
                    ? new Date(pm.get(topicRef.topic.id)!.nextReviewAt!).toLocaleDateString(undefined, { day: "numeric", month: "short" })
                    : "—"}
                </div>
              </div>
            </div>

            <span className="sect-t">Set mastery</span>
            <div className="sect-b" style={{ marginBottom: 14 }}>
              {(["not_started", "learning", "revised", "exam_ready"] as Mastery[]).map((m) => (
                <Row
                  key={m}
                  title={MASTERY_LABEL[m]}
                  onClick={() => void quickSet(topicRef.topic.id, m, pm.get(topicRef.topic.id)?.confidence || 3)}
                  right={
                    (pm.get(topicRef.topic.id)?.mastery ?? "not_started") === m ? (
                      <Icon name="check" className="lrow-c" style={{ color: "var(--acc)" }} />
                    ) : undefined
                  }
                />
              ))}
            </div>

            <span className="sect-t">Confidence</span>
            <div className="conf" style={{ marginBottom: 16 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={pm.get(topicRef.topic.id)?.confidence === n ? "on" : ""}
                  onClick={() => void quickSet(topicRef.topic.id, pm.get(topicRef.topic.id)?.mastery ?? "learning", n)}
                >
                  {n}
                </button>
              ))}
            </div>

            <button
              className="btn primary"
              onClick={() => {
                startSession([topicRef.topic.id], "pomodoro", state.user.settings.focusMinutes);
                router.push("/session");
              }}
            >
              <Icon name="play" />
              Study this topic now
            </button>
          </>
        ) : null}
      </Sheet>

      {/* ------------------------------------------------------- add subject */}
      <Sheet open={addOpen} title="Add your own subject" onClose={() => setAddOpen(false)}>
        <p className="t-sub muted" style={{ marginBottom: 14 }}>
          Quick manual entry for Semester {sem}. For a full syllabus copy use the Scanner — it pulls out every unit and the marks
          weightage for you.
        </p>
        <input className="field" placeholder="Subject name" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} style={{ marginBottom: 10 }} />
        <input className="field" placeholder="First unit title" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} style={{ marginBottom: 10 }} />
        <textarea className="field" placeholder="One topic per line" value={newTopics} onChange={(e) => setNewTopics(e.target.value)} />
        <button className="btn primary" style={{ marginTop: 14 }} onClick={() => void addCustomSubject()}>
          <Icon name="check" />
          Add to library
        </button>
        <button className="btn ghost" onClick={() => router.push("/library/scan")}>
          <Icon name="scan" />
          Use the Syllabus Scanner instead
        </button>
      </Sheet>
    </>
  );
}
