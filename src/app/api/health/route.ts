import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** For Docker's healthcheck and uptime checks. Says nothing about the learner. */
export async function GET() {
  try {
    db().prepare("SELECT 1").get();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
