import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const qstashToken = process.env.QSTASH_TOKEN;
  // Mirror the same fallback chain used in updateSettings
  const appUrl = process.env.APP_URL 
    || process.env.NEXT_PUBLIC_APP_URL 
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

  const diagnostics: Record<string, any> = {
    env: {
      QSTASH_TOKEN_present: !!qstashToken,
      QSTASH_TOKEN_prefix: qstashToken?.substring(0, 8) + "...",
      APP_URL: process.env.APP_URL || "(not set)",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "(not set — client-side only on Vercel!)",
      VERCEL_URL: process.env.VERCEL_URL || "(not set)",
      resolved_appUrl: appUrl || "⚠️ NONE — this is why schedule creation fails!",
      CRON_SECRET_present: !!process.env.CRON_SECRET,
    },
    qstash: null as any,
    schedules: null as any,
  };

  if (!qstashToken) {
    return NextResponse.json({ ...diagnostics, error: "QSTASH_TOKEN missing" }, { status: 500 });
  }

  try {
    const { Client } = await import("@upstash/qstash");
    const client = new Client({ token: qstashToken });
    const schedules = await client.schedules.list();
    diagnostics.schedules = schedules;
    diagnostics.qstash = "connected";
    return NextResponse.json(diagnostics);
  } catch (e: any) {
    diagnostics.qstash = "error";
    diagnostics.error = e?.message || String(e);
    return NextResponse.json(diagnostics, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const qstashToken = process.env.QSTASH_TOKEN;
  const appUrl = process.env.APP_URL 
    || process.env.NEXT_PUBLIC_APP_URL 
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

  if (!qstashToken) {
    return NextResponse.json({ error: "QSTASH_TOKEN missing" }, { status: 500 });
  }
  if (!appUrl) {
    return NextResponse.json({ 
      error: "No app URL resolved. Add APP_URL env var on Vercel (without NEXT_PUBLIC_ prefix).",
    }, { status: 500 });
  }

  try {
    const { Client } = await import("@upstash/qstash");
    const client = new Client({ token: qstashToken });

    const { userId, time, timezone } = await req.json();
    const [h, m] = (time || "09:00").split(":");
    const tz = timezone || "Asia/Kolkata";
    const cron = `CRON_TZ=${tz} ${Number(m)} ${Number(h)} * * *`;
    const baseUrl = appUrl.replace(/\/$/, "");

    const res = await client.schedules.create({
      destination: `${baseUrl}/api/cron/reminders`,
      cron: cron,
      body: JSON.stringify({ userId: userId || 1 }),
      headers: {
        "Authorization": `Bearer ${process.env.CRON_SECRET}`,
        "Content-Type": "application/json",
      },
    });

    return NextResponse.json({ success: true, scheduleId: res.scheduleId, cron, resolvedAppUrl: baseUrl });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}
