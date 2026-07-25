import { NextResponse } from "next/server";
import { z } from "zod";
import {
  countOnlineDevices,
  heartbeatAndCountOnline,
} from "@/lib/store/online-presence";

const heartbeatSchema = z.object({
  deviceId: z
    .string()
    .min(8, "裝置識別無效")
    .max(64, "裝置識別無效")
    .regex(/^[a-zA-Z0-9_-]+$/, "裝置識別無效"),
});

export async function GET() {
  const onlineCount = await countOnlineDevices();
  return NextResponse.json({ ok: true, onlineCount });
}

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = heartbeatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "輸入無效" },
      { status: 400 },
    );
  }

  const onlineCount = await heartbeatAndCountOnline(parsed.data.deviceId);
  return NextResponse.json({ ok: true, onlineCount });
}
