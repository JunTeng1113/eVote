import { updateElectionPhase } from "@/lib/store/election-store";
import {
  electionScheduleFrom,
  getVotingWindowStatus,
  type ElectionSchedule,
} from "@/lib/voting-schedule";

export async function syncTimedElectionClose(
  electionId: string,
  schedule: ElectionSchedule,
): Promise<ElectionSchedule> {
  const status = getVotingWindowStatus(schedule);
  if (
    (schedule.scheduleMode === "timed" ||
      schedule.scheduleMode === "duration") &&
    schedule.phase === "voting" &&
    status === "ended"
  ) {
    await updateElectionPhase(electionId, "closed");
    return { ...schedule, phase: "closed" };
  }
  return schedule;
}

export async function resolveElectionSchedule(
  electionId: string,
  election: Pick<
    ElectionSchedule,
    "phase" | "scheduleMode" | "votingStartsAt" | "votingEndsAt"
  >,
): Promise<ElectionSchedule> {
  const schedule = electionScheduleFrom(election);
  return syncTimedElectionClose(electionId, schedule);
}
