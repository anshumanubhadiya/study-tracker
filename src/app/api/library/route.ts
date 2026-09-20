import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { scans, semesters, subjects, topics, units } from "@/db/schema";
import { currentUser, unauthorized } from "@/lib/auth";
import { readJsonBody } from "@/lib/http";
import { insertSubjectTree, loadState } from "@/lib/server-data";
import { parseSyllabusText } from "@/lib/syllabus";
import type { ParsedSyllabus } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body =
  | { action: "parse"; text: string; semester?: number }
  | { action: "import"; parsed: ParsedSyllabus; fileName?: string; rawText?: string }
  | { action: "addTopic"; unitId: number; title: string; weightage: number; difficulty?: number }
  | { action: "addUnit"; subjectId: number; title: string; weightage: number }
  | { action: "deleteSubject"; subjectId: number };

export async function POST(req: Request) {
  const user = await currentUser(req);
  if (!user) return unauthorized();
  const body = await readJsonBody<Body>(req);
  if (!body) return Response.json({ error: "Invalid request body" }, { status: 400 });

  if (body.action === "parse") {
    const report = parseSyllabusText(body.text ?? "", body.semester ?? user.semester);
    return Response.json(report);
  }

  if (body.action === "import") {
    const parsed = body.parsed;
    if (!parsed?.subject?.trim()) return Response.json({ error: "Subject name is required" }, { status: 400 });
    const semNumber = Math.min(8, Math.max(1, parsed.semester || user.semester));
    let sem = (await db.select().from(semesters).where(eq(semesters.number, semNumber)).limit(1))[0];
    if (!sem) {
      [sem] = await db.insert(semesters).values({ number: semNumber, name: `Semester ${semNumber}` }).returning();
    }

    const palette = ["blue", "orange", "purple", "pink", "teal", "indigo", "green"];
    const created = await insertSubjectTree(
      sem.id,
      {
        name: parsed.subject.trim(),
        code: parsed.code ?? "",
        credits: parsed.credits || 4,
        color: palette[(parsed.subject.length + semNumber) % palette.length],
        icon: "book",
        units: (parsed.units ?? []).map((u, i) => ({
          number: u.number || i + 1,
          title: u.title || `Unit ${i + 1}`,
          weightage: Math.round(u.weightage || 0),
          topics: (u.topics ?? [])
            .filter((t) => t.title?.trim())
            .map((t) => ({ title: t.title.trim(), weightage: Math.round(t.weightage || 0) })),
        })),
      },
      "scanner",
      user.id,
    );

    await db.insert(scans).values({
      userId: user.id,
      fileName: body.fileName ?? "",
      rawText: (body.rawText ?? "").slice(0, 20000),
      parsed,
      status: "saved",
      semesterNumber: semNumber,
    });

    const state = await loadState(user);
    return Response.json({ ok: true, subjectId: created.id, state });
  }

  if (body.action === "addUnit") {
    const existing = await db.select().from(units).where(eq(units.subjectId, body.subjectId)).orderBy(asc(units.number));
    await db.insert(units).values({
      subjectId: body.subjectId,
      number: (existing.at(-1)?.number ?? 0) + 1,
      title: body.title || `Unit ${existing.length + 1}`,
      weightage: Math.round(body.weightage || 0),
    });
  }

  if (body.action === "addTopic") {
    await db.insert(topics).values({
      unitId: body.unitId,
      title: body.title,
      weightage: Math.round(body.weightage || 0),
      difficulty: body.difficulty ?? 2,
      source: "custom",
      createdBy: user.id,
    });
  }

  if (body.action === "deleteSubject") {
    const subject = (await db.select().from(subjects).where(eq(subjects.id, body.subjectId)).limit(1))[0];
    if (subject && subject.createdBy === user.id) {
      const unitRows = await db.select().from(units).where(eq(units.subjectId, subject.id));
      if (unitRows.length) {
        await db.delete(topics).where(inArray(topics.unitId, unitRows.map((u) => u.id)));
        await db.delete(units).where(eq(units.subjectId, subject.id));
      }
      await db.delete(subjects).where(and(eq(subjects.id, subject.id), eq(subjects.createdBy, user.id)));
    }
  }

  const state = await loadState(user);
  return Response.json({ ok: true, state });
}
