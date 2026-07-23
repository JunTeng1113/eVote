import { NextResponse } from "next/server";
import { getVoterStatus, issueAuthTicket } from "@/lib/services/auth-service";
import { requireSessionUser } from "@/lib/auth/session";
import { findVoterByEmail, listElections } from "@/lib/store/election-store";
import {
  formatElectionScheduleLabel,
  getVotingWindowStatus,
} from "@/lib/voting-schedule";
import { resolveElectionSchedule } from "@/lib/voting-schedule-server";

export async function GET(request: Request) {
  const user = await requireSessionUser();
  if (!user.ok || !user.email) {
    return NextResponse.json(user, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const electionId = searchParams.get("electionId");

  if (!electionId) {
    try {
      const elections = await listElections();
      const available = await Promise.all(
        elections.map(async (election) => {
          const voter = await findVoterByEmail(election.electionId, user.email);
          const schedule = await resolveElectionSchedule(
            election.electionId,
            election,
          );
          return {
            electionId: election.electionId,
            title: election.title,
            description: election.description,
            phase: schedule.phase,
            scheduleMode: election.scheduleMode,
            scheduleLabel: formatElectionScheduleLabel({
              scheduleMode: election.scheduleMode,
              votingStartsAt: election.votingStartsAt,
              votingEndsAt: election.votingEndsAt,
            }),
            windowStatus: getVotingWindowStatus(schedule),
            eligible: Boolean(voter),
            hasVoted: Boolean(voter?.authorized),
          };
        }),
      );
      return NextResponse.json({
        ok: true,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        elections: available,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "無法載入投票列表";
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }

  try {
    return NextResponse.json({
      ok: true,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
      ...(await getVoterStatus(electionId, user.email)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "找不到此投票";
    return NextResponse.json({ ok: false, error: message }, { status: 404 });
  }
}

export async function POST(request: Request) {
  const user = await requireSessionUser();
  if (!user.ok || !user.email) {
    return NextResponse.json(user, { status: 401 });
  }

  const body: unknown = await request.json();
  const electionId =
    typeof body === "object" &&
    body !== null &&
    "electionId" in body &&
    typeof (body as { electionId: unknown }).electionId === "string"
      ? (body as { electionId: string }).electionId
      : null;
  if (!electionId) {
    return NextResponse.json({ ok: false, error: "缺少投票編號" }, { status: 400 });
  }

  try {
    const result = await issueAuthTicket(electionId, user.email);
    if (!result.ok) {
      return NextResponse.json(result, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法取得投票資格";
    return NextResponse.json({ ok: false, error: message }, { status: 404 });
  }
}
