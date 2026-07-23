import { blindSign } from "@/lib/crypto/blind-signature-server";
import { domainSeparatedHash } from "@/lib/crypto/hash";
import {
  consumeAuthTicket,
  findAuthTicket,
  requireElection,
} from "@/lib/store/election-store";
import {
  getVotingWindowStatus,
  votingWindowMessage,
} from "@/lib/voting-schedule";
import { resolveElectionSchedule } from "@/lib/voting-schedule-server";

export async function issueBlindSignature(
  electionId: string,
  authTicket: string,
  blindedMessage: string,
) {
  const election = await requireElection(electionId);
  const schedule = await resolveElectionSchedule(electionId, election);
  const windowStatus = getVotingWindowStatus(schedule);
  if (windowStatus !== "open") {
    return { ok: false as const, error: votingWindowMessage(windowStatus) };
  }

  const ticket = await findAuthTicket(electionId, authTicket);
  if (!ticket) {
    return { ok: false as const, error: "投票資格無效，請重新登入後再試" };
  }
  if (ticket.consumed) {
    return { ok: false as const, error: "投票資格已使用" };
  }

  const signaturePrime = blindSign(blindedMessage, election.issuer);
  const consumed = await consumeAuthTicket(electionId, authTicket);
  if (!consumed) {
    return { ok: false as const, error: "投票資格已使用" };
  }

  return {
    ok: true as const,
    blindedSignature: signaturePrime,
    issuerPublic: {
      n: election.issuer.n,
      e: election.issuer.e,
    },
    auditNote: domainSeparatedHash(
      "issuer-audit",
      domainSeparatedHash("ticket-hash", authTicket),
      domainSeparatedHash("blinded-msg", blindedMessage),
    ),
  };
}
