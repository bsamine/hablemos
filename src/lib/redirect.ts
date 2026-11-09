import { NextResponse } from "next/server";

/** Relative 303 redirect: correct behind the reverse proxy. */
export const go = (path: string) => new NextResponse(null, { status: 303, headers: { Location: path } });
