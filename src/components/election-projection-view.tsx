"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { buildVoteShareUrl } from "@/lib/election-share";

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
  const rootRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const showCountdown =
    (election.scheduleMode === "timed" ||
      election.scheduleMode === "duration") &&
    Boolean(election.votingEndsAt);
  const now = useNow(showCountdown);
  const endMs = election.votingEndsAt
    ? new Date(election.votingEndsAt).getTime()
    : Number.NaN;
  const remainingMs = Number.isFinite(endMs) ? endMs - now : 0;
  const phase = phaseLabel(election.phase);
  const accent = phaseAccent(election.phase);
  const options = election.candidates;
  const [voteUrl, setVoteUrl] = useState("");

  useEffect(() => {
    setVoteUrl(
      buildVoteShareUrl(election.electionId, window.location.origin),
    );
  }, [election.electionId]);

  useEffect(() => {
    const node = rootRef.current;
    if (node && typeof node.requestFullscreen === "function") {
      void node.requestFullscreen().then(
        () => undefined,
        () => undefined,
      );
    }

    function onFullscreenChange() {
      if (!document.fullscreenElement) {
        onCloseRef.current();
      }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (
        document.fullscreenElement &&
        typeof document.exitFullscreen === "function"
      ) {
        void document.exitFullscreen().then(
          () => undefined,
          () => undefined,
        );
      }
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[80] flex flex-col overflow-auto bg-[#f3f7f8] text-[#0f1c24]"
      style={{
        background:
          "radial-gradient(1200px 600px at 10% -10%, rgba(27, 122, 110, 0.16), transparent 55%), radial-gradient(900px 500px at 90% 0%, rgba(11, 79, 108, 0.14), transparent 50%), linear-gradient(180deg, #eef5f7 0%, #f7fafb 45%, #e8f1f3 100%)",
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-6 sm:px-10 sm:py-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium tracking-wide text-[#0b4f6c]">
            eVote 現場投影
          </p>
          <Button type="button" variant="outline" onClick={onClose}>
            結束全螢幕
          </Button>
        </div>

        <header className="mt-6 space-y-3 text-center">
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
          <div className="flex flex-col items-center gap-4 lg:items-start">
            <p className="text-sm font-medium tracking-[0.2em] text-[#4d6470] sm:text-base">
              目前階段
            </p>
            <p
              className="font-[family-name:var(--font-display)] text-6xl font-semibold tracking-tight sm:text-7xl md:text-8xl"
              style={{ color: accent }}
              aria-live="polite"
            >
              {phase}
            </p>
            {showCountdown ? (
              <div className="mt-2 space-y-2 text-center lg:text-left">
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

          {voteUrl ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-[rgba(15,28,36,0.12)] bg-white/90 px-6 py-5">
              <QRCodeSVG
                value={voteUrl}
                size={200}
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
          <h2 className="mb-4 text-center text-sm font-medium uppercase tracking-wide text-[#4d6470]">
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
            {options.map((option, index) => (
              <li
                key={option.id}
                className="flex items-center gap-3 rounded-xl border border-[rgba(15,28,36,0.12)] bg-white/80 px-4 py-3"
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
            ))}
          </ul>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[rgba(15,28,36,0.12)] pt-6">
          <p className="text-base text-[#4d6470]">
            已收到{" "}
            <span className="font-semibold tabular-nums text-[#0f1c24]">
              {election.ballotCount}
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
