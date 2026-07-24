/** 產生供投票權人使用的專屬投票連結（路徑含 electionId）。 */
export function buildVotePath(electionId: string): string {
  return `/vote/${encodeURIComponent(electionId)}`;
}

export function buildVoteShareUrl(
  electionId: string,
  origin?: string | null,
): string {
  const path = buildVotePath(electionId);
  if (origin && origin.length > 0) {
    return `${origin.replace(/\/$/, "")}${path}`;
  }
  return path;
}

function formatDeadline(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** 複製到剪貼簿的分享文案：標題、截止時間（若有）、連結。 */
export function buildVoteShareMessage(params: {
  title: string;
  url: string;
  votingEndsAt?: string | null;
}): string {
  const lines: string[] = [];
  const title = params.title.trim();
  if (title.length > 0) {
    lines.push(title);
  }
  if (params.votingEndsAt) {
    const deadline = formatDeadline(params.votingEndsAt);
    if (deadline) {
      lines.push(`截止時間：${deadline}`);
    }
  }
  lines.push(params.url);
  return lines.join("\n");
}
