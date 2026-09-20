"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { daysUntil, mySubjects, planForDate, progressMap, studiedMinutes } from "@/lib/derive";
import { dueQueue, toDayKey } from "@/lib/srs";
import { useApp } from "@/store/useApp";
import { Icon } from "./Icons";

const TABS = [
  { href: "/", icon: "home", label: "Home" },
  { href: "/plan", icon: "calendar", label: "Plan" },
  { href: "/session", icon: "play", label: "Study", center: true },
  { href: "/library", icon: "library", label: "Library" },
  { href: "/progress", icon: "chart", label: "Progress" },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, loading, authChecked, load, toast, active } = useApp();
  const isAuthPage = pathname === "/login";

  useEffect(() => {
    if (!authChecked) void load();
  }, [authChecked, load]);

  // theme + accent are stored on the profile and mirrored to localStorage so
  // the very first paint after a reload is already the right colour
  useEffect(() => {
    if (!state?.user) return;
    const root = document.documentElement;
    root.dataset.theme = state.user.theme;
    root.dataset.accent = state.user.accent;
    localStorage.setItem("gtu-theme", state.user.theme);
    localStorage.setItem("gtu-accent", state.user.accent);
  }, [state?.user]);

  useEffect(() => {
    if (authChecked && !state && !isAuthPage) router.replace("/login");
    if (authChecked && state && isAuthPage) router.replace("/");
  }, [authChecked, state, isAuthPage, router]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  /* Reminders: revision-due, exam countdown and a missed-session nudge.
     Checked when the app opens and hourly after that, at most once a day each,
     and only if the profile switched notifications on. */
  useEffect(() => {
    if (!state?.user.settings.notifications || typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const fire = (key: string, title: string, body: string) => {
      const stamp = `${key}:${toDayKey(new Date())}`;
      if (localStorage.getItem("gtu-notified") === stamp) return;
      localStorage.setItem("gtu-notified", stamp);
      new Notification(title, { body, icon: "/icon.png" });
    };

    const check = () => {
      const pm = progressMap(state.progress);
      const due = dueQueue(mySubjects(state), pm, { limit: 50 });
      const nextExam = [...state.exams]
        .map((e) => ({ ...e, days: daysUntil(e.examDay) }))
        .filter((e) => e.days >= 0)
        .sort((a, b) => a.days - b.days)[0];
      const plannedToday = planForDate(state, new Date()).entries.length;
      const doneToday = studiedMinutes(state, new Date());
      const hour = new Date().getHours();

      if (nextExam && nextExam.days <= 7) {
        const name = state.subjects.find((s) => s.id === nextExam.subjectId)?.name ?? "Your exam";
        fire("exam", `${name} in ${nextExam.days} day${nextExam.days === 1 ? "" : "s"}`, "Open the readiness map and hit the weak units first.");
      } else if (plannedToday && !doneToday && hour >= 19) {
        fire("missed", "Today's session is still open", "Even 25 minutes keeps the streak and the curve alive.");
      } else if (due.length) {
        fire("due", `${due.length} topic${due.length === 1 ? "" : "s"} due for revision`, "Spaced repetition says now is the cheapest time to re-read them.");
      }
    };

    check();
    const id = setInterval(check, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [state]);

  if (isAuthPage) return <>{children}</>;

  if (loading || !state) {
    return (
      <main id="app">
        <div className="hdr">
          <div>
            <h1>GTU Study</h1>
            <div className="sub">Loading your library…</div>
          </div>
        </div>
        <div className="card" style={{ height: 120 }} />
        <div className="card" style={{ height: 180 }} />
      </main>
    );
  }

  return (
    <>
      <main id="app" key={pathname}>
        {children}
      </main>

      <nav id="tabbar">
        {TABS.map((t) => {
          const on = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          if (t.center) {
            return (
              <button key={t.href} className={`start ${active ? "rec" : ""}`} onClick={() => router.push(t.href)}>
                <span className="cir">
                  <Icon name={active ? "pause" : "play"} />
                </span>
                <span>{active ? "Running" : "Study"}</span>
              </button>
            );
          }
          return (
            <button key={t.href} className={on ? "on" : ""} onClick={() => router.push(t.href)}>
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      <div id="toast" className={toast ? "show" : ""}>
        {toast}
      </div>
    </>
  );
}
