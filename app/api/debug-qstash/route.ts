import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// DIAGNOSTIC ONLY — remove before production or protect with CRON_SECRET
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const diagnostics: Record<string, any> = {
    env: {
      QSTASH_TOKEN_present: !!process.env.QSTASH_TOKEN,
      QSTASH_TOKEN_prefix: process.env.QSTASH_TOKEN?.substring(0, 8) + "...",
      QSTASH_URL: process.env.QSTASH_URL || "(not set)",
      QSTASH_CURRENT_SIGNING_KEY_present: !!process.env.QSTASH_CURRENT_SIGNING_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "(not set)",
      CRON_SECRET_present: !!process.env.CRON_SECRET,
    },
    qstash: null as any,
    schedules: null as any,
  };

  if (!process.env.QSTASH_TOKEN) {
    return NextResponse.json({ ...diagnostics, error: "QSTASH_TOKEN missing from environment" }, { status: 500 });
  }

  try {
    const { Client } = await import("@upstash/qstash");
    const client = new Client({ token: process.env.QSTASH_TOKEN });

    // List all existing schedules
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

// Test schedule creation
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!process.env.QSTASH_TOKEN) {
    return NextResponse.json({ error: "QSTASH_TOKEN missing" }, { status: 500 });
  }

  try {
    const { Client } = await import("@upstash/qstash");
    const client = new Client({ token: process.env.QSTASH_TOKEN });

    const { userId, time, timezone } = await req.json();
    const [h, m] = (time || "09:00").split(":");
    const tz = timezone || "Asia/Kolkata";
    const cron = `CRON_TZ=${tz} ${Number(m)} ${Number(h)} * * *`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL!.replace(/\/$/, "");

    console.log(`[QStash Debug] Creating test schedule: ${cron} → ${baseUrl}/api/cron/reminders`);

    const res = await client.schedules.create({
      destination: `${baseUrl}/api/cron/reminders`,
      cron: cron,
      body: JSON.stringify({ userId: userId || 1 }),
      headers: {
        "Authorization": `Bearer ${process.env.CRON_SECRET}`,
        "Content-Type": "application/json",
      },
    });

    return NextResponse.json({ success: true, scheduleId: res.scheduleId, cron });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}
