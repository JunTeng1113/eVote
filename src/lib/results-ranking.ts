export const RESULT_PALETTE = [
  "#0b4f6c",
  "#1b7a6e",
  "#d97706",
  "#4d6470",
  "#0f766e",
  "#b45309",
  "#155e75",
  "#3f6212",
] as const;

export type RankedResultItem = {
  id: string;
  name: string;
  party: string;
  imageUrl: string | null;
  votes: number;
  rank: number;
  pct: number;
};

/** 依票數降序；同票共用名次（competition ranking：1,2,2,4）。 */
export function rankResults(
  candidates: Array<{
    id: string;
    name: string;
    party: string;
    imageUrl?: string | null;
  }>,
  counts: Record<string, number>,
  total: number,
): RankedResultItem[] {
  const sorted = [...candidates]
    .map((c) => ({
      id: c.id,
      name: c.name,
      party: c.party,
      imageUrl: c.imageUrl ?? null,
      votes: counts[c.id] ?? 0,
    }))
    .sort((a, b) => {
      if (b.votes !== a.votes) {
        return b.votes - a.votes;
      }
      return a.name.localeCompare(b.name, "zh-Hant");
    });

  let lastVotes = Number.NaN;
  let lastRank = 0;
  return sorted.map((item, index) => {
    const rank = item.votes === lastVotes ? lastRank : index + 1;
    lastVotes = item.votes;
    lastRank = rank;
    const pct = calcPct(item.votes, total);
    return { ...item, rank, pct };
  });
}

/** 百分比：小數第 2 位無條件捨去。 */
export function calcPct(part: number, whole: number): number {
  if (whole <= 0) {
    return 0;
  }
  return Math.floor((part / whole) * 10000) / 100;
}

export function formatPct(pct: number): string {
  const truncated = Math.floor(pct * 100) / 100;
  return `${truncated.toFixed(2)}%`;
}

export function formatTalliedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export type PieChartMode = "all" | "withVotes" | "topN";

export function legendItemsPerColumn(itemCount: number): number {
  if (itemCount > 120) {
    return 50;
  }
  if (itemCount > 75) {
    return 40;
  }
  if (itemCount > 60) {
    return 25;
  }
  if (itemCount > 45) {
    return 20;
  }
  if (itemCount > 30) {
    return 15;
  }
  if (itemCount > 24) {
    return 10;
  }
  return 8;
}

export function preparePieItems(
  items: Array<{ id: string; label: string; value: number }>,
  mode: PieChartMode,
  topN = 8,
): Array<{ id: string; label: string; value: number }> {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  if (mode === "all") {
    return sorted;
  }
  if (mode === "withVotes") {
    const withVotes = sorted.filter((item) => item.value > 0);
    if (withVotes.length <= topN) {
      return withVotes;
    }
    const head = withVotes.slice(0, topN);
    const rest = withVotes.slice(topN);
    const otherValue = rest.reduce((sum, item) => sum + item.value, 0);
    return [
      ...head,
      {
        id: "__other__",
        label: `其他（${rest.length}）`,
        value: otherValue,
      },
    ];
  }
  // topN
  if (sorted.length <= topN) {
    return sorted;
  }
  const head = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const otherValue = rest.reduce((sum, item) => sum + item.value, 0);
  if (otherValue <= 0) {
    return head;
  }
  return [
    ...head,
    {
      id: "__other__",
      label: `其他（${rest.length}）`,
      value: otherValue,
    },
  ];
}
