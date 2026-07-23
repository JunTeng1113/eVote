"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResultsBreakdown } from "@/components/results-breakdown";
import { ResultsPageSkeleton } from "@/components/loading-skeletons";
import {
  ListPagination,
  LIST_PAGE_SIZE,
  slicePage,
} from "@/components/list-pagination";
import {
  exportResultsPdfA4,
  exportResultsPng,
  type PdfOrientation,
  type PngExportRatio,
  type ResultExportInput,
} from "@/lib/export-results";
import { calcPct, formatPct, formatTalliedAt } from "@/lib/results-ranking";
import { readResponseJson } from "@/lib/read-response-json";
import { ResultsProjectionView } from "@/components/results-projection-view";
import { toast } from "sonner";

type ElectionResult = {
  electionId: string;
  title: string;
  phase: string;
  votingMode: "anonymous" | "named" | "open";
  scheduleMode: "unlimited" | "timed" | "duration";
  scheduleLabel?: string;
  candidates: Array<{
    id: string;
    name: string;
    party: string;
    imageUrl: string | null;
  }>;
  stats: {
    eligibleVoters: number;
    ballotCount: number;
  };
  tallyDetail: {
    counts: Record<string, number>;
    total: number;
    talliedAt: string;
    namedVotes?: Array<{ email: string; candidateId: string }>;
  } | null;
};

function formatTurnout(validVotes: number, eligibleVoters: number): string {
  if (eligibleVoters <= 0) {
    return "—";
  }
  return formatPct(calcPct(validVotes, eligibleVoters));
}

function phaseText(phase: string): string {
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

function modeLabel(mode: ElectionResult["votingMode"]): string {
  if (mode === "named") {
    return "記名";
  }
  if (mode === "open") {
    return "無須登入";
  }
  return "不記名";
}

function buildExportInput(
  selected: ElectionResult,
  validVotes: number,
  eligibleVoters: number,
  turnout: string,
): ResultExportInput | null {
  if (!selected.tallyDetail) {
    return null;
  }
  return {
    title: selected.title,
    modeLabel: modeLabel(selected.votingMode),
    talliedAt: formatTalliedAt(selected.tallyDetail.talliedAt),
    eligibleLabel:
      selected.votingMode === "open" ? "已投票人數" : "投票權人數",
    eligibleCount:
      selected.votingMode === "open" ? validVotes : eligibleVoters,
    totalVotes: selected.tallyDetail.total,
    turnout,
    items: selected.candidates.map((c) => ({
      id: c.id,
      name: c.name,
      party: c.party,
      votes: selected.tallyDetail?.counts[c.id] ?? 0,
    })),
  };
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const electionId = searchParams.get("id");
  const [selected, setSelected] = useState<ElectionResult | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(Boolean(electionId));
  const [exporting, setExporting] = useState(false);
  const [namedPage, setNamedPage] = useState(1);
  const [projectionOpen, setProjectionOpen] = useState(false);

  async function load(id: string) {
    setLoading(true);
    setMissing(false);
    const res = await fetch(
      `/api/tally?electionId=${encodeURIComponent(id)}`,
    );
    const data = await readResponseJson<
      ElectionResult & { ok?: boolean; error?: string }
    >(res);
    setLoading(false);
    if (!data || !res.ok || !data.electionId) {
      setSelected(null);
      setMissing(true);
      toast.error(data?.error ?? "無法載入開票結果");
      return;
    }
    setSelected(data);
    setNamedPage(1);
  }

  useEffect(() => {
    if (!electionId) {
      setSelected(null);
      setMissing(false);
      setLoading(false);
      return;
    }
    let alive = true;
    void (async () => {
      const res = await fetch(
        `/api/tally?electionId=${encodeURIComponent(electionId)}`,
      );
      const data = await readResponseJson<
        ElectionResult & { ok?: boolean; error?: string }
      >(res);
      if (!alive) {
        return;
      }
      setLoading(false);
      if (!data || !res.ok || !data.electionId) {
        setSelected(null);
        setMissing(true);
        return;
      }
      setSelected(data);
      setMissing(false);
      setNamedPage(1);
    })();
    return () => {
      alive = false;
    };
  }, [electionId]);

  async function runExport(
    kind:
      | "pdf"
      | "pdf-landscape"
      | "png16"
      | "png43"
      | "png916"
      | "png34",
    payload: ResultExportInput,
  ) {
    setExporting(true);
    const labels: Record<typeof kind, string> = {
      pdf: "PDF（A4 直向）",
      "pdf-landscape": "PDF（A4 橫向）",
      png16: "PNG（16:9）",
      png43: "PNG（4:3）",
      png916: "PNG（9:16）",
      png34: "PNG（3:4）",
    };
    const ok =
      kind === "pdf" || kind === "pdf-landscape"
        ? await exportResultsPdfA4(
            payload,
            (kind === "pdf-landscape"
              ? "landscape"
              : "portrait") satisfies PdfOrientation,
          ).then(
            () => true,
            () => false,
          )
        : await exportResultsPng(
            payload,
            (kind === "png16"
              ? "16:9"
              : kind === "png43"
                ? "4:3"
                : kind === "png916"
                  ? "9:16"
                  : "3:4") satisfies PngExportRatio,
          ).then(
            () => true,
            () => false,
          );
    setExporting(false);
    if (!ok) {
      toast.error("匯出失敗，請稍後再試");
      return;
    }
    toast.success(`已下載 ${labels[kind]}`);
  }

  if (!electionId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--primary)]">
            開票結果
          </h1>
          <p className="mt-2 text-[var(--muted-foreground)]">
            請從投票頁或管理後台開啟特定投票的結果。
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-wrap gap-2 py-6">
            <Button asChild>
              <Link href="/vote">前往投票</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin">投票管理</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <ResultsPageSkeleton />;
  }

  if (missing || !selected) {
    return (
      <div className="space-y-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--primary)]">
          開票結果
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">找不到此投票。</p>
        <Button asChild variant="outline">
          <Link href="/vote">返回投票</Link>
        </Button>
      </div>
    );
  }

  const eligibleVoters = selected.stats.eligibleVoters ?? 0;
  const validVotes =
    selected.tallyDetail?.total ?? selected.stats.ballotCount ?? 0;
  const turnout = formatTurnout(validVotes, eligibleVoters);
  const exportInput = buildExportInput(
    selected,
    validVotes,
    eligibleVoters,
    turnout,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--primary)]">
            開票結果
          </h1>
          <p className="mt-2 text-[var(--muted-foreground)]">
            檢視「{selected.title}」的開票狀態與結果。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected.tallyDetail ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setProjectionOpen(true)}
            >
              全螢幕檢視
            </Button>
          ) : null}
          {exportInput ? (
            <>
              <Button
                variant="outline"
                disabled={exporting}
                onClick={() => void runExport("pdf", exportInput)}
              >
                匯出 PDF（A4 直向）
              </Button>
              <Button
                variant="outline"
                disabled={exporting}
                onClick={() => void runExport("pdf-landscape", exportInput)}
              >
                匯出 PDF（A4 橫向）
              </Button>
              <Button
                variant="outline"
                disabled={exporting}
                onClick={() => void runExport("png16", exportInput)}
              >
                匯出 PNG（16:9）
              </Button>
              <Button
                variant="outline"
                disabled={exporting}
                onClick={() => void runExport("png43", exportInput)}
              >
                匯出 PNG（4:3）
              </Button>
              <Button
                variant="outline"
                disabled={exporting}
                onClick={() => void runExport("png916", exportInput)}
              >
                匯出 PNG（9:16）
              </Button>
              <Button
                variant="outline"
                disabled={exporting}
                onClick={() => void runExport("png34", exportInput)}
              >
                匯出 PNG（3:4）
              </Button>
            </>
          ) : null}
          <Button variant="outline" onClick={() => void load(electionId)}>
            重新整理
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{selected.title}</CardTitle>
          <CardDescription>
            狀態 <Badge>{phaseText(selected.phase)}</Badge> ·{" "}
            <Badge>{modeLabel(selected.votingMode)}</Badge> ·{" "}
            <Badge>
              {selected.scheduleMode === "timed"
                ? "計時投票"
                : selected.scheduleMode === "duration"
                  ? "限時投票"
                  : "無時間限制"}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(selected.scheduleMode === "timed" ||
            selected.scheduleMode === "duration") &&
          selected.scheduleLabel ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              投票時間：{selected.scheduleLabel}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--border)] px-4 py-3">
              <div className="text-xs text-[var(--muted-foreground)]">
                {selected.votingMode === "open" ? "已投票人數" : "投票權人數"}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {selected.votingMode === "open"
                  ? validVotes
                  : eligibleVoters}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] px-4 py-3">
              <div className="text-xs text-[var(--muted-foreground)]">
                有效票數
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {validVotes}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] px-4 py-3">
              <div className="text-xs text-[var(--muted-foreground)]">
                投票率
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {turnout}
              </div>
            </div>
          </div>

          {!selected.tallyDetail ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              尚未公布結果，請等待主辦單位開票。
            </p>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-[var(--muted-foreground)]">
                開票時間：{formatTalliedAt(selected.tallyDetail.talliedAt)}
              </p>
              <ResultsBreakdown
                candidates={selected.candidates}
                counts={selected.tallyDetail.counts}
                total={selected.tallyDetail.total}
              />
              {selected.votingMode === "named" &&
              selected.tallyDetail.namedVotes &&
              selected.tallyDetail.namedVotes.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">記名明細</h3>
                  <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--muted)]/60 text-left">
                        <tr>
                          <th className="px-3 py-2 font-medium">投票權人</th>
                          <th className="px-3 py-2 font-medium">選擇</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slicePage(
                          selected.tallyDetail.namedVotes,
                          namedPage,
                          LIST_PAGE_SIZE,
                        ).map((vote) => {
                          const option = selected.candidates.find(
                            (c) => c.id === vote.candidateId,
                          );
                          return (
                            <tr
                              key={`${vote.email}-${vote.candidateId}`}
                              className="border-t border-[var(--border)]"
                            >
                              <td className="px-3 py-2">{vote.email}</td>
                              <td className="px-3 py-2">
                                {option?.name ?? vote.candidateId}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <ListPagination
                    page={namedPage}
                    totalItems={selected.tallyDetail.namedVotes.length}
                    pageSize={LIST_PAGE_SIZE}
                    onPageChange={setNamedPage}
                  />
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {projectionOpen && selected.tallyDetail ? (
        <ResultsProjectionView
          result={{
            title: selected.title,
            modeLabel: modeLabel(selected.votingMode),
            talliedAt: formatTalliedAt(selected.tallyDetail.talliedAt),
            eligibleLabel:
              selected.votingMode === "open" ? "已投票人數" : "投票權人數",
            eligibleCount:
              selected.votingMode === "open" ? validVotes : eligibleVoters,
            totalVotes: selected.tallyDetail.total,
            turnout,
            candidates: selected.candidates,
            counts: selected.tallyDetail.counts,
          }}
          onClose={() => setProjectionOpen(false)}
        />
      ) : null}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<ResultsPageSkeleton />}>
      <ResultsContent />
    </Suspense>
  );
}
