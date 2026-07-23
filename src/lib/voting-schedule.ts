export type ElectionPhase = "voting" | "closed" | "mixing" | "tallied";
export type ScheduleMode = "unlimited" | "timed" | "duration";

export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 30 * 24 * 60; // 30 天

export type ElectionSchedule = {
  phase: ElectionPhase;
  scheduleMode: ScheduleMode;
  votingStartsAt: string | null;
  votingEndsAt: string | null;
};

export type VotingWindowStatus = "open" | "not_started" | "ended" | "closed";

export function electionScheduleFrom(
  election: Pick<
    ElectionSchedule,
    "phase" | "scheduleMode" | "votingStartsAt" | "votingEndsAt"
  >,
): ElectionSchedule {
  return {
    phase: election.phase,
    scheduleMode: election.scheduleMode,
    votingStartsAt: election.votingStartsAt,
    votingEndsAt: election.votingEndsAt,
  };
}

function hasFixedWindow(scheduleMode: ScheduleMode): boolean {
  return scheduleMode === "timed" || scheduleMode === "duration";
}

export function getVotingWindowStatus(
  schedule: ElectionSchedule,
  now = new Date(),
): VotingWindowStatus {
  if (schedule.phase !== "voting") {
    return "closed";
  }
  if (!hasFixedWindow(schedule.scheduleMode)) {
    return "open";
  }
  const start = schedule.votingStartsAt
    ? new Date(schedule.votingStartsAt)
    : null;
  const end = schedule.votingEndsAt ? new Date(schedule.votingEndsAt) : null;
  if (start && now < start) {
    return "not_started";
  }
  if (end && now > end) {
    return "ended";
  }
  return "open";
}

export function votingWindowMessage(status: VotingWindowStatus): string {
  switch (status) {
    case "not_started":
      return "投票尚未開始";
    case "ended":
      return "投票時間已結束";
    case "closed":
      return "投票已截止";
    default:
      return "你可以投票";
  }
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) {
    return "—";
  }
  if (minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return `${days} 天`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} 小時`;
  }
  return `${minutes} 分鐘`;
}

export function durationMinutesFromParts(
  value: number,
  unit: "minutes" | "hours" | "days",
): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (unit === "days") {
    return Math.round(value * 24 * 60);
  }
  if (unit === "hours") {
    return Math.round(value * 60);
  }
  return Math.round(value);
}

export function formatScheduleRange(
  startsAt: string | null,
  endsAt: string | null,
): string {
  if (!startsAt && !endsAt) {
    return "無時間限制";
  }
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  if (startsAt && endsAt) {
    return `${fmt(startsAt)} ～ ${fmt(endsAt)}`;
  }
  if (startsAt) {
    return `${fmt(startsAt)} 起`;
  }
  return `${fmt(endsAt!)} 止`;
}

export function formatElectionScheduleLabel(params: {
  scheduleMode: ScheduleMode;
  votingStartsAt: string | null;
  votingEndsAt: string | null;
}): string {
  const range = formatScheduleRange(params.votingStartsAt, params.votingEndsAt);
  if (params.scheduleMode === "duration" && params.votingStartsAt && params.votingEndsAt) {
    const start = new Date(params.votingStartsAt).getTime();
    const end = new Date(params.votingEndsAt).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      const minutes = Math.round((end - start) / 60000);
      return `限時 ${formatDurationMinutes(minutes)}（${range}）`;
    }
  }
  return range;
}

export function canReopenVoting(
  schedule: ElectionSchedule,
  now = new Date(),
): boolean {
  if (schedule.phase !== "closed") {
    return false;
  }
  if (!hasFixedWindow(schedule.scheduleMode)) {
    return true;
  }
  const end = schedule.votingEndsAt ? new Date(schedule.votingEndsAt) : null;
  return !end || now <= end;
}
