import { domainSeparatedHash } from "@/lib/crypto/hash";
import {
  findNamedBallotByEmail,
  findVoterByEmail,
  normalizeEmail,
  requireElection,
  saveAuthTicketIssue,
} from "@/lib/store/election-store";
import {
  getVotingWindowStatus,
  votingWindowMessage,
} from "@/lib/voting-schedule";
import { resolveElectionSchedule } from "@/lib/voting-schedule-server";
import {
  isGuestOpenMode,
  isNamedBallotMode,
  requiresEligibleList,
} from "@/lib/voting-mode";

export async function issueAuthTicket(electionId: string, email: string) {
  const election = await requireElection(electionId);
  if (election.votingMode !== "anonymous") {
    return {
      ok: false as const,
      error: isGuestOpenMode(election.votingMode)
        ? "此場為無須登入投票，無需領取匿名投票憑證"
        : isNamedBallotMode(election.votingMode)
          ? "此場為記名投票，無需領取匿名投票憑證"
          : "此場投票方式不符",
    };
  }
  const schedule = await resolveElectionSchedule(electionId, election);
  const windowStatus = getVotingWindowStatus(schedule);
  if (windowStatus !== "open") {
    return { ok: false as const, error: votingWindowMessage(windowStatus) };
  }

  const voter = await findVoterByEmail(electionId, email);
  if (!voter) {
    return {
      ok: false as const,
      error: "你的帳號不在本次可投票名單中，請聯繫主辦單位",
    };
  }
  if (voter.authorized) {
    return { ok: false as const, error: "你已經投過票了" };
  }

  const voterId = normalizeEmail(email);
  const nonce = domainSeparatedHash(
    "auth-nonce",
    voterId,
    election.electionId,
    String(Date.now()),
    crypto.randomUUID(),
  );
  const ticket = domainSeparatedHash(
    "auth-ticket",
    election.electionId,
    voterId,
    nonce,
  );
  const authTicketHash = domainSeparatedHash("ticket-hash", ticket);

  await saveAuthTicketIssue({
    electionId,
    email: voterId,
    ticket,
    authTicketHash,
  });

  return {
    ok: true as const,
    authTicket: ticket,
    electionId: election.electionId,
  };
}

export async function getVoterStatus(electionId: string, email: string) {
  const election = await requireElection(electionId);
  const schedule = await resolveElectionSchedule(electionId, election);
  const windowStatus = getVotingWindowStatus(schedule);

  if (election.votingMode === "named_open") {
    const named = await findNamedBallotByEmail(electionId, email);
    return {
      eligible: true,
      hasVoted: Boolean(named),
      phase: schedule.phase,
      windowStatus,
      message: named
        ? "你已經完成投票"
        : windowStatus === "open"
          ? "你可以投票"
          : votingWindowMessage(windowStatus),
    };
  }

  if (!requiresEligibleList(election.votingMode)) {
    return {
      eligible: false,
      hasVoted: false,
      phase: schedule.phase,
      windowStatus,
      message: "此場投票方式請使用對應流程",
    };
  }

  const voter = await findVoterByEmail(electionId, email);
  if (!voter) {
    return {
      eligible: false,
      hasVoted: false,
      phase: schedule.phase,
      windowStatus,
      message: "你的帳號不在本次可投票名單中",
    };
  }
  return {
    eligible: true,
    hasVoted: voter.authorized,
    phase: schedule.phase,
    windowStatus,
    message: voter.authorized
      ? "你已經完成投票"
      : windowStatus === "open"
        ? "你可以投票"
        : votingWindowMessage(windowStatus),
  };
}
