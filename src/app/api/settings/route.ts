import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { currentUser, unauthorized } from "@/lib/auth";
import { toUserDTO } from "@/lib/server-data";
import { DEFAULT_SETTINGS, type UserSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = (await req.json()) as {
    name?: string;
    theme?: string;
    accent?: string;
    semester?: number;
    settings?: Partial<UserSettings>;
  };

  const merged = { ...DEFAULT_SETTINGS, ...(user.settings as Partial<UserSettings>), ...(body.settings ?? {}) };
  const [updated] = await db
    .update(users)
    .set({
      ...(body.name ? { name: body.name.slice(0, 40) } : {}),
      ...(body.theme ? { theme: body.theme } : {}),
      ...(body.accent ? { accent: body.accent } : {}),
      ...(body.semester ? { semester: body.semester } : {}),
      settings: merged as Record<string, unknown>,
    })
    .where(eq(users.id, user.id))
    .returning();

  return Response.json({ ok: true, user: toUserDTO(updated) });
}
