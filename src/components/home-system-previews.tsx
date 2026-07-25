import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ResultsPieChart } from "@/components/results-pie-chart";
import { calcPct, formatPct } from "@/lib/results-ranking";
import { cn } from "@/lib/utils";

const POLL_DEMO = [
  { id: "agree", label: "同意", value: 128 },
  { id: "disagree", label: "不同意", value: 47 },
  { id: "abstain", label: "棄權", value: 19 },
] as const;

function SystemPreviewFrame({
  path,
  children,
  className,
}: {
  path: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_18px_40px_rgba(15,28,36,0.08)]",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[rgba(11,79,108,0.06)] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#d97706]/70" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-[#1b7a6e]/70" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-[#0b4f6c]/50" aria-hidden />
        <span className="ml-2 truncate text-xs text-[var(--muted-foreground)]">
          {path}
        </span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function ResultBars({
  items,
}: {
  items: ReadonlyArray<{ id: string; label: string; value: number }>;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = calcPct(item.value, total);
        return (
          <div key={item.id} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">{item.label}</span>
              <span className="tabular-nums text-[var(--muted-foreground)]">
                {item.value} 票（{formatPct(pct)}）
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
              <div
                className="h-full rounded-full bg-[var(--secondary)]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 建立投票流程預覽 */
export function CreateVoteSystemPreview() {
  return (
    <SystemPreviewFrame path="/admin · 建立投票">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--primary)]">
              建立新投票
            </h3>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              範例畫面 · 僅供首頁預覽
            </p>
          </div>
          <Badge>分步驟</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { step: 1, label: "標題與說明", active: true },
            { step: 2, label: "投票選項", active: false },
            { step: 3, label: "可投票名單", active: false },
          ].map((item) => (
            <span
              key={item.step}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs",
                item.active
                  ? "border-[var(--primary)] bg-[rgba(11,79,108,0.08)] font-medium text-[var(--primary)]"
                  : "border-[var(--border)] text-[var(--muted-foreground)]",
              )}
            >
              {item.step}. {item.label}
            </span>
          ))}
        </div>

        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.7)] p-3">
          <div className="space-y-1.5">
            <p className="text-xs text-[var(--muted-foreground)]">投票標題</p>
            <div className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm">
              社員大會提案表決
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-[var(--muted-foreground)]">說明</p>
            <div className="min-h-14 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--muted-foreground)]">
              請就本會提案進行表決…
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>匿名投票</Badge>
            <Badge>無時間限制</Badge>
          </div>
        </div>

        <div className="flex justify-end">
          <span className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)]">
            下一步
          </span>
        </div>
      </div>
    </SystemPreviewFrame>
  );
}

/** 全螢幕／螢幕分享投影預覽 */
export function ProjectionSystemPreview() {
  return (
    <SystemPreviewFrame path="/admin · 全螢幕投影">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--primary)]">
              eVote 現場投影
            </h3>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              範例畫面 · 僅供首頁預覽
            </p>
          </div>
          <Badge>螢幕分享</Badge>
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,#f7fbfc_0%,#eef5f7_100%)] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 text-xs text-[var(--muted-foreground)]">
            <span>eVote 現場投影</span>
            <span className="rounded-md border border-[var(--border)] bg-white px-2 py-0.5">
              結束全螢幕
            </span>
          </div>

          <div className="mt-5 text-center">
            <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--foreground)] sm:text-2xl">
              社員大會提案表決
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              請掃描 QR Code 或開啟投票連結參與
            </p>
          </div>

          <div className="mt-6 grid items-center gap-5 sm:grid-cols-[auto_1fr]">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-white sm:mx-0">
              <div className="grid h-20 w-20 grid-cols-4 grid-rows-4 gap-0.5 p-1">
                {Array.from({ length: 16 }, (_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "rounded-[1px]",
                      [0, 1, 2, 4, 5, 8, 10, 12, 13, 14].includes(index)
                        ? "bg-[var(--foreground)]"
                        : "bg-transparent",
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-3 text-center sm:text-left">
              <div>
                <p className="text-xs tracking-[0.18em] text-[var(--muted-foreground)]">
                  目前階段
                </p>
                <p className="font-[family-name:var(--font-display)] text-4xl font-semibold text-[var(--secondary)]">
                  投票中
                </p>
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                已收到 <span className="font-semibold text-[var(--foreground)]">86</span>{" "}
                票
              </p>
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                {["同意", "不同意", "棄權"].map((label) => (
                  <span
                    key={label}
                    className="rounded-md border border-[var(--border)] bg-white px-2.5 py-1 text-xs"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SystemPreviewFrame>
  );
}

/** 開票結果預覽 */
export function ResultsSystemPreview() {
  const pollTotal = POLL_DEMO.reduce((sum, item) => sum + item.value, 0);

  return (
    <SystemPreviewFrame path="/results · 預覽">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--primary)]">
              社員大會提案表決
            </h3>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              範例資料 · 僅供首頁預覽
            </p>
          </div>
          <Badge>議案投票</Badge>
        </div>
        <ResultsPieChart items={[...POLL_DEMO]} />
        <ResultBars items={POLL_DEMO} />
        <p className="text-xs text-[var(--muted-foreground)]">
          有效票數 {pollTotal} · 同意／不同意／棄權
        </p>
      </div>
    </SystemPreviewFrame>
  );
}
