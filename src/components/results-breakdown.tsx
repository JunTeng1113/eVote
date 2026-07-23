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
  RESULT_PALETTE,
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

function TopHorizontalBars({
  items,
  total,
}: {
  items: RankedResultItem[];
  total: number;
}) {
  const top = items.slice(0, 10);
  const maxVotes = Math.max(...top.map((i) => i.votes), 1);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">前 10 名得票</h3>
      <div className="space-y-2.5">
        {top.map((item, index) => {
          const widthPct = (item.votes / maxVotes) * 100;
          const color = RESULT_PALETTE[index % RESULT_PALETTE.length]!;
          return (
            <div key={item.id} className="grid grid-cols-[2.5rem_1fr_5.5rem] items-center gap-2 text-sm">
              <span className="tabular-nums text-[var(--muted-foreground)]">
                #{item.rank}
              </span>
              <div className="min-w-0">
                <div className="mb-1 truncate font-medium">{item.name}</div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${widthPct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
              <span className="text-right tabular-nums text-[var(--muted-foreground)]">
                {item.votes}（{formatPct(item.pct)}）
              </span>
            </div>
          );
        })}
      </div>
      {total > 0 && top[0] ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          長條相對最高得票者比例；百分比以總票數計算。
        </p>
      ) : null}
    </div>
  );
}

function WinnerSummary({ ranked }: { ranked: RankedResultItem[] }) {
  const leaders = ranked.filter((r) => r.rank === 1 && r.votes > 0);
  if (leaders.length === 0) {
    return null;
  }
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-4 py-3">
      <div className="text-xs text-[var(--muted-foreground)]">目前領先</div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {leaders.length === 1 ? (
          <>
            <span className="font-semibold">{leaders[0]!.name}</span>
            <Badge>第 1 名</Badge>
            <span className="text-sm text-[var(--muted-foreground)]">
              {leaders[0]!.votes} 票（{formatPct(leaders[0]!.pct)}）
            </span>
          </>
        ) : (
          <>
            <Badge>第 1 名並列</Badge>
            <span className="text-sm">
              {leaders.map((l) => l.name).join("、")}
            </span>
            <span className="text-sm text-[var(--muted-foreground)]">
              各 {leaders[0]!.votes} 票（{formatPct(leaders[0]!.pct)}）
            </span>
          </>
        )}
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
              <tr
                key={item.id}
                className="border-t border-[var(--border)]"
              >
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
        <ResultsPieChart items={pieItems} mode="all" />
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
        <ResultsPieChart items={pieItems} mode="withVotes" topN={8} />
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

  // 21–150
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
      <WinnerSummary ranked={ranked} />
      <TopHorizontalBars items={ranked} total={total} />
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
