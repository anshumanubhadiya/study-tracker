import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { exams, pastRecords } from "@/db/schema";
import { currentUser, unauthorized } from "@/lib/auth";
import { loadState } from "@/lib/server-data";

export const dynamic = "force-dynamic";

type Body =
  | { action: "setExam"; subjectId: number; examDay: string }
  | { action: "clearExam"; subjectId: number }
  | { action: "addRecord"; label: string; marks: number; outOf: number; attendance: number; semester: number }
  | { action: "deleteRecord"; id: number };

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = (await req.json()) as Body;

  if (body.action === "setExam") {
    await db.delete(exams).where(and(eq(exams.userId, user.id), eq(exams.subjectId, body.subjectId)));
    await db.insert(exams).values({ userId: user.id, subjectId: body.subjectId, examDay: body.examDay });
  } else if (body.action === "clearExam") {
    await db.delete(exams).where(and(eq(exams.userId, user.id), eq(exams.subjectId, body.subjectId)));
  } else if (body.action === "addRecord") {
    await db.insert(pastRecords).values({
      userId: user.id,
      label: body.label.slice(0, 80),
      marks: body.marks,
      outOf: body.outOf || 100,
      attendance: body.attendance || 0,
      semester: body.semester || user.semester,
    });
  } else if (body.action === "deleteRecord") {
    await db.delete(pastRecords).where(and(eq(pastRecords.id, body.id), eq(pastRecords.userId, user.id)));
  }

  const state = await loadState(user);
  return Response.json({ ok: true, state });
}
