import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { planEntries, planOverrides } from "@/db/schema";
import { currentUser, unauthorized } from "@/lib/auth";
import { readJsonBody } from "@/lib/http";
import { loadState } from "@/lib/server-data";

export const dynamic = "force-dynamic";

type Body =
  | { action: "add"; weekday: number; subjectId: number; topicIds: number[]; targetMinutes: number }
  | { action: "update"; id: number; topicIds?: number[]; targetMinutes?: number; weekday?: number }
  | { action: "delete"; id: number }
  | { action: "reschedule"; fromDay: string; toDay: string | null }
  | { action: "clearOverride"; id: number };

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = await readJsonBody<Body>(req);
  if (!body) return Response.json({ error: "Invalid request body" }, { status: 400 });

  if (body.action === "add") {
    const count = await db.select().from(planEntries).where(eq(planEntries.userId, user.id));
    await db.insert(planEntries).values({
      userId: user.id,
      weekday: body.weekday,
      subjectId: body.subjectId,
      topicIds: body.topicIds ?? [],
      targetMinutes: body.targetMinutes || 50,
      position: count.length,
    });
  } else if (body.action === "update") {
    await db
      .update(planEntries)
      .set({
        ...(body.topicIds ? { topicIds: body.topicIds } : {}),
        ...(body.targetMinutes ? { targetMinutes: body.targetMinutes } : {}),
        ...(body.weekday !== undefined ? { weekday: body.weekday } : {}),
      })
      .where(and(eq(planEntries.id, body.id), eq(planEntries.userId, user.id)));
  } else if (body.action === "delete") {
    await db.delete(planEntries).where(and(eq(planEntries.id, body.id), eq(planEntries.userId, user.id)));
  } else if (body.action === "reschedule") {
    await db.delete(planOverrides).where(and(eq(planOverrides.userId, user.id), eq(planOverrides.fromDay, body.fromDay)));
    await db.insert(planOverrides).values({ userId: user.id, fromDay: body.fromDay, toDay: body.toDay });
  } else if (body.action === "clearOverride") {
    await db.delete(planOverrides).where(and(eq(planOverrides.id, body.id), eq(planOverrides.userId, user.id)));
  }

  const state = await loadState(user);
  return Response.json({ ok: true, state });
}
