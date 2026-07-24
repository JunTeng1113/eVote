"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { ProjectionBgmButton } from "@/components/projection-bgm-button";
import { buildVoteShareUrl } from "@/lib/election-share";
import { readResponseJson } from "@/lib/read-response-json";

export type ProjectionElection = {
  electionId: string;
  title: string;
  description: string;
  phase: string;
  scheduleMode: "unlimited" | "timed" | "duration";
  votingEndsAt: string | null;
  scheduleLabel?: string;
  candidates: Array<{
    id: string;
    name: string;
    party: string;
    imageUrl: string | null;
  }>;
  ballotCount: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatCountdown(ms: number): {
  label: string;
  expired: boolean;
} {
  if (ms <= 0) {
    return { label: "00:00:00", expired: true };
  }
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) {
    return {
      label: `${days} 天 ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`,
      expired: false,
    };
  }
  return {
    label: `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`,
    expired: false,
  };
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case "voting":
      return "投票中";
    case "closed":
      return "已截止";
    case "mixing":
      return "開票中";
    case "tallied":
      return "已開票";
    default:
      return phase;
  }
}

function phaseAccent(phase: string): string {
  switch (phase) {
    case "voting":
      return "#0b4f6c";
    case "closed":
      return "#b45309";
    case "mixing":
      return "#1b7a6e";
    case "tallied":
      return "#1b7a6e";
    default:
      return "#0b4f6c";
  }
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) {
      return;
    }
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => {
      window.clearInterval(id);
    };
  }, [active]);
  return now;
}

function useReveal(resetKey: string, delayMs = 80) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    setStage(0);
    const timers = [
      window.setTimeout(() => setStage(1), delayMs),
      window.setTimeout(() => setStage(2), delayMs + 320),
      window.setTimeout(() => setStage(3), delayMs + 640),
      window.setTimeout(() => setStage(4), delayMs + 960),
    ];
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [delayMs, resetKey]);
  return stage;
}

function VotingWaveBackdrop() {
  return (
    <div
      className="evote-voting-wave-bob pointer-events-none absolute inset-x-[-35%] top-[68%] h-52 -translate-y-1/2 overflow-hidden opacity-70 sm:h-72 md:h-80"
      aria-hidden
    >
      <div className="evote-voting-wave-track absolute inset-y-0 left-0 flex w-[200%]">
        <svg
          className="h-full w-1/2"
          viewBox="0 0 600 160"
          preserveAspectRatio="none"
        >
          <path
            d="M0 88 C 75 28, 150 148, 225 88 S 375 28, 450 88 S 575 148, 600 88 V 160 H 0 Z"
            fill="rgba(11, 79, 108, 0.14)"
          />
          <path
            d="M0 100 C 80 52, 160 138, 240 100 S 400 52, 480 100 S 560 138, 600 100 V 160 H 0 Z"
            fill="rgba(27, 122, 110, 0.16)"
          />
        </svg>
        <svg
          className="h-full w-1/2"
          viewBox="0 0 600 160"
          preserveAspectRatio="none"
        >
          <path
            d="M0 88 C 75 28, 150 148, 225 88 S 375 28, 450 88 S 575 148, 600 88 V 160 H 0 Z"
            fill="rgba(11, 79, 108, 0.14)"
          />
          <path
            d="M0 100 C 80 52, 160 138, 240 100 S 400 52, 480 100 S 560 138, 600 100 V 160 H 0 Z"
            fill="rgba(27, 122, 110, 0.16)"
          />
        </svg>
      </div>
      <div className="evote-voting-wave-track-slow absolute inset-y-3 left-0 flex w-[200%] opacity-80">
        <svg
          className="h-full w-1/2"
          viewBox="0 0 600 160"
          preserveAspectRatio="none"
        >
          <path
            d="M0 78 C 70 128, 140 28, 210 78 S 350 128, 420 78 S 530 28, 600 78"
            fill="none"
            stroke="rgba(11, 79, 108, 0.35)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
        <svg
          className="h-full w-1/2"
          viewBox="0 0 600 160"
          preserveAspectRatio="none"
        >
          <path
            d="M0 78 C 70 128, 140 28, 210 78 S 350 128, 420 78 S 530 28, 600 78"
            fill="none"
            stroke="rgba(11, 79, 108, 0.35)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

export function ElectionProjectionView({
  election,
  busy,
  onClose,
  onCloseVoting,
  onTally,
  onViewResults,
}: {
  election: ProjectionElection;
  busy: boolean;
  onClose: () => void;
  onCloseVoting: () => void;
  onTally: () => void;
  onViewResults: () => void;
}) {
  const showCountdown =
    (election.scheduleMode === "timed" ||
      election.scheduleMode === "duration") &&
    Boolean(election.votingEndsAt);
  const now = useNow(showCountdown);
  const endMs = election.votingEndsAt
    ? new Date(election.votingEndsAt).getTime()
    : Number.NaN;
  const remainingMs = Number.isFinite(endMs) ? endMs - now : 0;
  const countdown = formatCountdown(remainingMs);
  const phase = phaseLabel(election.phase);
  const accent = phaseAccent(election.phase);
  const options = election.candidates;
  const [voteUrl, setVoteUrl] = useState("");
  const [liveBallotCount, setLiveBallotCount] = useState(election.ballotCount);
  const showQr =
    Boolean(voteUrl) &&
    election.phase !== "tallied" &&
    election.phase !== "closed";
  const stage = useReveal(`${election.electionId}:${election.phase}`);

  useEffect(() => {
    setLiveBallotCount(election.ballotCount);
  }, [election.ballotCount]);

  useEffect(() => {
    setVoteUrl(
      buildVoteShareUrl(election.electionId, window.location.origin),
    );
  }, [election.electionId]);

  useEffect(() => {
    let alive = true;

    async function refreshBallotCount() {
      const res = await fetch(
        `/api/election?id=${encodeURIComponent(election.electionId)}`,
      );
      if (!alive || !res.ok) {
        return;
      }
      const data = await readResponseJson<{
        stats?: { ballotCount?: number };
      }>(res);
      if (
        data &&
        typeof data.stats?.ballotCount === "number" &&
        Number.isFinite(data.stats.ballotCount)
      ) {
        setLiveBallotCount(data.stats.ballotCount);
      }
    }

    void refreshBallotCount();
    const timer = window.setInterval(() => {
      void refreshBallotCount();
    }, 2000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [election.electionId]);

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
            {election.title}
          </h1>
          {election.description.trim() ? (
            <p className="mx-auto max-w-3xl whitespace-pre-wrap text-base text-[#4d6470] sm:text-lg">
              {election.description}
            </p>
          ) : null}
          {election.scheduleLabel ? (
            <p className="text-sm text-[#4d6470]">
              投票時間：{election.scheduleLabel}
            </p>
          ) : null}
        </header>

        <div className="my-8 flex flex-1 flex-col items-center justify-center gap-8 text-center sm:my-10 lg:flex-row lg:items-center lg:gap-12 lg:text-left">
          <div
            className="relative flex flex-col items-center gap-4 transition-all duration-700 ease-out lg:items-start"
            style={{
              opacity: stage >= 2 ? 1 : 0,
              transform: stage >= 2 ? "translateY(0) scale(1)" : "translateY(16px) scale(0.94)",
            }}
          >
            {election.phase === "voting" ? <VotingWaveBackdrop /> : null}
            <p className="relative z-[1] text-sm font-medium tracking-[0.2em] text-[#4d6470] sm:text-base">
              目前階段
            </p>
            <p
              className="relative z-[1] font-[family-name:var(--font-display)] text-6xl font-semibold tracking-tight sm:text-7xl md:text-8xl"
              style={{ color: accent }}
              aria-live="polite"
            >
              {phase}
            </p>
            {showCountdown ? (
              <div className="relative z-[1] mt-2 space-y-2 text-center lg:text-left">
                <p className="text-base text-[#4d6470] sm:text-lg">
                  {election.phase === "voting"
                    ? countdown.expired
                      ? "投票時間已到"
                      : "距離投票截止"
                    : "倒數已結束"}
                </p>
                <div className="font-[family-name:var(--font-display)] text-4xl font-semibold tabular-nums tracking-tight text-[#0f1c24] sm:text-5xl">
                  {election.phase === "voting" ? countdown.label : "00:00:00"}
                </div>
              </div>
            ) : null}
          </div>

          {showQr ? (
            <div
              className="flex flex-col items-center gap-3 rounded-2xl border border-[rgba(15,28,36,0.12)] bg-white/90 px-6 py-5 transition-all duration-700 ease-out"
              style={{
                opacity: stage >= 2 ? 1 : 0,
                transform: stage >= 2 ? "translateY(0) scale(1)" : "translateY(20px) scale(0.92)",
              }}
            >
              <QRCodeSVG
                value={voteUrl}
                size={300}
                level="M"
                bgColor="#ffffff"
                fgColor="#0f1c24"
                title="投票連結 QR Code"
              />
              <p className="text-sm font-medium text-[#0b4f6c]">掃描即可投票</p>
              <p className="max-w-[220px] break-all text-center text-xs text-[#4d6470]">
                {voteUrl}
              </p>
            </div>
          ) : null}
        </div>

        <section>
          <h2
            className="mb-4 text-center text-sm font-medium uppercase tracking-wide text-[#4d6470] transition-opacity duration-700"
            style={{ opacity: stage >= 3 ? 1 : 0 }}
          >
            投票選項（{options.length}）
          </h2>
          <ul
            className="grid gap-3"
            style={{
              gridTemplateColumns:
                options.length > 12
                  ? "repeat(auto-fill, minmax(220px, 1fr))"
                  : options.length > 6
                    ? "repeat(auto-fill, minmax(260px, 1fr))"
                    : "repeat(auto-fill, minmax(280px, 1fr))",
            }}
          >
            {options.map((option, index) => {
              const rowDelay = Math.min(index, 20) * 55;
              const showRow = stage >= 3;
              return (
                <li
                  key={option.id}
                  className="flex items-center gap-3 rounded-xl border border-[rgba(15,28,36,0.12)] bg-white/80 px-4 py-3"
                  style={{
                    opacity: showRow ? 1 : 0,
                    transform: showRow ? "translateY(0)" : "translateY(14px)",
                    transition: `opacity 0.5s ease-out ${rowDelay}ms, transform 0.5s ease-out ${rowDelay}ms`,
                  }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(11,79,108,0.08)] text-sm font-semibold tabular-nums text-[#0b4f6c]">
                    {index + 1}
                  </span>
                  {option.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={option.imageUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <div className="truncate text-lg font-medium">
                      {option.name}
                    </div>
                    {option.party.trim() ? (
                      <div className="truncate text-sm text-[#4d6470]">
                        {option.party}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <footer
          className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[rgba(15,28,36,0.12)] pt-6 transition-all duration-700 ease-out"
          style={{
            opacity: stage >= 4 ? 1 : 0,
            transform: stage >= 4 ? "translateY(0)" : "translateY(10px)",
          }}
        >
          <p className="text-base text-[#4d6470]">
            已收到{" "}
            <span className="font-semibold tabular-nums text-[#0f1c24]">
              {liveBallotCount}
            </span>{" "}
            票
          </p>
          <div className="flex flex-wrap gap-3">
            {election.phase === "voting" ? (
              <Button size="lg" disabled={busy} onClick={onCloseVoting}>
                截止投票
              </Button>
            ) : null}
            {election.phase === "closed" ? (
              <Button
                size="lg"
                variant="secondary"
                disabled={busy}
                onClick={onTally}
              >
                執行開票
              </Button>
            ) : null}
            {election.phase === "tallied" ? (
              <Button size="lg" onClick={onViewResults}>
                查看結果
              </Button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}
