import { NextResponse } from "next/server";
import { requireElectionManager } from "@/lib/auth/session";
import { closeVoting, reopenVoting, runTally } from "@/lib/services/tally-service";
import { buildPublicElectionView } from "@/lib/election-view";
import {
  getElection,
  listElections,
} from "@/lib/store/election-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const electionId = searchParams.get("electionId");

  try {
    if (!electionId) {
      const elections = await listElections();
      return NextResponse.json({
        elections: elections.map((election) => ({
          ...buildPublicElectionView(election),
          tallyDetail: election.tally
            ? {
                counts: election.tally.counts,
                total: election.tally.total,
                talliedAt: election.tally.talliedAt,
                namedVotes: election.tally.namedVotes,
              }
            : null,
        })),
      });
    }

    const election = await getElection(electionId);
    if (!election) {
      return NextResponse.json(
        { ok: false, error: "找不到此投票" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ...buildPublicElectionView(election),
      tallyDetail: election.tally
        ? {
            counts: election.tally.counts,
            total: election.tally.total,
            talliedAt: election.tally.talliedAt,
            mixProofs: election.tally.mixProofs,
            decryptionProofCount: election.tally.decryptionProofs.length,
            namedVotes: election.tally.namedVotes,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "載入開票資料失敗";
    return NextResponse.json({ ok: false, error: message, elections: [] }, {
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: string;
    electionId?: string;
  };
  if (!body.electionId) {
    return NextResponse.json({ ok: false, error: "缺少投票編號" }, { status: 400 });
  }

  const access = await requireElectionManager(body.electionId);
  if (!access.ok) {
    return NextResponse.json(access, { status: 403 });
  }

  try {
    if (body.action === "close") {
      const result = await closeVoting(body.electionId);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    if (body.action === "reopen") {
      const result = await reopenVoting(body.electionId);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    if (body.action === "tally") {
      const result = await runTally(body.electionId);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    return NextResponse.json({ ok: false, error: "未知操作" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "操作失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 404 });
  }
}
