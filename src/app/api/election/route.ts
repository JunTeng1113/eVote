import { NextResponse } from "next/server";
import { buildPublicElectionView } from "@/lib/election-view";
import {
  electionSummary,
  getElection,
  listElections,
} from "@/lib/store/election-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const election = await getElection(id);
    if (!election) {
      return NextResponse.json({ ok: false, error: "找不到此投票" }, { status: 404 });
    }
    return NextResponse.json(buildPublicElectionView(election));
  }

  const elections = await listElections();
  return NextResponse.json({
    elections: elections.map(electionSummary),
  });
}
