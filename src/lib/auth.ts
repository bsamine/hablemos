import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const COOKIE = "hablemos_auth";

function expectedToken(): string {
  const secret = process.env.SESSION_SECRET;
  const pass = process.env.APP_PASSCODE;
  if (!secret || !pass) throw new Error("SESSION_SECRET and APP_PASSCODE must be set");
  return crypto.createHmac("sha256", secret).update(`ok:${pass}`).digest("hex");
}

export function checkPasscode(input: string): boolean {
  const pass = process.env.APP_PASSCODE ?? "";
  const a = Buffer.from(input.trim());
  const b = Buffer.from(pass);
  return a.length === b.length && b.length > 0 && crypto.timingSafeEqual(a, b);
}

export function authCookieValue(): string {
  return expectedToken();
}

export async function isAuthed(): Promise<boolean> {
  const jar = await cookies();
  const v = jar.get(COOKIE)?.value;
  if (!v) return false;
  const exp = expectedToken();
  return v.length === exp.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(exp));
}

/** For pages: send to /login when not logged in. */
export async function requireAuth(): Promise<void> {
  if (!(await isAuthed())) redirect("/login");
}
