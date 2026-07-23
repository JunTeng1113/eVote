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
