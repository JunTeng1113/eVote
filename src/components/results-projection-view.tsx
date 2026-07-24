"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProjectionBgmButton } from "@/components/projection-bgm-button";
import {
  RESULT_PALETTE,
  formatPct,
  rankResults,
} from "@/lib/results-ranking";

export type ResultsProjectionInput = {
  title: string;
  modeLabel: string;
  talliedAt: string;
  eligibleLabel: string;
  eligibleCount: number;
  totalVotes: number;
  turnout: string;
  candidates: Array<{
    id: string;
    name: string;
    party: string;
    imageUrl: string | null;
  }>;
  counts: Record<string, number>;
};

function useReveal(delayMs = 80) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStage(1), delayMs),
      window.setTimeout(() => setStage(2), delayMs + 350),
      window.setTimeout(() => setStage(3), delayMs + 700),
      window.setTimeout(() => setStage(4), delayMs + 1050),
    ];
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [delayMs]);
  return stage;
}

export function ResultsProjectionView({
  result,
  onClose,
}: {
  result: ResultsProjectionInput;
  onClose: () => void;
}) {
  const stage = useReveal();

  const ranked = rankResults(
    result.candidates,
    result.counts,
    result.totalVotes,
  );
  const leaders = ranked.filter((item) => item.rank === 1 && item.votes > 0);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-6 sm:px-10 sm:py-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium tracking-wide text-[#0b4f6c]">
            eVote 現場投影
          </p>
          <div className="flex items-center gap-2">
            <ProjectionBgmButton />
            <Button type="button" variant="outline" onClick={onClose}>
              結束全螢幕
            </Button>
          </div>
        </div>

        <header
          className="mt-6 space-y-3 text-center transition-all duration-700 ease-out"
          style={{
            opacity: stage >= 1 ? 1 : 0,
            transform: stage >= 1 ? "translateY(0)" : "translateY(12px)",
          }}
        >
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-[#0f1c24] sm:text-4xl">
            {result.title}
          </h1>
          <p className="text-sm text-[#4d6470]">
            {result.modeLabel} · 開票時間 {result.talliedAt}
          </p>
        </header>

        <div className="my-8 flex flex-col items-center justify-center gap-4 text-center sm:my-10">
          <p
            className="text-sm font-medium tracking-[0.2em] text-[#4d6470] transition-all duration-700 ease-out sm:text-base"
            style={{
              opacity: stage >= 1 ? 1 : 0,
              transform: stage >= 1 ? "translateY(0)" : "translateY(8px)",
            }}
          >
            目前階段
          </p>
          <p
            className="font-[family-name:var(--font-display)] text-6xl font-semibold tracking-tight text-[#1b7a6e] transition-all duration-700 ease-out sm:text-7xl md:text-8xl"
            style={{
              opacity: stage >= 1 ? 1 : 0,
              transform: stage >= 1 ? "scale(1)" : "scale(0.88)",
            }}
            aria-live="polite"
          >
            已開票
          </p>
          {leaders.length > 0 ? (
            <div
              className="mt-2 max-w-2xl space-y-1 transition-all duration-700 ease-out"
              style={{
                opacity: stage >= 2 ? 1 : 0,
                transform: stage >= 2 ? "translateY(0)" : "translateY(16px)",
              }}
            >
              <p className="text-sm text-[#4d6470]">最高票</p>
              <p className="text-2xl font-semibold text-[#0f1c24] sm:text-3xl">
                {leaders.map((item) => item.name).join("、")}
              </p>
              {leaders[0]?.party.trim() ? (
                <p className="text-base text-[#4d6470]">
                  {leaders.length === 1
                    ? leaders[0].party
                    : leaders.map((item) => item.party || item.name).join("、")}
                </p>
              ) : null}
              <p className="text-lg tabular-nums text-[#4d6470]">
                {leaders[0]!.votes} 票（{formatPct(leaders[0]!.pct)}）
                {leaders.length > 1 ? " · 並列" : ""}
              </p>
            </div>
          ) : null}
        </div>

        <div
          className="mb-8 grid gap-3 sm:grid-cols-3"
          style={{
            opacity: stage >= 3 ? 1 : 0,
            transform: stage >= 3 ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.7s ease-out, transform 0.7s ease-out",
          }}
        >
          {[
            {
              label: result.eligibleLabel,
              value: String(result.eligibleCount),
            },
            { label: "有效票數", value: String(result.totalVotes) },
            { label: "投票率", value: result.turnout },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-[rgba(15,28,36,0.12)] bg-white/80 px-4 py-4 text-center"
            >
              <div className="text-sm text-[#4d6470]">{stat.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-[#0f1c24]">
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <section className="flex-1">
          <h2
            className="mb-4 text-center text-sm font-medium uppercase tracking-wide text-[#4d6470] transition-opacity duration-700"
            style={{ opacity: stage >= 4 ? 1 : 0 }}
          >
            完整結果（{ranked.length}）
          </h2>
          <ul className="space-y-3">
            {ranked.map((item, index) => {
              const color = RESULT_PALETTE[index % RESULT_PALETTE.length]!;
              const widthPct =
                result.totalVotes > 0
                  ? Math.min(100, (item.votes / result.totalVotes) * 100)
                  : 0;
              const rowDelay = Math.min(index, 24) * 70;
              const showRow = stage >= 4;
              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-[rgba(15,28,36,0.12)] bg-white/80 px-4 py-3"
                  style={{
                    opacity: showRow ? 1 : 0,
                    transform: showRow ? "translateY(0)" : "translateY(18px)",
                    transition: `opacity 0.55s ease-out ${rowDelay}ms, transform 0.55s ease-out ${rowDelay}ms`,
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-10 shrink-0 text-sm tabular-nums text-[#4d6470]">
                        #{item.rank}
                      </span>
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <div className="truncate text-lg font-medium">
                          {item.name}
                        </div>
                        {item.party.trim() ? (
                          <div className="truncate text-sm text-[#4d6470]">
                            {item.party}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-base tabular-nums text-[#4d6470]">
                      {item.votes} 票（{formatPct(item.pct)}）
                    </div>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(11,79,108,0.08)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: showRow ? `${widthPct}%` : "0%",
                        backgroundColor: color,
                        transition: `width 0.9s cubic-bezier(0.22, 1, 0.36, 1) ${rowDelay + 120}ms`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
