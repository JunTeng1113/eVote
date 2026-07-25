"use client";

import type { ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResultsBreakdown } from "@/components/results-breakdown";
import { VotingWaveBackdrop } from "@/components/election-projection-view";
import { cn } from "@/lib/utils";

const DEMO_TITLE = "社員大會提案表決";
const DEMO_VOTE_URL = "https://evote.example/vote/demo";
const DEMO_CANDIDATES = [
  { id: "agree", name: "同意", party: "", imageUrl: null },
  { id: "disagree", name: "不同意", party: "", imageUrl: null },
  { id: "abstain", name: "棄權", party: "", imageUrl: null },
];
const DEMO_COUNTS: Record<string, number> = {
  agree: 128,
  disagree: 47,
  abstain: 19,
};
const DEMO_TOTAL = 194;

function SystemPreviewFrame({
  children,
  className,
  bodyClassName,
}: {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_18px_40px_rgba(15,28,36,0.08)]",
        className,
      )}
    >
      <div className={cn("p-4 sm:p-6 lg:p-8", bodyClassName)}>{children}</div>
    </div>
  );
}

function PreviewStepBadge({
  step,
  label,
  state,
}: {
  step: number;
  label: string;
  state: "active" | "done" | "idle";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
        state === "active"
          ? "border-[var(--primary)] bg-[var(--muted)] text-[var(--foreground)]"
          : state === "done"
            ? "border-[var(--secondary)]/40 text-[var(--secondary)]"
            : "border-[var(--border)] text-[var(--muted-foreground)]",
      )}
    >
      <span className="font-semibold">{step}</span>
      <span>{label}</span>
    </div>
  );
}

/** 建立投票流程預覽（對齊 /admin 建立新投票步驟 1） */
export function CreateVoteSystemPreview() {
  return (
    <SystemPreviewFrame>
      <div className="space-y-6 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.88)] p-5 sm:p-6">
        <div className="space-y-1.5">
          <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--primary)] sm:text-2xl">
            建立新投票
          </h3>
          <p className="text-sm text-[var(--muted-foreground)]">
            請依序完成三個階段後送出。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <PreviewStepBadge step={1} label="標題與說明" state="active" />
          <PreviewStepBadge step={2} label="投票選項" state="idle" />
          <PreviewStepBadge step={3} label="可投票名單" state="idle" />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>投票標題</Label>
            <Input value={DEMO_TITLE} readOnly tabIndex={-1} />
          </div>
          <div className="space-y-2">
            <Label>說明（選填）</Label>
            <textarea
              className="min-h-28 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              value="向投票權人說明這場投票的目的"
              readOnly
              tabIndex={-1}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">投票方式</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border border-[var(--primary)] bg-[var(--muted)] px-3 py-3">
                <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-[3px] border-[var(--primary)] bg-white" />
                <span>
                  <span className="block text-sm font-medium">不記名投票</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                    預設。需登入且在名單內；可確認有投票，但無法得知誰投了什麼。
                  </span>
                </span>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] px-3 py-3 opacity-80">
                <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--border)]" />
                <span>
                  <span className="block text-sm font-medium">記名（名單內）</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                    需登入且在名單內；開票後可對照每位投票權人的選擇。
                  </span>
                </span>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">投票時間</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-start gap-3 rounded-lg border border-[var(--primary)] bg-[var(--muted)] px-3 py-3">
                <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-[3px] border-[var(--primary)] bg-white" />
                <span>
                  <span className="block text-sm font-medium">無時間限制</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                          由管理員手動截止或恢復投票。
                        </span>
                </span>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] px-3 py-3 opacity-80">
                <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--border)]" />
                <span>
                  <span className="block text-sm font-medium">限時投票</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                    建立後立即開始，到時自動截止。
                  </span>
                </span>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] px-3 py-3 opacity-80 sm:col-span-2 lg:col-span-1">
                <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--border)]" />
                <span>
                  <span className="block text-sm font-medium">計時投票</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                    設定開始與截止時間，到期自動截止。
                  </span>
                </span>
              </div>
            </div>
          </fieldset>
        </div>

        <div className="flex justify-end">
          <Button type="button" tabIndex={-1}>
            下一步
          </Button>
        </div>
      </div>
    </SystemPreviewFrame>
  );
}

/** 全螢幕現場投影預覽（對齊實際投影畫面） */
export function ProjectionSystemPreview() {
  const options = DEMO_CANDIDATES;

  return (
    <SystemPreviewFrame bodyClassName="p-0 sm:p-0 lg:p-0">
      <div className="bg-[linear-gradient(180deg,#f7fbfc_0%,#eef5f7_100%)] px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium tracking-wide text-[#0b4f6c]">
            eVote 現場投影
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              tabIndex={-1}
              aria-label="背景音樂"
            >
              <VolumeX className="h-4 w-4" aria-hidden />
            </Button>
            <Button type="button" variant="outline" size="sm" tabIndex={-1}>
              結束全螢幕
            </Button>
          </div>
        </div>

        <header className="mt-6 space-y-2 text-center">
          <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold leading-tight text-[#0f1c24] sm:text-3xl lg:text-4xl">
            {DEMO_TITLE}
          </h3>
          <p className="mx-auto max-w-2xl text-sm text-[#4d6470] sm:text-base">
            請就本會提案進行表決
          </p>
        </header>

        <div className="relative my-8 py-6 sm:py-8">
          <VotingWaveBackdrop className="inset-x-[-1.25rem] top-1/2 h-44 -translate-y-1/2 sm:inset-x-[-2rem] sm:h-56 md:h-64 lg:inset-x-[-2.5rem]" />
          <div className="relative z-[1] flex flex-col items-center justify-center gap-8 text-center lg:flex-row lg:items-center lg:gap-12 lg:text-left">
            <div className="relative flex min-h-[7.5rem] flex-col items-center justify-center gap-3 lg:min-w-[12rem] lg:items-start">
              <p className="relative z-[1] text-sm font-medium tracking-[0.2em] text-[#4d6470]">
                目前階段
              </p>
              <p className="relative z-[1] font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight text-[#0b4f6c] sm:text-6xl md:text-7xl">
                投票中
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 rounded-2xl border border-[rgba(15,28,36,0.12)] bg-white/90 px-6 py-5">
              <QRCodeSVG
                value={DEMO_VOTE_URL}
                size={180}
                level="M"
                bgColor="#ffffff"
                fgColor="#0f1c24"
                title="投票連結 QR Code"
              />
              <p className="text-sm font-medium text-[#0b4f6c]">掃描即可投票</p>
              <p className="max-w-[220px] break-all text-center text-xs text-[#4d6470]">
                {DEMO_VOTE_URL}
              </p>
            </div>
          </div>
        </div>

        <section>
          <h4 className="mb-4 text-center text-sm font-medium uppercase tracking-wide text-[#4d6470]">
            投票選項（{options.length}）
          </h4>
          <ul className="grid gap-3 sm:grid-cols-3">
            {options.map((option, index) => (
              <li
                key={option.id}
                className="flex items-center gap-3 rounded-xl border border-[rgba(15,28,36,0.12)] bg-white/80 px-4 py-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(11,79,108,0.08)] text-sm font-semibold tabular-nums text-[#0b4f6c]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-lg font-medium">{option.name}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[rgba(15,28,36,0.12)] pt-6">
          <p className="text-base text-[#4d6470]">
            已收到{" "}
            <span className="font-semibold tabular-nums text-[#0f1c24]">86</span>{" "}
            票
          </p>
          <Button type="button" size="sm" tabIndex={-1}>
            截止投票
          </Button>
        </footer>
      </div>
    </SystemPreviewFrame>
  );
}

/** 開票結果預覽（對齊 /results 結果卡） */
export function ResultsSystemPreview() {
  return (
    <SystemPreviewFrame>
      <div className="space-y-6 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.88)] p-5 sm:p-6">
        <div className="space-y-2">
          <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--primary)] sm:text-2xl">
            {DEMO_TITLE}
          </h3>
          <p className="text-sm text-[var(--muted-foreground)]">
            狀態 <Badge>已開票</Badge> · <Badge>不記名</Badge> ·{" "}
            <Badge>無時間限制</Badge>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-[var(--border)] px-4 py-3">
            <div className="text-xs text-[var(--muted-foreground)]">投票權人數</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">220</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] px-4 py-3">
            <div className="text-xs text-[var(--muted-foreground)]">有效票數</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {DEMO_TOTAL}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border)] px-4 py-3">
            <div className="text-xs text-[var(--muted-foreground)]">投票率</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">88%</div>
          </div>
        </div>

        <p className="text-sm text-[var(--muted-foreground)]">
          開票時間：2026/07/25 18:00
        </p>

        <ResultsBreakdown
          candidates={DEMO_CANDIDATES}
          counts={DEMO_COUNTS}
          total={DEMO_TOTAL}
        />
      </div>
    </SystemPreviewFrame>
  );
}
