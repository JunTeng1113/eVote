import { NextResponse } from "next/server";
import { requireElectionManager } from "@/lib/auth/session";
import { listElectionChangeLogs } from "@/lib/store/election-change-log";

export async function GET(request: Request) {
  const electionId = new URL(request.url).searchParams.get("electionId");
  if (!electionId) {
    return NextResponse.json({ ok: false, error: "缺少投票編號" }, { status: 400 });
  }
  const access = await requireElectionManager(electionId);
  if (!access.ok) {
    return NextResponse.json(access, { status: 403 });
  }
  const logs = await listElectionChangeLogs(electionId);
  return NextResponse.json({ ok: true, logs });
}
