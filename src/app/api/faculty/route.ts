import { sql } from "drizzle-orm";
import { db } from "@/db";
import { currentUser, unauthorized } from "@/lib/auth";
import { ensureDb } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

/**
 * Faculty dashboard (opt-in, privacy respecting).
 * Only profiles that switched `facultyOptIn` on are counted, and nothing
 * identifying ever leaves this endpoint — just class-level averages.
 */
export async function GET() {
  await ensureDb();
  const user = await currentUser();
  if (!user) return unauthorized();

  const rows = await db.execute(sql`
    select
      count(distinct u.id)::int                                as students,
      coalesce(round(avg(s.per_day)::numeric, 1), 0)::float    as avg_minutes_per_day,
      coalesce(round(avg(s.days)::numeric, 1), 0)::float       as avg_active_days
    from users u
    left join (
      select user_id,
             sum(minutes)::float / 28                          as per_day,
             count(distinct day)::float                        as days
      from study_sessions
      where day > current_date - interval '28 days'
      group by user_id
    ) s on s.user_id = u.id
    where (u.settings ->> 'facultyOptIn') = 'true'
  `);

  const topSubjects = await db.execute(sql`
    select sub.name as name, sum(st.minutes)::int as minutes
    from session_topics st
    join study_sessions ss on ss.id = st.session_id
    join users u on u.id = ss.user_id and (u.settings ->> 'facultyOptIn') = 'true'
    join topics t on t.id = st.topic_id
    join units un on un.id = t.unit_id
    join subjects sub on sub.id = un.subject_id
    where ss.day > current_date - interval '28 days'
    group by sub.name
    order by minutes desc
    limit 6
  `);

  return Response.json({
    optedIn: Boolean((user.settings as Record<string, unknown>)?.facultyOptIn),
    summary: rows.rows[0] ?? { students: 0, avg_minutes_per_day: 0, avg_active_days: 0 },
    topSubjects: topSubjects.rows,
  });
}
