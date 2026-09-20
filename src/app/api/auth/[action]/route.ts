import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { clearSession, currentUser, hashPassword, setSession, verifyPassword } from "@/lib/auth";
import { MAX_SEMESTER, MIN_SEMESTER } from "@/lib/seed-data";
import { ensureDb } from "@/lib/bootstrap";
import { ensureSeed, seedDemoData, toUserDTO } from "@/lib/server-data";

export const dynamic = "force-dynamic";

function clampSemester(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 3;
  return Math.min(MAX_SEMESTER, Math.max(MIN_SEMESTER, Math.round(n)));
}

function cleanLabel(v: unknown, fallback: string): string {
  const s = typeof v === "string" ? v.trim().slice(0, 40) : "";
  return s || fallback;
}

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  await ensureSeed(); // also runs the schema bootstrap, so a fresh DB just works

  if (action === "logout") {
    await clearSession();
    return Response.json({ ok: true });
  }

  if (action === "guest") {
    // the guest demo rides on the built-in sample library (GTU BCA, Sem 3)
    const email = `guest-${Date.now().toString(36)}@demo.local`;
    const [user] = await db
      .insert(users)
      .values({
        email,
        name: "Guest Student",
        passwordHash: hashPassword(crypto.randomUUID()),
        isGuest: true,
        university: "GTU",
        course: "BCA",
        semester: 3,
      })
      .returning();
    await seedDemoData(user.id);
    await setSession(user.id);
    return Response.json({ ok: true, user: toUserDTO(user) });
  }

  let body: {
    email?: string;
    password?: string;
    name?: string;
    university?: string;
    course?: string;
    semester?: number;
    demo?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body */
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (action === "register") {
    if (!email.includes("@") || password.length < 4) {
      return Response.json({ error: "Enter a valid email and a password of 4+ characters." }, { status: 400 });
    }
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length) return Response.json({ error: "That email already has a profile." }, { status: 409 });

    const [user] = await db
      .insert(users)
      .values({
        email,
        name: body.name?.trim().slice(0, 40) || email.split("@")[0],
        passwordHash: hashPassword(password),
        university: cleanLabel(body.university, "GTU"),
        course: cleanLabel(body.course, "BCA"),
        semester: clampSemester(body.semester),
      })
      .returning();
    if (body.demo) await seedDemoData(user.id);
    await setSession(user.id);
    return Response.json({ ok: true, user: toUserDTO(user) });
  }

  if (action === "login") {
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return Response.json({ error: "Wrong email or password." }, { status: 401 });
    }
    await setSession(user.id);
    return Response.json({ ok: true, user: toUserDTO(user) });
  }

  return Response.json({ error: "Unknown action" }, { status: 404 });
}

export async function GET(_req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action !== "me") return Response.json({ error: "Unknown action" }, { status: 404 });
  const user = await currentUser();
  return Response.json({ user: user ? toUserDTO(user) : null });
}
