"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icons";
import { useApp } from "@/store/useApp";

export default function LoginPage() {
  const router = useRouter();
  const load = useApp((s) => s.load);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not sign in");
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
        GTU Study Tracker
      </h1>
      <p className="muted t-sub" style={{ marginBottom: 26 }}>
        Your syllabus, unit by unit — with spaced repetition and an exam-readiness score that is honest with you.
      </p>

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
          void go(`/api/auth/${mode}`, { email, password, name, demo: mode === "register" ? demo : undefined });
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

      <div className="sect-f" style={{ marginTop: 26, textAlign: "center" }}>
        Sem 3 of the GTU BCA syllabus ships built-in. Every other semester grows from what students scan.
      </div>
    </div>
  );
}
