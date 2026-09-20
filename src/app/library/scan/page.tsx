"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { Card, Header, Row, Section, Seg, Sheet } from "@/components/ui";
import { parseSyllabusText, type ScanReport } from "@/lib/syllabus";
import type { ParsedSyllabus } from "@/lib/types";
import { useApp } from "@/store/useApp";

type Stage = "input" | "review";

export default function ScanPage() {
  const router = useRouter();
  const { state, libraryAction, setToast } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("input");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<ScanReport | null>(null);
  const [draft, setDraft] = useState<ParsedSyllabus | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  if (!state) return null;

  /* ---------------------------------------------------------- extraction */

  async function readPdf(file: File): Promise<string> {
    setBusy("Reading PDF text layer…");
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    let text = "";
    const pages = Math.min(doc.numPages, 6);
    for (let i = 1; i <= pages; i++) {
      setProgress(Math.round((i / pages) * 100));
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let line = "";
      let lastY: number | null = null;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = Math.round(item.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 3) {
          text += `${line.trim()}\n`;
          line = "";
        }
        line += `${item.str} `;
        lastY = y;
      }
      text += `${line.trim()}\n`;
    }
    return text;
  }

  async function readImage(file: File): Promise<string> {
    setBusy("Running OCR on the photo…");
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng", 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
      },
    });
    const { data } = await worker.recognize(file);
    await worker.terminate();
    return data.text;
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setProgress(0);
    try {
      const text = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") ? await readPdf(file) : await readImage(file);
      setRawText(text);
      if (text.trim().length < 40) {
        setToast("Barely any text found — try a sharper photo or paste the text");
        setMode("text");
        setBusy("");
        return;
      }
      runParse(text);
    } catch {
      setToast("Could not read that file — paste the text instead");
      setMode("text");
    } finally {
      setBusy("");
      setProgress(0);
    }
  }

  function runParse(text: string) {
    const r = parseSyllabusText(text, state!.user.semester);
    setReport(r);
    setDraft(r.parsed);
    setStage("review");
  }

  /* -------------------------------------------------------------- editing */

  function patchDraft(fn: (d: ParsedSyllabus) => void) {
    if (!draft) return;
    const copy: ParsedSyllabus = JSON.parse(JSON.stringify(draft));
    fn(copy);
    setDraft(copy);
  }

  async function save() {
    if (!draft) return;
    setBusy("Saving to the library…");
    try {
      await libraryAction({ action: "import", parsed: draft, fileName, rawText });
      setToast(`${draft.subject} added to Semester ${draft.semester}`);
      router.push("/library");
    } catch {
      setToast("Could not save — check the subject name");
    } finally {
      setBusy("");
    }
  }

  const totalMarks = draft?.units.reduce((a, u) => a + u.weightage, 0) ?? 0;
  const totalTopics = draft?.units.reduce((a, u) => a + u.topics.length, 0) ?? 0;

  return (
    <>
      <Header
        title="Syllabus Scanner"
        sub="Photo or PDF in, structured syllabus out"
        actions={
          <>
            <button className="iconbtn" onClick={() => setHelpOpen(true)} aria-label="How it works">
              <Icon name="info" />
            </button>
            <button className="iconbtn" onClick={() => router.push("/library")} aria-label="Close">
              <Icon name="close" />
            </button>
          </>
        }
      />

      {stage === "input" ? (
        <>
          <Card>
            <Seg
              value={mode}
              onChange={(v) => setMode(v)}
              options={[
                { value: "file", label: "Photo / PDF" },
                { value: "text", label: "Paste text" },
              ]}
            />

            {mode === "file" ? (
              <div style={{ marginTop: 16 }}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                />
                <button
                  className="btn tinted"
                  style={{ height: 150, flexDirection: "column", gap: 10 }}
                  onClick={() => fileRef.current?.click()}
                  disabled={Boolean(busy)}
                >
                  <Icon name="scan" style={{ fontSize: 34 }} />
                  {busy || "Tap to upload your syllabus copy"}
                  <span className="t-foot muted">PDF page or a photo of the printed copy</span>
                </button>
                {busy ? (
                  <div style={{ marginTop: 12 }}>
                    <span className="bar thick">
                      <i style={{ width: `${progress}%` }} />
                    </span>
                    <div className="t-foot muted center-t" style={{ marginTop: 6 }}>
                      {progress}% · OCR runs on your device, nothing is uploaded to a third party
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <textarea
                  className="field"
                  style={{ minHeight: 220 }}
                  placeholder={"Paste the syllabus text here, e.g.\n\nUnit-I Java Fundamentals 12\n1.1 Features of Java\n1.2 JVM, JRE, JDK"}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
                <button className="btn primary" style={{ marginTop: 12 }} disabled={rawText.trim().length < 20} onClick={() => runParse(rawText)}>
                  <Icon name="bolt" />
                  Extract units & topics
                </button>
              </div>
            )}
          </Card>

          <Section title="Why this exists" footer="Every scan a student corrects makes the shared library better for the next batch.">
            <Row icon="doc" tint="var(--blue)" title="Your syllabus is a PDF, not a plan" sub="Scan it once, track it all semester" />
            <Row icon="grid" tint="var(--purple)" title="Marks weightage comes along" sub="Readiness is weighted by what the paper actually asks" />
            <Row icon="users" tint="var(--orange)" title="Crowd-sourced library" sub="Every course and semester grows from scans like yours" />
          </Section>
        </>
      ) : null}

      {stage === "review" && draft ? (
        <>
          <Card>
            <div className="row between" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Check before saving</h2>
              <span className="tag acc">
                {draft.units.length} units · {totalTopics} topics · {totalMarks} marks
              </span>
            </div>

            {report?.warnings.map((w) => (
              <div className="progline warn" key={w}>
                <Icon name="alert" />
                <span>{w}</span>
              </div>
            ))}

            <input
              className="field"
              style={{ marginBottom: 10 }}
              placeholder="Subject name"
              value={draft.subject}
              onChange={(e) => patchDraft((d) => (d.subject = e.target.value))}
            />
            <div className="row" style={{ gap: 10, marginBottom: 10 }}>
              <input
                className="field"
                placeholder="Subject code"
                value={draft.code}
                onChange={(e) => patchDraft((d) => (d.code = e.target.value))}
              />
              <input
                className="field"
                type="number"
                placeholder="Credits"
                value={draft.credits}
                onChange={(e) => patchDraft((d) => (d.credits = Number(e.target.value) || 4))}
                style={{ width: 110 }}
              />
            </div>
            <span className="sect-t">Semester</span>
            <div className="chips">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <button key={n} className={`chip ${draft.semester === n ? "on" : ""}`} onClick={() => patchDraft((d) => (d.semester = n))}>
                  Sem {n}
                </button>
              ))}
            </div>
          </Card>

          {draft.units.map((u, ui) => (
            <Card key={ui}>
              <div className="row" style={{ gap: 10, marginBottom: 10 }}>
                <input
                  className="field"
                  value={u.title}
                  placeholder={`Unit ${u.number}`}
                  onChange={(e) => patchDraft((d) => (d.units[ui].title = e.target.value))}
                />
                <input
                  className="field"
                  type="number"
                  value={u.weightage}
                  onChange={(e) => patchDraft((d) => (d.units[ui].weightage = Number(e.target.value) || 0))}
                  style={{ width: 92 }}
                  title="Marks"
                />
                <button className="iconbtn" onClick={() => patchDraft((d) => d.units.splice(ui, 1))} aria-label="Remove unit">
                  <Icon name="trash" />
                </button>
              </div>

              {u.topics.map((t, ti) => (
                <div className="row" style={{ gap: 8, marginBottom: 8 }} key={ti}>
                  <input
                    className="field"
                    style={{ fontSize: 15, padding: "10px 12px" }}
                    value={t.title}
                    onChange={(e) => patchDraft((d) => (d.units[ui].topics[ti].title = e.target.value))}
                  />
                  <input
                    className="field"
                    type="number"
                    style={{ width: 78, fontSize: 15, padding: "10px 12px" }}
                    value={t.weightage}
                    onChange={(e) => patchDraft((d) => (d.units[ui].topics[ti].weightage = Number(e.target.value) || 0))}
                  />
                  <button className="iconbtn" onClick={() => patchDraft((d) => d.units[ui].topics.splice(ti, 1))} aria-label="Remove topic">
                    <Icon name="close" />
                  </button>
                </div>
              ))}

              <button className="btn sm" onClick={() => patchDraft((d) => d.units[ui].topics.push({ title: "", weightage: 0 }))}>
                <Icon name="plus" />
                Add topic
              </button>
            </Card>
          ))}

          <button
            className="btn"
            onClick={() =>
              patchDraft((d) => d.units.push({ number: d.units.length + 1, title: `Unit ${d.units.length + 1}`, weightage: 0, topics: [] }))
            }
          >
            <Icon name="plus" />
            Add unit
          </button>

          <button className="btn primary" style={{ marginTop: 10 }} onClick={() => void save()} disabled={Boolean(busy) || !draft.subject.trim()}>
            <Icon name="check" />
            {busy || `Save to Semester ${draft.semester} library`}
          </button>
          <button className="btn ghost" onClick={() => setStage("input")}>
            Back to scanning
          </button>
        </>
      ) : null}

      <Sheet open={helpOpen} title="How the scanner works" onClose={() => setHelpOpen(false)}>
        <Section title="Pipeline">
          <Row icon="camera" tint="var(--blue)" title="1 · Capture" sub="PDF text layer, or Tesseract OCR on a photo — all on your device" />
          <Row icon="bolt" tint="var(--orange)" title="2 · Parse" sub="Unit headers, numbered topics (1.1, 1.2…) and the marks column" />
          <Row icon="edit" tint="var(--purple)" title="3 · Correct" sub="OCR is never perfect — you fix the form before anything is saved" />
          <Row icon="library" tint="var(--green)" title="4 · Grow the library" sub="Saved under that semester for every student on this instance" />
        </Section>
        <p className="t-sub muted">
          Tip: a straight, well-lit photo of a single page beats a whole-book scan. Marks in brackets like <b>(14)</b> or a trailing marks
          column are both understood.
        </p>
      </Sheet>
    </>
  );
}
