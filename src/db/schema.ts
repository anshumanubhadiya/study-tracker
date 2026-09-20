import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  real,
  boolean,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ---------------------------------------------------------------- users -- */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default("Student"),
  passwordHash: text("password_hash").notNull(),
  isGuest: boolean("is_guest").notNull().default(false),
  university: text("university").notNull().default("GTU"),
  course: text("course").notNull().default("BCA"),
  semester: integer("semester").notNull().default(3),
  theme: text("theme").notNull().default("dark"),
  accent: text("accent").notNull().default("lime"),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------- library -- */
/* semester -> subject -> unit -> topic  (crowd-sourced, grows via scanner)   */

export const semesters = pgTable("semesters", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull().unique(),
  name: text("name").notNull(),
});

export const subjects = pgTable(
  "subjects",
  {
    id: serial("id").primaryKey(),
    semesterId: integer("semester_id").notNull(),
    name: text("name").notNull(),
    code: text("code").notNull().default(""),
    credits: integer("credits").notNull().default(4),
    color: text("color").notNull().default("blue"),
    icon: text("icon").notNull().default("book"),
    source: text("source").notNull().default("seed"), // seed | scanner | custom
    createdBy: integer("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("subjects_sem_idx").on(t.semesterId)],
);

export const units = pgTable(
  "units",
  {
    id: serial("id").primaryKey(),
    subjectId: integer("subject_id").notNull(),
    number: integer("number").notNull().default(1),
    title: text("title").notNull(),
    weightage: integer("weightage").notNull().default(0), // exam marks weightage
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("units_subject_idx").on(t.subjectId)],
);

export const topics = pgTable(
  "topics",
  {
    id: serial("id").primaryKey(),
    unitId: integer("unit_id").notNull(),
    title: text("title").notNull(),
    weightage: integer("weightage").notNull().default(0),
    difficulty: integer("difficulty").notNull().default(2), // 1..3
    estMinutes: integer("est_minutes").notNull().default(40),
    source: text("source").notNull().default("seed"),
    createdBy: integer("created_by"),
  },
  (t) => [index("topics_unit_idx").on(t.unitId)],
);

/* ------------------------------------------------------------- progress -- */

export const topicProgress = pgTable(
  "topic_progress",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    topicId: integer("topic_id").notNull(),
    mastery: text("mastery").notNull().default("not_started"), // not_started|learning|revised|exam_ready
    confidence: integer("confidence").notNull().default(0), // 0..5
    reviewCount: integer("review_count").notNull().default(0),
    totalMinutes: integer("total_minutes").notNull().default(0),
    lastStudiedAt: timestamp("last_studied_at", { withTimezone: true }),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
    stability: real("stability").notNull().default(1.5), // forgetting-curve days
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("progress_user_topic_idx").on(t.userId, t.topicId)],
);

/* ------------------------------------------------------------- sessions -- */

export const studySessions = pgTable(
  "study_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    day: date("day").notNull(),
    kind: text("kind").notNull().default("pomodoro"), // pomodoro | long | combined
    minutes: integer("minutes").notNull().default(0),
    focusQuality: integer("focus_quality").notNull().default(3), // 1..5
    pomodoros: integer("pomodoros").notNull().default(0),
    notes: text("notes").notNull().default(""),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_day_idx").on(t.userId, t.day)],
);

export const sessionTopics = pgTable(
  "session_topics",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id").notNull(),
    topicId: integer("topic_id").notNull(),
    minutes: integer("minutes").notNull().default(0),
    masteryAfter: text("mastery_after").notNull().default("learning"),
    confidenceAfter: integer("confidence_after").notNull().default(3),
  },
  (t) => [index("session_topics_session_idx").on(t.sessionId)],
);

/* ----------------------------------------------------------------- plan -- */

export const planEntries = pgTable(
  "plan_entries",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    weekday: integer("weekday").notNull(), // 0 = Sunday
    subjectId: integer("subject_id").notNull(),
    topicIds: jsonb("topic_ids").$type<number[]>().notNull().default([]),
    targetMinutes: integer("target_minutes").notNull().default(50),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("plan_user_idx").on(t.userId)],
);

/** move a planned weekday to another date without touching the weekly plan */
export const planOverrides = pgTable(
  "plan_overrides",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    fromDay: date("from_day").notNull(),
    toDay: date("to_day"), // null = skipped
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("overrides_user_idx").on(t.userId)],
);

/* ---------------------------------------------------------------- exams -- */

export const exams = pgTable(
  "exams",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    subjectId: integer("subject_id").notNull(),
    examDay: date("exam_day").notNull(),
  },
  (t) => [uniqueIndex("exam_user_subject_idx").on(t.userId, t.subjectId)],
);

/* --------------------------------------------------- past marks (import) -- */

export const pastRecords = pgTable(
  "past_records",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    label: text("label").notNull(),
    marks: real("marks").notNull().default(0),
    outOf: real("out_of").notNull().default(100),
    attendance: real("attendance").notNull().default(0),
    semester: integer("semester").notNull().default(3),
  },
  (t) => [index("past_user_idx").on(t.userId)],
);

/* ------------------------------------------------------- syllabus scans -- */

export const scans = pgTable(
  "scans",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    fileName: text("file_name").notNull().default(""),
    rawText: text("raw_text").notNull().default(""),
    parsed: jsonb("parsed").$type<unknown>(),
    status: text("status").notNull().default("draft"), // draft | saved
    semesterNumber: integer("semester_number").notNull().default(3),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scans_user_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type TopicProgress = typeof topicProgress.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;
export type PlanEntry = typeof planEntries.$inferSelect;
