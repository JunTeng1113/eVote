import {
  publicElectionView,
  type ElectionState,
} from "@/lib/store/election-store";
import {
  electionScheduleFrom,
  formatElectionScheduleLabel,
  getVotingWindowStatus,
} from "@/lib/voting-schedule";

export function buildPublicElectionView(state: ElectionState) {
  const schedule = electionScheduleFrom(state);
  return {
    ...publicElectionView(state),
    windowStatus: getVotingWindowStatus(schedule),
    scheduleLabel: formatElectionScheduleLabel({
      scheduleMode: state.scheduleMode,
      votingStartsAt: state.votingStartsAt,
      votingEndsAt: state.votingEndsAt,
    }),
  };
}
