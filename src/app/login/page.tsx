"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icons";
import { saveSessionToken } from "@/lib/client-auth";
import { MAX_SEMESTER } from "@/lib/seed-data";
import { useApp } from "@/store/useApp";

const UNIVERSITY_HINTS = ["GTU", "MSU", "VTU", "Mumbai University", "Pune University", "Anna University", "Delhi University", "Osmania University"];
const COURSE_HINTS = ["BCA", "B.Sc. (IT)", "B.Sc. (CS)", "B.E. (CSE)", "B.E. (IT)", "B.Tech (CSE)", "MCA", "MBA"];

export default function LoginPage() {
  const router = useRouter();
  const load = useApp((s) => s.load);
  const authError = useApp((s) => s.authError);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [university, setUniversity] = useState("GTU");
  const [course, setCourse] = useState("BCA");
  const [semester, setSemester] = useState(3);
  const [demo, setDemo] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(url: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not sign in");
      // keep the session in localStorage too — in some preview/embedded
      // contexts the browser will not persist the httpOnly cookie, and
      // every later request would silently arrive signed-out
      saveSessionToken(data.token ?? null);
      await load();
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="logo-mark">
        <Icon name="cap" />
      </div>
      <h1 className="t-large" style={{ marginBottom: 6 }}>
        Study Tracker
      </h1>
      <p className="muted t-sub" style={{ marginBottom: 26 }}>
        Your syllabus, unit by unit — with spaced repetition and an exam-readiness score that is honest with you.
      </p>

      {authError === "stale_session" ? (
        <div className="progline warn" style={{ marginBottom: 14 }}>
          <Icon name="alert" />
          <span>
            Your previous sign-in no longer exists on this server (the data was reset). Create a new profile below —
            or just tap guest mode to keep exploring.
          </span>
        </div>
      ) : null}

      <div className="seg" style={{ marginBottom: 16 }}>
        <button type="button" className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>
          Sign in
        </button>
        <button type="button" className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>
          Create profile
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void go(
            `/api/auth/${mode}`,
            mode === "register"
              ? { email, password, name, university, course, semester, demo }
              : { email, password },
          );
        }}
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        {mode === "register" ? (
          <input className="field" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        ) : null}
        <input
          className="field"
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="field"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {mode === "register" ? (
          <div
            style={{
              border: "1px solid var(--separator)",
              borderRadius: 12,
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <span className="t-cap dim" style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
              Your course
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="field"
                list="university-hints"
                placeholder="University / college"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
              />
              <input
                className="field"
                list="course-hints"
                placeholder="Course — e.g. BCA"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              />
            </div>
            <datalist id="university-hints">
              {UNIVERSITY_HINTS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <datalist id="course-hints">
              {COURSE_HINTS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="t-foot muted">Semester</span>
              <div className="chips" style={{ flexWrap: "nowrap", overflowX: "auto" }}>
                {Array.from({ length: MAX_SEMESTER }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`chip ${semester === n ? "on" : ""}`}
                    onClick={() => setSemester(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {mode === "register" ? (
          <button type="button" className="row between" style={{ padding: "6px 4px" }} onClick={() => setDemo(!demo)}>
            <span className="t-sub muted">Fill my profile with 10 weeks of demo history</span>
            <span className={`sw ${demo ? "on" : ""}`}>
              <span className="knob" />
            </span>
          </button>
        ) : null}

        <button className="btn primary" disabled={busy} type="submit">
          <Icon name={mode === "login" ? "logout" : "plus"} />
          {mode === "login" ? "Sign in" : "Create profile"}
        </button>
      </form>

      <button className="btn" style={{ marginTop: 10 }} disabled={busy} onClick={() => void go("/api/auth/guest")}>
        <Icon name="bolt" />
        Try the demo (guest mode)
      </button>

      {error ? <div className="err">{error}</div> : null}

      {error && error.includes("already has a profile") ? (
        <button
          className="btn"
          style={{ marginTop: 4 }}
          onClick={() => {
            setError("");
            setMode("login");
          }}
        >
          <Icon name="logout" />
          This is my profile — take me to sign in
        </button>
      ) : null}

      <div className="sect-f" style={{ marginTop: 26, textAlign: "center" }}>
        Works for any university, course and semester. A sample GTU BCA Sem 3 library ships built-in — every other
        semester grows from what students scan.
      </div>
    </div>
  );
}
