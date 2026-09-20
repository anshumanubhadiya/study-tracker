import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { currentUser, unauthorized } from "@/lib/auth";
import { readJsonBody } from "@/lib/http";
import { ensureDb } from "@/lib/bootstrap";
import { MAX_SEMESTER, MIN_SEMESTER } from "@/lib/seed-data";
import { toUserDTO } from "@/lib/server-data";
import { DEFAULT_SETTINGS, type UserSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureDb();
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = await readJsonBody<{
    name?: string;
    theme?: string;
    accent?: string;
    university?: string;
    course?: string;
    semester?: number;
    settings?: Partial<UserSettings>;
  }>(req);
  if (!body) return Response.json({ error: "Invalid request body" }, { status: 400 });

  const semester =
    body.semester !== undefined
      ? Math.min(MAX_SEMESTER, Math.max(MIN_SEMESTER, Math.round(Number(body.semester) || MIN_SEMESTER)))
      : undefined;
  const merged = { ...DEFAULT_SETTINGS, ...(user.settings as Partial<UserSettings>), ...(body.settings ?? {}) };
  const [updated] = await db
    .update(users)
    .set({
      ...(body.name ? { name: body.name.trim().slice(0, 40) || user.name } : {}),
      ...(body.theme ? { theme: body.theme } : {}),
      ...(body.accent ? { accent: body.accent } : {}),
      ...(typeof body.university === "string" && body.university.trim()
        ? { university: body.university.trim().slice(0, 40) }
        : {}),
      ...(typeof body.course === "string" && body.course.trim()
        ? { course: body.course.trim().slice(0, 40) }
        : {}),
      ...(semester ? { semester } : {}),
      settings: merged as Record<string, unknown>,
    })
    .where(eq(users.id, user.id))
    .returning();

  return Response.json({ ok: true, user: toUserDTO(updated) });
}
