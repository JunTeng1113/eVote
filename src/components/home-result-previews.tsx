import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResultsPieChart } from "@/components/results-pie-chart";
import { calcPct, formatPct } from "@/lib/results-ranking";

const POLL_DEMO = [
  { id: "agree", label: "同意", value: 128 },
  { id: "disagree", label: "不同意", value: 47 },
  { id: "abstain", label: "棄權", value: 19 },
] as const;

const ELECTION_DEMO = [
  { id: "c1", label: "1號候選人", value: 214 },
  { id: "c2", label: "2號候選人", value: 186 },
  { id: "abstain", label: "棄權", value: 32 },
] as const;

function PreviewFrame({
  title,
  modeLabel,
  children,
}: {
  title: string;
  modeLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_18px_40px_rgba(15,28,36,0.08)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[rgba(11,79,108,0.06)] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#d97706]/70" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-[#1b7a6e]/70" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-[#0b4f6c]/50" aria-hidden />
        <span className="ml-2 truncate text-xs text-[var(--muted-foreground)]">
          /results · 預覽
        </span>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--primary)]">
              {title}
            </h3>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              範例資料 · 僅供首頁預覽
            </p>
          </div>
          <Badge>{modeLabel}</Badge>
        </div>
        {children}
      </div>
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

export function HomeResultPreviews() {
  const pollTotal = POLL_DEMO.reduce((sum, item) => sum + item.value, 0);
  const electionTotal = ELECTION_DEMO.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>結果頁預覽</CardTitle>
          <CardDescription>
            開票後會以圖表呈現各選項得票。以下為示意圖，非真實投票。
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <PreviewFrame title="社員大會提案表決" modeLabel="議案投票">
          <ResultsPieChart items={[...POLL_DEMO]} />
          <ResultBars items={POLL_DEMO} />
          <p className="text-xs text-[var(--muted-foreground)]">
            有效票數 {pollTotal} · 同意／不同意／棄權
          </p>
        </PreviewFrame>

        <PreviewFrame title="第 12 屆會長選舉" modeLabel="選舉">
          <ResultsPieChart items={[...ELECTION_DEMO]} />
          <ResultBars items={ELECTION_DEMO} />
          <p className="text-xs text-[var(--muted-foreground)]">
            有效票數 {electionTotal} · 1號候選人／2號候選人／棄權
          </p>
        </PreviewFrame>
      </div>
    </section>
  );
}
