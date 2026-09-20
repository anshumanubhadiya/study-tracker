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
  // The preview is embedded in an iframe (third-party context). A `lax`
  // cookie is not sent there, which made sign-in look broken. `none` +
  // `secure` is the only way for the cookie to work embedded; the
  // Authorization-token fallback in client-auth.ts covers the browsers that
  // block third-party cookies entirely.
  jar.set(COOKIE, makeToken(userId), {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/**
 * Session tokens travel over two paths:
 *  1. httpOnly cookie (normal browsers)
 *  2. Authorization: Bearer header (for preview/proxy contexts where the
 *     browser refuses to persist or send the cookie — the token is returned
 *     in the sign-in response and kept in localStorage by the client)
 */
export function tokenFromRequest(req: Request | undefined): string | null {
  if (!req) return null;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return req.headers.get("x-session-token");
}

export async function currentUserId(req?: Request): Promise<number | null> {
  const fromHeader = readToken(tokenFromRequest(req) ?? undefined);
  if (fromHeader) return fromHeader;
  const jar = await cookies();
  return readToken(jar.get(COOKIE)?.value);
}

export async function currentUser(req?: Request) {
  const id = await currentUserId(req);
  if (!id) return null;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}
