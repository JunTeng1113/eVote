"use client";

import { useMemo, useState } from "react";
import { CandidateVisual } from "@/components/candidate-visual";
import { ResultsPieChart } from "@/components/results-pie-chart";
import {
  ListPagination,
  LIST_PAGE_SIZE,
  slicePage,
} from "@/components/list-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  formatPct,
  rankResults,
  type RankedResultItem,
} from "@/lib/results-ranking";

const LARGE_PAGE_SIZE = 15;

type Candidate = {
  id: string;
  name: string;
  party: string;
  imageUrl: string | null;
};

function BarRow({
  item,
  total,
  compact = false,
}: {
  item: RankedResultItem;
  total: number;
  compact?: boolean;
}) {
  const widthPct = total > 0 ? Math.min(100, (item.votes / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-8 shrink-0 text-sm tabular-nums text-[var(--muted-foreground)]">
            #{item.rank}
          </span>
          {compact ? (
            <div className="min-w-0">
              <div className="truncate font-medium">{item.name}</div>
              {item.party.trim() ? (
                <div className="truncate text-xs text-[var(--muted-foreground)]">
                  {item.party}
                </div>
              ) : null}
            </div>
          ) : (
            <CandidateVisual
              name={item.name}
              party={item.party}
              imageUrl={item.imageUrl}
              imageClassName="h-10 w-10"
            />
          )}
        </div>
        <span className="shrink-0 text-sm whitespace-nowrap">
          {item.votes} 票（{formatPct(item.pct)}）
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
        <div
          className="h-full rounded-full bg-[var(--secondary)]"
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

function HighestVoteSummary({ ranked }: { ranked: RankedResultItem[] }) {
  const leaders = ranked.filter((r) => r.rank === 1 && r.votes > 0);
  if (leaders.length === 0) {
    return null;
  }
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-4 py-3">
      <div className="text-xs text-[var(--muted-foreground)]">最高票</div>
      <div className="mt-2 space-y-3">
        {leaders.map((leader) => (
          <div key={leader.id} className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{leader.name}</span>
              {leaders.length > 1 ? <Badge>並列</Badge> : null}
            </div>
            {leader.party.trim() ? (
              <div className="text-sm text-[var(--muted-foreground)]">
                {leader.party}
              </div>
            ) : null}
            <div className="text-sm text-[var(--muted-foreground)]">
              {leader.votes} 票（{formatPct(leader.pct)}）
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankTable({
  items,
  page,
  pageSize,
  onPageChange,
}: {
  items: RankedResultItem[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const pageItems = slicePage(items, page, pageSize);
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)]/60 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">名次</th>
              <th className="px-3 py-2 font-medium">選項</th>
              <th className="px-3 py-2 font-medium">單位</th>
              <th className="px-3 py-2 text-right font-medium">票數</th>
              <th className="px-3 py-2 text-right font-medium">占比</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item) => (
              <tr key={item.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 tabular-nums text-[var(--muted-foreground)]">
                  #{item.rank}
                </td>
                <td className="px-3 py-2 font-medium">{item.name}</td>
                <td className="px-3 py-2 text-[var(--muted-foreground)]">
                  {item.party.trim() || "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {item.votes}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--muted-foreground)]">
                  {formatPct(item.pct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ListPagination
        page={page}
        totalItems={items.length}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
    </div>
  );
}

export function ResultsBreakdown({
  candidates,
  counts,
  total,
}: {
  candidates: Candidate[];
  counts: Record<string, number>;
  total: number;
}) {
  const n = candidates.length;
  const ranked = useMemo(
    () => rankResults(candidates, counts, total),
    [candidates, counts, total],
  );

  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [showZero, setShowZero] = useState(false);

  const pieItems = ranked.map((r) => ({
    id: r.id,
    label: r.name,
    value: r.votes,
  }));

  const zeroCount = ranked.filter((r) => r.votes === 0).length;

  if (n <= 8) {
    return (
      <div className="space-y-6">
        <HighestVoteSummary ranked={ranked} />
        <ResultsPieChart items={pieItems} mode="all" includeZeroInLegend />
        <div className="space-y-4">
          {ranked.map((item) => (
            <BarRow key={item.id} item={item} total={total} />
          ))}
        </div>
      </div>
    );
  }

  if (n <= 20) {
    const pageItems = slicePage(ranked, page, LIST_PAGE_SIZE);
    return (
      <div className="space-y-6">
        <HighestVoteSummary ranked={ranked} />
        <ResultsPieChart
          items={pieItems}
          mode="all"
          includeZeroInLegend
        />
        <div className="space-y-4">
          {pageItems.map((item) => (
            <BarRow key={item.id} item={item} total={total} compact />
          ))}
        </div>
        <ListPagination
          page={page}
          totalItems={ranked.length}
          pageSize={LIST_PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    );
  }

  // 21–150：保留圓餅圖＋分欄圖例，移除前 10 名橫條
  const filtered = ranked.filter((item) => {
    if (!showZero && item.votes === 0) {
      return false;
    }
    const q = query.trim().toLowerCase();
    if (!q) {
      return true;
    }
    return (
      item.name.toLowerCase().includes(q) ||
      item.party.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <HighestVoteSummary ranked={ranked} />
      <ResultsPieChart items={pieItems} mode="all" includeZeroInLegend />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="搜尋選項名稱或單位"
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <span>
            共 {n} 個選項
            {zeroCount > 0 ? ` · 0 票 ${zeroCount} 個` : ""}
          </span>
          {zeroCount > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setShowZero((prev) => !prev);
                setPage(1);
              }}
            >
              {showZero ? "隱藏 0 票" : "顯示 0 票"}
            </Button>
          ) : null}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          沒有符合條件的選項。
        </p>
      ) : (
        <RankTable
          items={filtered}
          page={page}
          pageSize={LARGE_PAGE_SIZE}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
