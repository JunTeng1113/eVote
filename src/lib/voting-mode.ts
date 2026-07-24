export type VotingMode = "anonymous" | "named" | "open" | "named_open";

/** 使用記名選票（對照 email ↔ 選項） */
export function isNamedBallotMode(mode: string): boolean {
  return mode === "named" || mode === "named_open";
}

/** 必須事先在可投票名單內 */
export function requiresEligibleList(mode: string): boolean {
  return mode === "anonymous" || mode === "named";
}

/** 無須登入、以連線位址防重投 */
export function isGuestOpenMode(mode: string): boolean {
  return mode === "open";
}

export function votingModeLabel(mode: string): string {
  switch (mode) {
    case "named":
      return "記名（名單內）";
    case "named_open":
      return "記名開放";
    case "open":
      return "無須登入";
    default:
      return "不記名";
  }
}
