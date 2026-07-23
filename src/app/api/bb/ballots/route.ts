import { NextResponse } from "next/server";
import { getElection } from "@/lib/store/election-store";

export async function GET(request: Request) {
  const electionId = new URL(request.url).searchParams.get("electionId");
  if (!electionId) {
    return NextResponse.json({ ok: false, error: "缺少投票編號" }, { status: 400 });
  }
  const election = await getElection(electionId);
  if (!election) {
    return NextResponse.json({ ok: false, error: "找不到此投票" }, { status: 404 });
  }
  return NextResponse.json({
    electionId: election.electionId,
    phase: election.phase,
    ballots: election.ballots.map((b) => ({
      index: b.index,
      receiptHash: b.receiptHash,
      nullifier: b.nullifier,
      ciphertext: b.ciphertext,
      submittedAt: b.submittedAt,
    })),
  });
}
