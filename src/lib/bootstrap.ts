/* ============================================================================
   Schema bootstrap — the app must work on a FRESH database, with zero setup.
   ----------------------------------------------------------------------------
   There are no migration files in this repo; instead every request path runs
   this idempotent bootstrap first. CREATE TABLE IF NOT EXISTS / ADD COLUMN IF
   NOT EXISTS make it safe to run on every start and on every old database,
   which is what makes register → sign-in → guest work no matter how the
   hosting provisioned the Postgres instance.
   ========================================================================== */

import { sql } from "drizzle-orm";
import { db } from "@/db";

const DDL = `
create table if not exists users (
  id serial primary key,
  email text not null unique,
  name text not null default 'Student',
  password_hash text not null,
  is_guest boolean not null default false,
  semester integer not null default 3,
  theme text not null default 'dark',
  accent text not null default 'lime',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table users add column if not exists university text not null default 'GTU';
alter table users add column if not exists course text not null default 'BCA';
alter table users add column if not exists is_guest boolean not null default false;
alter table users add column if not exists theme text not null default 'dark';
alter table users add column if not exists accent text not null default 'lime';
alter table users add column if not exists settings jsonb not null default '{}'::jsonb;

create table if not exists semesters (
  id serial primary key,
  number integer not null unique,
  name text not null
);

create table if not exists subjects (
  id serial primary key,
  semester_id integer not null,
  name text not null,
  code text not null default '',
  credits integer not null default 4,
  color text not null default 'blue',
  icon text not null default 'book',
  source text not null default 'seed',
  created_by integer,
  created_at timestamptz not null default now()
);
create index if not exists subjects_sem_idx on subjects (semester_id);

create table if not exists units (
  id serial primary key,
  subject_id integer not null,
  number integer not null default 1,
  title text not null,
  weightage integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists units_subject_idx on units (subject_id);

create table if not exists topics (
  id serial primary key,
  unit_id integer not null,
  title text not null,
  weightage integer not null default 0,
  difficulty integer not null default 2,
  est_minutes integer not null default 40,
  source text not null default 'seed',
  created_by integer
);
create index if not exists topics_unit_idx on topics (unit_id);

create table if not exists topic_progress (
  id serial primary key,
  user_id integer not null,
  topic_id integer not null,
  mastery text not null default 'not_started',
  confidence integer not null default 0,
  review_count integer not null default 0,
  total_minutes integer not null default 0,
  last_studied_at timestamptz,
  next_review_at timestamptz,
  stability real not null default 1.5,
  updated_at timestamptz not null default now()
);
create unique index if not exists progress_user_topic_idx on topic_progress (user_id, topic_id);

create table if not exists study_sessions (
  id serial primary key,
  user_id integer not null,
  day date not null,
  kind text not null default 'pomodoro',
  minutes integer not null default 0,
  focus_quality integer not null default 3,
  pomodoros integer not null default 0,
  notes text not null default '',
  started_at timestamptz not null default now(),
  ended_at timestamptz not null default now()
);
create index if not exists sessions_user_day_idx on study_sessions (user_id, day);

create table if not exists session_topics (
  id serial primary key,
  session_id integer not null,
  topic_id integer not null,
  minutes integer not null default 0,
  mastery_after text not null default 'learning',
  confidence_after integer not null default 3
);
create index if not exists session_topics_session_idx on session_topics (session_id);

create table if not exists plan_entries (
  id serial primary key,
  user_id integer not null,
  weekday integer not null,
  subject_id integer not null,
  topic_ids jsonb not null default '[]'::jsonb,
  target_minutes integer not null default 50,
  position integer not null default 0
);
create index if not exists plan_user_idx on plan_entries (user_id);

create table if not exists plan_overrides (
  id serial primary key,
  user_id integer not null,
  from_day date not null,
  to_day date,
  created_at timestamptz not null default now()
);
create index if not exists overrides_user_idx on plan_overrides (user_id);

create table if not exists exams (
  id serial primary key,
  user_id integer not null,
  subject_id integer not null,
  exam_day date not null
);
create unique index if not exists exam_user_subject_idx on exams (user_id, subject_id);

create table if not exists past_records (
  id serial primary key,
  user_id integer not null,
  label text not null,
  marks real not null default 0,
  out_of real not null default 100,
  attendance real not null default 0,
  semester integer not null default 3
);
create index if not exists past_user_idx on past_records (user_id);

create table if not exists scans (
  id serial primary key,
  user_id integer not null,
  file_name text not null default '',
  raw_text text not null default '',
  parsed jsonb,
  status text not null default 'draft',
  semester_number integer not null default 3,
  created_at timestamptz not null default now()
);
create index if not exists scans_user_idx on scans (user_id);
`;

async function repairLegacyUsersTable(): Promise<void> {
  const rows = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' ORDER BY ordinal_position`,
  );
  const names = new Set((rows.rows as Array<{ column_name: string }>).map((r) => r.column_name));
  const required = ["id", "email", "name", "password_hash", "is_guest", "university", "course", "semester", "theme", "accent", "settings", "created_at"];
  const isLegacy = !required.every((c) => names.has(c)) || names.has("enrollment_no") || names.has("role") || names.has("department");
  if (!isLegacy) return;

  await db.execute(sql`DROP TABLE IF EXISTS users_legacy;`);
  await db.execute(sql`ALTER TABLE IF EXISTS users RENAME TO users_legacy;`);

  await db.execute(sql.raw(`
    create table users (
      id serial primary key,
      email text not null unique,
      name text not null default 'Student',
      password_hash text not null,
      is_guest boolean not null default false,
      university text not null default 'GTU',
      course text not null default 'BCA',
      semester integer not null default 3,
      theme text not null default 'dark',
      accent text not null default 'lime',
      settings jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  `));

  await db.execute(sql.raw(`
    insert into users (email, name, password_hash, is_guest, university, course, semester, theme, accent, settings, created_at)
    select
      email,
      name,
      password_hash,
      coalesce(is_guest, false),
      coalesce(university, 'GTU'),
      coalesce(course, 'BCA'),
      coalesce(semester, 3),
      coalesce(theme, 'dark'),
      coalesce(accent, 'lime'),
      coalesce(settings, '{}'::jsonb),
      coalesce(created_at, now())
    from users_legacy
    on conflict (email) do nothing;
  `));

  await db.execute(sql`DROP TABLE IF EXISTS users_legacy;`);
}

let ready: Promise<void> | null = null;

/** Idempotent: creates every table/index the app needs, exactly once per process. */
export function ensureDb(): Promise<void> {
  ready ??= db
    .execute(sql.raw(DDL))
    .then(() => repairLegacyUsersTable())
    .then(() => undefined)
    .catch((e) => {
      // if one statement fails (e.g. not the table owner) remember nothing and
      // retry next call instead of poisoning the whole process
      ready = null;
      throw e;
    });
  return ready;
}
