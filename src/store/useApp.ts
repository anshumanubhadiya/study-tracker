"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppState, Mastery, UserDTO, UserSettings } from "@/lib/types";

/* ------------------------------------------------------------- api call -- */

async function api<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, {
    method: body === undefined && method === "POST" ? "GET" : method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Something went wrong");
  return data as T;
}

/* --------------------------------------------------------- active study -- */

export type ActiveTopicResult = { topicId: number; minutes: number; mastery: Mastery; confidence: number };

export type ActiveSession = {
  startedAt: string;
  kind: "pomodoro" | "long" | "combined";
  topicIds: number[];
  index: number;
  phase: "focus" | "break";
  phaseEndsAt: number;
  phaseLength: number;
  running: boolean;
  pausedRemaining: number | null;
  pomodoros: number;
  minutes: number;
  results: ActiveTopicResult[];
  notes: string;
};

type Store = {
  state: AppState | null;
  loading: boolean;
  authChecked: boolean;
  authError: string;
  toast: string;
  active: ActiveSession | null;

  load: () => Promise<void>;
  setToast: (t: string) => void;
  patchUser: (u: UserDTO) => void;

  saveSettings: (patch: {
    name?: string;
    theme?: string;
    accent?: string;
    university?: string;
    course?: string;
    semester?: number;
    settings?: Partial<UserSettings>;
  }) => Promise<void>;

  logProgress: (input: { topicId: number; mastery: Mastery; confidence: number; minutes?: number; difficulty?: number }) => Promise<void>;
  finishSession: (payload: {
    kind: "pomodoro" | "long" | "combined";
    minutes: number;
    focusQuality: number;
    pomodoros: number;
    notes: string;
    startedAt: string;
    topics: ActiveTopicResult[];
  }) => Promise<void>;
  planAction: (body: unknown) => Promise<void>;
  libraryAction: <T = { state: AppState }>(body: unknown) => Promise<T>;
  examAction: (body: unknown) => Promise<void>;
  importData: (payload: unknown) => Promise<void>;
  logout: () => Promise<void>;

  startSession: (topicIds: number[], kind: ActiveSession["kind"], focusMinutes: number) => void;
  updateActive: (patch: Partial<ActiveSession>) => void;
  endSession: () => void;
};

export const useApp = create<Store>()(
  persist(
    (set, get) => ({
      state: null,
      loading: true,
      authChecked: false,
      authError: "",
      toast: "",
      active: null,

      async load() {
        set({ loading: true });
        try {
          const state = await api<AppState>("/api/state", undefined, "GET");
          set({ state, loading: false, authChecked: true, authError: "" });
        } catch (e) {
          set({ state: null, loading: false, authChecked: true, authError: e instanceof Error ? e.message : "" });
        }
      },

      setToast(t) {
        set({ toast: t });
        if (t) setTimeout(() => set((s) => (s.toast === t ? { toast: "" } : {})), 2200);
      },

      patchUser(u) {
        const state = get().state;
        if (state) set({ state: { ...state, user: u } });
      },

      async saveSettings(patch) {
        const { user } = await api<{ user: UserDTO }>("/api/settings", patch);
        get().patchUser(user);
      },

      async logProgress(input) {
        const res = await api<{ progress: AppState["progress"] }>("/api/progress", input);
        const state = get().state;
        if (state) set({ state: { ...state, progress: res.progress } });
      },

      async finishSession(payload) {
        const res = await api<{ state: AppState }>("/api/sessions", {
          ...payload,
          topics: payload.topics.map((t) => ({
            topicId: t.topicId,
            minutes: t.minutes,
            mastery: t.mastery,
            confidence: t.confidence,
          })),
        });
        set({ state: res.state, active: null });
      },

      async planAction(body) {
        const res = await api<{ state: AppState }>("/api/plan", body);
        set({ state: res.state });
      },

      async libraryAction<T>(body: unknown) {
        const res = await api<T>("/api/library", body);
        const maybe = res as { state?: AppState };
        if (maybe.state) set({ state: maybe.state });
        return res;
      },

      async examAction(body) {
        const res = await api<{ state: AppState }>("/api/exams", body);
        set({ state: res.state });
      },

      async importData(payload) {
        const res = await api<{ state: AppState }>("/api/data", payload);
        set({ state: res.state });
      },

      async logout() {
        await api("/api/auth/logout", {});
        set({ state: null, active: null, authError: "" });
      },

      startSession(topicIds, kind, focusMinutes) {
        const length = focusMinutes * 60;
        set({
          active: {
            startedAt: new Date().toISOString(),
            kind,
            topicIds,
            index: 0,
            phase: "focus",
            phaseEndsAt: Date.now() + length * 1000,
            phaseLength: length,
            running: true,
            pausedRemaining: null,
            pomodoros: 0,
            minutes: 0,
            results: [],
            notes: "",
          },
        });
      },

      updateActive(patch) {
        const active = get().active;
        if (!active) return;
        set({ active: { ...active, ...patch } });
      },

      endSession() {
        set({ active: null });
      },
    }),
    {
      name: "gtu-study-active",
      partialize: (s) => ({ active: s.active }),
    },
  ),
);
