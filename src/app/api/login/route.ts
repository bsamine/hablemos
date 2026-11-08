import { NextResponse } from "next/server";
import { authCookieValue, checkPasscode, COOKIE } from "@/lib/auth";

// Relative Location headers: correct behind any reverse proxy (Caddy), whatever the internal URL is.
const go = (path: string) => new NextResponse(null, { status: 303, headers: { Location: path } });

export async function POST(req: Request) {
  const form = await req.formData();
  const code = String(form.get("code") ?? "");
  if (!checkPasscode(code)) return go("/login?e=1");

  const https = (req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")) === "https";
  const res = go("/");
  res.cookies.set(COOKIE, authCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return res;
}
