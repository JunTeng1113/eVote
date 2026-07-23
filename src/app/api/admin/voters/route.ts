import { NextResponse } from "next/server";
import { requireElectionManager } from "@/lib/auth/session";
import {
  addEligibleEmails,
  removeEligibleEmail,
} from "@/lib/store/election-store";
import {
  adminEmailsSchema,
  removeEmailSchema,
} from "@/lib/schemas/voting";

export async function GET(request: Request) {
  const electionId = new URL(request.url).searchParams.get("electionId");
  if (!electionId) {
    return NextResponse.json({ ok: false, error: "缺少投票編號" }, { status: 400 });
  }
  const access = await requireElectionManager(electionId);
  if (!access.ok || !access.election) {
    return NextResponse.json(access, { status: 403 });
  }
  const election = access.election;
  return NextResponse.json({
    ok: true,
    electionId: election.electionId,
    title: election.title,
    voters: election.voters.map((v) => ({
      email: v.email,
      displayName: v.displayName,
      hasVoted: v.authorized,
      authorizedAt: v.authorizedAt,
    })),
    phase: election.phase,
  });
}

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = adminEmailsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "輸入無效" },
      { status: 400 },
    );
  }
  const access = await requireElectionManager(parsed.data.electionId);
  if (!access.ok) {
    return NextResponse.json(access, { status: 403 });
  }
  try {
    const result = await addEligibleEmails(
      parsed.data.electionId,
      parsed.data.emails,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "新增失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 404 });
  }
}

export async function DELETE(request: Request) {
  const body: unknown = await request.json();
  const parsed = removeEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "輸入無效" },
      { status: 400 },
    );
  }
  const access = await requireElectionManager(parsed.data.electionId);
  if (!access.ok) {
    return NextResponse.json(access, { status: 403 });
  }
  try {
    const removed = await removeEligibleEmail(
      parsed.data.electionId,
      parsed.data.email,
    );
    if (!removed) {
      return NextResponse.json(
        {
          ok: false,
          error: "無法移除（帳號不存在，或此帳號已使用投票權）",
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "移除失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 404 });
  }
}
