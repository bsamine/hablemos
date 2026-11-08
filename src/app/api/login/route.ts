import { NextResponse } from "next/server";
import { authCookieValue, checkPasscode, COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const code = String(form.get("code") ?? "");
  const url = new URL(req.url);
  if (!checkPasscode(code)) {
    return NextResponse.redirect(new URL("/login?e=1", url), 303);
  }
  const res = NextResponse.redirect(new URL("/", url), 303);
  res.cookies.set(COOKIE, authCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return res;
}
