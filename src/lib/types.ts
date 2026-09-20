export type Mastery = "not_started" | "learning" | "revised" | "exam_ready";

export const MASTERY_ORDER: Mastery[] = ["not_started", "learning", "revised", "exam_ready"];

export const MASTERY_LABEL: Record<Mastery, string> = {
  not_started: "Not Started",
  learning: "Learning",
  revised: "Revised",
  exam_ready: "Exam-Ready",
};

export const MASTERY_TINT: Record<Mastery, string> = {
  not_started: "var(--label-3)",
  learning: "var(--orange)",
  revised: "var(--blue)",
  exam_ready: "var(--green)",
};

export type TopicDTO = {
  id: number;
  unitId: number;
  title: string;
  weightage: number;
  difficulty: number;
  estMinutes: number;
  source: string;
};

export type UnitDTO = {
  id: number;
  subjectId: number;
  number: number;
  title: string;
  weightage: number;
  topics: TopicDTO[];
};

export type SubjectDTO = {
  id: number;
  semesterId: number;
  semesterNumber: number;
  name: string;
  code: string;
  credits: number;
  color: string;
  icon: string;
  source: string;
  units: UnitDTO[];
};

export type SemesterDTO = {
  id: number;
  number: number;
  name: string;
  subjectCount: number;
};

export type ProgressDTO = {
  topicId: number;
  mastery: Mastery;
  confidence: number;
  reviewCount: number;
  totalMinutes: number;
  lastStudiedAt: string | null;
  nextReviewAt: string | null;
  stability: number;
};

export type SessionTopicDTO = {
  topicId: number;
  minutes: number;
  masteryAfter: Mastery;
  confidenceAfter: number;
};

export type SessionDTO = {
  id: number;
  day: string;
  kind: "pomodoro" | "long" | "combined";
  minutes: number;
  focusQuality: number;
  pomodoros: number;
  notes: string;
  startedAt: string;
  topics: SessionTopicDTO[];
};

export type PlanEntryDTO = {
  id: number;
  weekday: number;
  subjectId: number;
  topicIds: number[];
  targetMinutes: number;
  position: number;
};

export type OverrideDTO = { id: number; fromDay: string; toDay: string | null };

export type ExamDTO = { id: number; subjectId: number; examDay: string };

export type PastRecordDTO = {
  id: number;
  label: string;
  marks: number;
  outOf: number;
  attendance: number;
  semester: number;
};

export type UserSettings = {
  dailyTargetMinutes: number;
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  keepAwake: boolean;
  notifications: boolean;
  aiCoach: boolean;
  facultyOptIn: boolean;
};

export const DEFAULT_SETTINGS: UserSettings = {
  dailyTargetMinutes: 120,
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  keepAwake: true,
  notifications: false,
  aiCoach: false,
  facultyOptIn: false,
};

export type UserDTO = {
  id: number;
  email: string;
  name: string;
  isGuest: boolean;
  university: string;
  course: string;
  semester: number;
  theme: "dark" | "light";
  accent: string;
  settings: UserSettings;
};

export type AppState = {
  user: UserDTO;
  semesters: SemesterDTO[];
  subjects: SubjectDTO[];
  progress: ProgressDTO[];
  sessions: SessionDTO[];
  plan: PlanEntryDTO[];
  overrides: OverrideDTO[];
  exams: ExamDTO[];
  pastRecords: PastRecordDTO[];
};

/** payload the Syllabus Scanner produces / the library import consumes */
export type ParsedSyllabus = {
  subject: string;
  code: string;
  semester: number;
  credits: number;
  units: { number: number; title: string; weightage: number; topics: { title: string; weightage: number }[] }[];
};
