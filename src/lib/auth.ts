import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const COOKIE = "gtu_session";
const SECRET = process.env.SESSION_SECRET || "gtu-study-tracker-dev-secret";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const known = Buffer.from(hash, "hex");
  if (known.length !== candidate.length) return false;
  return timingSafeEqual(candidate, known);
}

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex").slice(0, 32);
}

export function makeToken(userId: number): string {
  const payload = `${userId}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

export function readToken(token: string | undefined): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, ts, sig] = parts;
  if (sign(`${id}.${ts}`) !== sig) return null;
  const userId = Number(id);
  return Number.isFinite(userId) ? userId : null;
}

export async function setSession(userId: number) {
  const jar = await cookies();
  jar.set(COOKIE, makeToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function currentUserId(): Promise<number | null> {
  const jar = await cookies();
  return readToken(jar.get(COOKIE)?.value);
}

export async function currentUser() {
  const id = await currentUserId();
  if (!id) return null;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}
