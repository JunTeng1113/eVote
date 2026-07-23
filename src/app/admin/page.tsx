"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CandidateVisual } from "@/components/candidate-visual";
import { ElectionProjectionView } from "@/components/election-projection-view";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  canReopenVoting,
  durationMinutesFromParts,
  formatDurationMinutes,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
} from "@/lib/voting-schedule";
import { buildVoteShareUrl } from "@/lib/election-share";
import { readResponseJson } from "@/lib/read-response-json";
import { CopyVoteLinkButton } from "@/components/copy-vote-link-button";
import { AdminPageSkeleton } from "@/components/loading-skeletons";
import {
  ListPagination,
  LIST_PAGE_SIZE,
  slicePage,
} from "@/components/list-pagination";
import { Skeleton } from "@/components/ui/skeleton";

const titleFormSchema = z
  .object({
    title: z.string().min(2, "請輸入投票標題"),
    description: z.string().optional(),
    votingMode: z.enum(["anonymous", "named", "open"]),
    scheduleMode: z.enum(["unlimited", "timed", "duration"]),
    votingStartsAt: z.string().optional(),
    votingEndsAt: z.string().optional(),
    durationValue: z.number().optional(),
    durationUnit: z.enum(["minutes", "hours", "days"]),
  })
  .superRefine((data, ctx) => {
    if (data.scheduleMode === "duration") {
      const minutes = durationMinutesFromParts(
        data.durationValue ?? 0,
        data.durationUnit,
      );
      if (
        minutes < MIN_DURATION_MINUTES ||
        minutes > MAX_DURATION_MINUTES
      ) {
        ctx.addIssue({
          code: "custom",
          message: `限時需介於 ${formatDurationMinutes(MIN_DURATION_MINUTES)} 至 ${formatDurationMinutes(MAX_DURATION_MINUTES)}`,
          path: ["durationValue"],
        });
      }
      return;
    }
    if (data.scheduleMode !== "timed") {
      return;
    }
    if (!data.votingStartsAt?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "請設定投票開始時間",
        path: ["votingStartsAt"],
      });
    }
    if (!data.votingEndsAt?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "請設定投票截止時間",
        path: ["votingEndsAt"],
      });
    }
    if (!data.votingStartsAt?.trim() || !data.votingEndsAt?.trim()) {
      return;
    }
    const start = new Date(data.votingStartsAt);
    const end = new Date(data.votingEndsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      ctx.addIssue({
        code: "custom",
        message: "投票時間格式無效",
        path: ["votingStartsAt"],
      });
      return;
    }
    if (end <= start) {
      ctx.addIssue({
        code: "custom",
        message: "截止時間必須晚於開始時間",
        path: ["votingEndsAt"],
      });
    }
  });

const emailsFormSchema = z.object({
  emails: z.string().min(3, "請輸入至少一個 Email"),
});

type AdminSection = "create" | "list";
type CreateStep = 1 | 2 | 3;
type DetailTab = "overview" | "audit" | "voters" | "managers";

type DraftCandidate = {
  key: string;
  name: string;
  party: string;
  imageUrl: string | null;
};

type ElectionSummary = {
  electionId: string;
  title: string;
  description: string;
  phase: string;
  votingMode: "anonymous" | "named" | "open";
  scheduleMode: "unlimited" | "timed" | "duration";
  votingStartsAt: string | null;
  votingEndsAt: string | null;
  scheduleLabel?: string;
  windowStatus?: string;
  createdByEmail?: string | null;
  managerEmails?: string[];
  myRole?: "system" | "creator" | "manager";
  candidateCount?: number;
  candidates?: Array<{
    id: string;
    name: string;
    party: string;
    imageUrl: string | null;
  }>;
  stats: {
    eligibleVoters: number;
    authorizedCount: number;
    ballotCount: number;
  };
};

type ManagerRow = {
  email: string;
  isCreator: boolean;
};

type VoterRow = {
  email: string;
  displayName: string;
  hasVoted: boolean;
  authorizedAt: string | null;
};

type AuditResult = {
  passed: boolean;
  phase: string;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
};

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

function votingModeText(mode: string): string {
  if (mode === "named") {
    return "記名";
  }
  if (mode === "open") {
    return "無須登入";
  }
  return "不記名";
}

function scheduleModeText(mode: string): string {
  if (mode === "timed") {
    return "計時投票";
  }
  if (mode === "duration") {
    return "限時投票";
  }
  return "無時間限制";
}

function newDraftCandidate(
  partial?: Partial<Pick<DraftCandidate, "name" | "party" | "imageUrl">>,
): DraftCandidate {
  return {
    key: crypto.randomUUID(),
    name: partial?.name ?? "",
    party: partial?.party ?? "",
    imageUrl: partial?.imageUrl ?? null,
  };
}

/** 每行一個選項；可用 Tab、|、逗號分隔「名稱」與「補充說明」。 */
function parseBulkCandidates(raw: string): Array<{ name: string; party: string }> {
  const lines = raw.split(/\r?\n/);
  const result: Array<{ name: string; party: string }> = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const parts = trimmed
      .split(/\t|\||,|，/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    const name = parts[0];
    if (!name) {
      continue;
    }
    result.push({
      name,
      party: parts[1] ?? "",
    });
  }
  return result;
}

async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/admin/upload", {
    method: "POST",
    body,
  });
  const data = await readResponseJson<{
    ok: boolean;
    error?: string;
    imageUrl?: string;
  }>(res);
  if (!data?.ok || !data.imageUrl) {
    throw new Error(data?.error ?? "圖片上傳失敗");
  }
  return data.imageUrl;
}

function StepBadge({
  step,
  current,
  label,
}: {
  step: number;
  current: number;
  label: string;
}) {
  const active = step === current;
  const done = step < current;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
        active
          ? "border-[var(--primary)] bg-[var(--muted)] text-[var(--foreground)]"
          : done
            ? "border-[var(--secondary)]/40 text-[var(--secondary)]"
            : "border-[var(--border)] text-[var(--muted-foreground)]",
      )}
    >
      <span className="font-semibold">{step}</span>
      <span>{label}</span>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [ready, setReady] = useState(false);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [section, setSection] = useState<AdminSection>("list");
  const [createStep, setCreateStep] = useState<CreateStep>(1);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [projectionOpen, setProjectionOpen] = useState(false);

  const [elections, setElections] = useState<ElectionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ElectionSummary | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [listPage, setListPage] = useState(1);
  const [voters, setVoters] = useState<VoterRow[]>([]);
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [managerEmailsDraft, setManagerEmailsDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [draftCandidates, setDraftCandidates] = useState<DraftCandidate[]>([
    newDraftCandidate(),
    newDraftCandidate(),
  ]);
  const [bulkCandidatesDraft, setBulkCandidatesDraft] = useState("");
  const [showBulkCandidates, setShowBulkCandidates] = useState(false);
  const [voterEmailsDraft, setVoterEmailsDraft] = useState("");

  const titleForm = useForm<z.infer<typeof titleFormSchema>>({
    resolver: zodResolver(titleFormSchema),
    defaultValues: {
      title: "",
      description: "",
      votingMode: "anonymous",
      scheduleMode: "unlimited",
      votingStartsAt: "",
      votingEndsAt: "",
      durationValue: 3,
      durationUnit: "minutes",
    },
  });
  const scheduleMode = titleForm.watch("scheduleMode");
  const votingMode = titleForm.watch("votingMode");
  const durationValue = titleForm.watch("durationValue");
  const durationUnit = titleForm.watch("durationUnit");
  const resolvedDurationMinutes = durationMinutesFromParts(
    durationValue ?? 0,
    durationUnit,
  );

  const emailsForm = useForm<z.infer<typeof emailsFormSchema>>({
    resolver: zodResolver(emailsFormSchema),
    defaultValues: { emails: "" },
  });

  const listItem =
    elections.find((e) => e.electionId === selectedId) ?? null;
  const selected =
    selectedId && selectedDetail?.electionId === selectedId
      ? {
          ...(listItem ?? {}),
          ...selectedDetail,
          myRole: listItem?.myRole ?? selectedDetail.myRole,
          candidates: selectedDetail.candidates ?? [],
        }
      : null;
  const pagedElections = slicePage(elections, listPage, LIST_PAGE_SIZE);
  const selectedCanReopen =
    selected &&
    canReopenVoting({
      phase: selected.phase as "voting" | "closed" | "mixing" | "tallied",
      scheduleMode: selected.scheduleMode,
      votingStartsAt: selected.votingStartsAt,
      votingEndsAt: selected.votingEndsAt,
    });

  async function loadElectionDetail(electionId: string) {
    setDetailLoading(true);
    const res = await fetch(
      `/api/election?id=${encodeURIComponent(electionId)}`,
    );
    const data = await readResponseJson<
      ElectionSummary & { error?: string; ok?: boolean }
    >(res);
    setDetailLoading(false);
    if (!res.ok || !data?.electionId) {
      toast.error(data?.error ?? "無法載入投票詳情");
      setSelectedDetail(null);
      return;
    }
    setSelectedDetail({
      ...data,
      candidates: data.candidates ?? [],
      stats: data.stats ?? {
        eligibleVoters: 0,
        authorizedCount: 0,
        ballotCount: 0,
      },
    });
  }

  async function loadElections(preferId?: string | null) {
    const res = await fetch("/api/admin/elections");
    const data = await readResponseJson<{
      ok?: boolean;
      error?: string;
      isSystemAdmin?: boolean;
      elections?: ElectionSummary[];
    }>(res);
    if (!res.ok || !data) {
      setReady(false);
      setError(data?.error ?? "無法載入投票");
      return;
    }
    setReady(true);
    setIsSystemAdmin(Boolean(data.isSystemAdmin));
    const list = data.elections ?? [];
    setElections(list);
    setListPage(1);
    if (preferId && list.some((e) => e.electionId === preferId)) {
      setSelectedId(preferId);
      await loadElectionDetail(preferId);
      await loadVoters(preferId);
      await loadManagers(preferId);
      return;
    }
    if (selectedId && list.some((e) => e.electionId === selectedId)) {
      await loadElectionDetail(selectedId);
      await loadVoters(selectedId);
      await loadManagers(selectedId);
      return;
    }
    setSelectedId(null);
    setSelectedDetail(null);
    setVoters([]);
    setManagers([]);
  }

  async function loadVoters(electionId: string) {
    const res = await fetch(
      `/api/admin/voters?electionId=${encodeURIComponent(electionId)}`,
    );
    const data = (await res.json()) as { ok?: boolean; voters?: VoterRow[] };
    if (res.ok) {
      setVoters(data.voters ?? []);
    }
  }

  async function loadManagers(electionId: string) {
    const res = await fetch(
      `/api/admin/managers?electionId=${encodeURIComponent(electionId)}`,
    );
    const data = (await res.json()) as {
      ok?: boolean;
      managers?: ManagerRow[];
    };
    if (res.ok) {
      setManagers(data.managers ?? []);
    }
  }

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }
    let alive = true;
    void (async () => {
      const res = await fetch("/api/admin/elections");
      const data = await readResponseJson<{
        ok?: boolean;
        error?: string;
        isSystemAdmin?: boolean;
        elections?: ElectionSummary[];
      }>(res);
      if (!alive) {
        return;
      }
      if (!res.ok || !data) {
        setReady(false);
        setError(data?.error ?? "無法載入投票");
        return;
      }
      setReady(true);
      setIsSystemAdmin(Boolean(data.isSystemAdmin));
      setElections(data.elections ?? []);
    })();
    return () => {
      alive = false;
    };
  }, [status]);

  function resetCreateWizard() {
    titleForm.reset({
      title: "",
      description: "",
      votingMode: "anonymous",
      scheduleMode: "unlimited",
      votingStartsAt: "",
      votingEndsAt: "",
      durationValue: 3,
      durationUnit: "minutes",
    });
    setDraftCandidates([newDraftCandidate(), newDraftCandidate()]);
    setBulkCandidatesDraft("");
    setShowBulkCandidates(false);
    setVoterEmailsDraft("");
    setCreateStep(1);
  }

  async function onDraftImageChange(key: string, file: File | null) {
    if (!file) {
      return;
    }
    setBusy(true);
    try {
      const imageUrl = await uploadImage(file);
      setDraftCandidates((prev) =>
        prev.map((c) => (c.key === key ? { ...c, imageUrl } : c)),
      );
    } catch (uploadError) {
      toast.error(
        uploadError instanceof Error ? uploadError.message : "圖片上傳失敗",
      );
    }
    setBusy(false);
  }

  function goCreateStep2(values: z.infer<typeof titleFormSchema>) {
    titleForm.reset(values);
    setCreateStep(2);
  }

  function findDuplicateCandidateNames(
    candidates: Array<{ name: string }>,
  ): string[] {
    const counts = new Map<string, number>();
    for (const candidate of candidates) {
      const name = candidate.name.trim();
      if (!name) {
        continue;
      }
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => name);
  }

  function goCreateStep3() {
    const candidates = draftCandidates.filter((c) => c.name.trim().length > 0);
    if (candidates.length < 2) {
      toast.error("至少需要 2 個投票選項");
      return;
    }
    const duplicates = findDuplicateCandidateNames(candidates);
    if (duplicates.length > 0) {
      toast.error(`選項名稱不可重複：${duplicates.join("、")}`);
      return;
    }
    setCreateStep(3);
  }

  function applyBulkCandidates(mode: "replace" | "append") {
    const parsed = parseBulkCandidates(bulkCandidatesDraft);
    if (parsed.length === 0) {
      toast.error("請貼上至少一個選項（每行一個）");
      return;
    }
    const imported = parsed.map((item) =>
      newDraftCandidate({ name: item.name, party: item.party }),
    );
    if (mode === "replace") {
      setDraftCandidates(
        imported.length >= 2
          ? imported
          : [...imported, newDraftCandidate()],
      );
    } else {
      const kept = draftCandidates.filter((c) => c.name.trim().length > 0);
      setDraftCandidates([...kept, ...imported]);
    }
    toast.success(`已匯入 ${imported.length} 個選項`);
  }

  async function submitCreate() {
    const meta = titleForm.getValues();
    const candidates = draftCandidates
      .map((c) => ({
        name: c.name.trim(),
        party: c.party.trim() || undefined,
        imageUrl: c.imageUrl,
      }))
      .filter((c) => c.name.length > 0);

    if (candidates.length < 2) {
      toast.error("至少需要 2 個投票選項");
      setCreateStep(2);
      return;
    }
    const duplicates = findDuplicateCandidateNames(candidates);
    if (duplicates.length > 0) {
      toast.error(`選項名稱不可重複：${duplicates.join("、")}`);
      setCreateStep(2);
      return;
    }

    setBusy(true);
    const res = await fetch("/api/admin/elections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: meta.title,
        description: meta.description,
        votingMode: meta.votingMode,
        scheduleMode: meta.scheduleMode,
        votingStartsAt:
          meta.scheduleMode === "timed" && meta.votingStartsAt
            ? new Date(meta.votingStartsAt).toISOString()
            : undefined,
        votingEndsAt:
          meta.scheduleMode === "timed" && meta.votingEndsAt
            ? new Date(meta.votingEndsAt).toISOString()
            : undefined,
        durationMinutes:
          meta.scheduleMode === "duration"
            ? durationMinutesFromParts(
                meta.durationValue ?? 0,
                meta.durationUnit,
              )
            : undefined,
        voterEmails: votingMode === "open" ? "" : voterEmailsDraft,
        candidates,
      }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      election?: ElectionSummary;
    };
    setBusy(false);
    if (!data.ok || !data.election) {
      toast.error(data.error ?? "建立失敗");
      return;
    }

    const shareUrl = buildVoteShareUrl(
      data.election.electionId,
      typeof window !== "undefined" ? window.location.origin : null,
    );
    toast.success(`已建立「${data.election.title}」`, {
      description: "可複製投票連結分享給投票權人",
      action: {
        label: "複製連結",
        onClick: () => {
          void navigator.clipboard.writeText(shareUrl).then(() => {
            toast.success("已複製投票連結");
          });
        },
      },
    });
    resetCreateWizard();
    await loadElections(data.election.electionId);
    setSection("list");
    setDetailTab("overview");
  }

  async function onSelect(electionId: string) {
    setSelectedId(electionId);
    setDetailTab("overview");
    setAudit(null);
    setSelectedDetail(null);
    await loadElectionDetail(electionId);
    await loadVoters(electionId);
    await loadManagers(electionId);
  }

  async function onAddManagers() {
    if (!selectedId || !managerEmailsDraft.trim()) {
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        electionId: selectedId,
        emails: managerEmailsDraft,
      }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      added?: string[];
      skipped?: string[];
    };
    setBusy(false);
    if (!data.ok) {
      toast.error(data.error ?? "新增失敗");
      return;
    }
    toast.success(
      `已新增 ${data.added?.length ?? 0} 人；略過 ${data.skipped?.length ?? 0} 人`,
    );
    setManagerEmailsDraft("");
    await loadManagers(selectedId);
    await loadElections(selectedId);
  }

  async function onRemoveManager(email: string) {
    if (!selectedId) {
      return;
    }
    if (!window.confirm(`確定移除共同管理者 ${email}？`)) {
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/managers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ electionId: selectedId, email }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setBusy(false);
    if (!data.ok) {
      toast.error(data.error ?? "移除失敗");
      return;
    }
    toast.success("已移除共同管理者");
    await loadManagers(selectedId);
    await loadElections(selectedId);
  }

  async function onExistingImageChange(candidateId: string, file: File | null) {
    if (!selectedId || !file) {
      return;
    }
    setBusy(true);
    try {
      const imageUrl = await uploadImage(file);
      const res = await fetch("/api/admin/elections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          electionId: selectedId,
          candidateId,
          imageUrl,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        toast.error(data.error ?? "更新圖片失敗");
      } else {
        toast.success("已更新選項圖片");
        await loadElections(selectedId);
      }
    } catch (uploadError) {
      toast.error(
        uploadError instanceof Error ? uploadError.message : "圖片上傳失敗",
      );
    }
    setBusy(false);
  }

  async function onAddEmails(values: z.infer<typeof emailsFormSchema>) {
    if (!selectedId) {
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/voters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ electionId: selectedId, emails: values.emails }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      added?: string[];
      skipped?: string[];
    };
    setBusy(false);
    if (!data.ok) {
      toast.error(data.error ?? "新增失敗");
      return;
    }
    toast.success(
      `已新增 ${data.added?.length ?? 0} 人；略過 ${data.skipped?.length ?? 0} 人`,
    );
    emailsForm.reset({ emails: "" });
    await loadElections(selectedId);
  }

  async function onRemoveEmail(email: string) {
    if (!selectedId) {
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/voters", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ electionId: selectedId, email }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setBusy(false);
    if (!data.ok) {
      toast.error(data.error ?? "移除失敗");
      return;
    }
    toast.success("已移除投票權人");
    await loadElections(selectedId);
  }

  async function runAction(action: "close" | "reopen" | "tally"): Promise<boolean> {
    if (!selectedId) {
      return false;
    }
    if (action === "close") {
      const confirmed = window.confirm(
        "確定要截止投票嗎？截止後投票權人將無法再送出選票。",
      );
      if (!confirmed) {
        return false;
      }
    }
    if (action === "reopen") {
      const confirmed = window.confirm(
        "確定要恢復投票嗎？恢復後投票權人可再次送出選票。",
      );
      if (!confirmed) {
        return false;
      }
    }
    if (action === "tally") {
      const confirmed = window.confirm(
        "確定要執行開票嗎？開票後將公布結果，且無法再恢復投票。",
      );
      if (!confirmed) {
        return false;
      }
    }
    setBusy(true);
    const res = await fetch("/api/tally", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, electionId: selectedId }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setBusy(false);
    if (!data.ok) {
      toast.error(data.error ?? "操作失敗");
      return false;
    }
    const messages: Record<typeof action, string> = {
      close: "已截止投票",
      reopen: "已恢復投票",
      tally: "開票完成",
    };
    toast.success(messages[action]);
    await loadElections(selectedId);
    return true;
  }

  async function onReset() {
    if (!selectedId) {
      return;
    }
    if (
      !window.confirm(
        "確定要重設此投票嗎？選票與開票結果將清除，並回到投票中狀態（保留本場名單）。",
      )
    ) {
      return;
    }
    if (!window.confirm("請再次確認：真的要重設此投票？")) {
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/elections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ electionId: selectedId, keepVoters: true }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setBusy(false);
    if (!data.ok) {
      toast.error(data.error ?? "重設失敗");
      return;
    }
    toast.success("已重設此投票（保留本場名單）");
    await loadElections(selectedId);
  }

  async function onDelete() {
    if (!selectedId) {
      return;
    }
    if (!window.confirm("確定刪除此投票？此操作無法復原。")) {
      return;
    }
    if (!window.confirm("請再次確認：真的要永久刪除此投票？")) {
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/elections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ electionId: selectedId }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setBusy(false);
    if (!data.ok) {
      toast.error(data.error ?? "刪除失敗");
      return;
    }
    toast.success("已刪除投票");
    setProjectionOpen(false);
    setSelectedId(null);
    setVoters([]);
    await loadElections(null);
  }

  async function runAudit() {
    if (!selectedId) {
      return;
    }
    const res = await fetch(
      `/api/audit/verify?electionId=${encodeURIComponent(selectedId)}`,
    );
    setAudit((await res.json()) as AuditResult);
  }

  if (status === "loading") {
    return <AdminPageSkeleton />;
  }

  if (status !== "authenticated" || !session?.user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>登入後管理投票</CardTitle>
          <CardDescription>
            任何登入使用者都可建立投票；建立者可邀請共同管理者。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void signIn("google")}>使用 Google 登入</Button>
        </CardContent>
      </Card>
    );
  }

  if (!ready) {
    if (error) {
      return (
        <p className="text-sm text-red-600">{error}</p>
      );
    }
    return <AdminPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--primary)]">
          投票管理
        </h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          建立新投票採分階段填寫；也可查看你管理的投票並管理名單。
          {isSystemAdmin ? "（系統管理者可查看全部投票）" : null}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={section === "list" ? "default" : "outline"}
          onClick={() => {
            setSection("list");
            void loadElections(selectedId);
          }}
        >
          查看投票列表
        </Button>
        <Button
          variant={section === "create" ? "default" : "outline"}
          onClick={() => {
            setSection("create");
          }}
        >
          建立新投票
        </Button>
      </div>

      {section === "create" ? (
        <Card>
          <CardHeader>
            <CardTitle>建立新投票</CardTitle>
            <CardDescription>請依序完成三個階段後送出。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <StepBadge step={1} current={createStep} label="標題與說明" />
              <StepBadge step={2} current={createStep} label="投票選項" />
              <StepBadge
                step={3}
                current={createStep}
                label={votingMode === "open" ? "分享連結" : "可投票名單"}
              />
            </div>

            {createStep === 1 ? (
              <form
                className="space-y-4"
                onSubmit={titleForm.handleSubmit(goCreateStep2)}
              >
                <div className="space-y-2">
                  <Label htmlFor="title">投票標題</Label>
                  <Input id="title" {...titleForm.register("title")} />
                  {titleForm.formState.errors.title ? (
                    <p className="text-sm text-red-600">
                      {titleForm.formState.errors.title.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">說明（選填）</Label>
                  <textarea
                    id="description"
                    className="min-h-28 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                    placeholder="向投票權人說明這場投票的目的"
                    {...titleForm.register("description")}
                  />
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">投票方式</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] px-3 py-3 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--muted)]">
                      <input
                        type="radio"
                        value="anonymous"
                        className="mt-1"
                        {...titleForm.register("votingMode")}
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          不記名投票
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                          預設。需登入且在名單內；可確認有投票，但無法得知誰投了什麼。
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] px-3 py-3 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--muted)]">
                      <input
                        type="radio"
                        value="named"
                        className="mt-1"
                        {...titleForm.register("votingMode")}
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          記名投票
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                          需登入且在名單內；開票後可對照每位投票權人的選擇。
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] px-3 py-3 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--muted)]">
                      <input
                        type="radio"
                        value="open"
                        className="mt-1"
                        {...titleForm.register("votingMode")}
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          無須登入
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                          僅能透過分享連結投票；以連線位址防重複，不需 Google 登入。
                        </span>
                      </span>
                    </label>
                  </div>
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">投票時間</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] px-3 py-3 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--muted)]">
                      <input
                        type="radio"
                        value="unlimited"
                        className="mt-1"
                        {...titleForm.register("scheduleMode")}
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          無時間限制
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                          由管理員手動截止或恢復投票。
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] px-3 py-3 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--muted)]">
                      <input
                        type="radio"
                        value="duration"
                        className="mt-1"
                        {...titleForm.register("scheduleMode")}
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          限時投票
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                          建立後立即開始，到時自動截止。
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] px-3 py-3 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--muted)]">
                      <input
                        type="radio"
                        value="timed"
                        className="mt-1"
                        {...titleForm.register("scheduleMode")}
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          計時投票
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                          設定開始與截止時間，到期自動截止。
                        </span>
                      </span>
                    </label>
                  </div>
                  {scheduleMode === "duration" ? (
                    <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            { label: "3 分鐘", value: 3, unit: "minutes" },
                            { label: "1 小時", value: 1, unit: "hours" },
                            { label: "2 天", value: 2, unit: "days" },
                          ] as const
                        ).map((preset) => {
                          const selected =
                            durationValue === preset.value &&
                            durationUnit === preset.unit;
                          return (
                            <Button
                              key={preset.label}
                              type="button"
                              size="sm"
                              variant={selected ? "default" : "outline"}
                              onClick={() => {
                                titleForm.setValue(
                                  "durationValue",
                                  preset.value,
                                  { shouldValidate: true },
                                );
                                titleForm.setValue(
                                  "durationUnit",
                                  preset.unit,
                                  { shouldValidate: true },
                                );
                              }}
                            >
                              {preset.label}
                            </Button>
                          );
                        })}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                        <div className="space-y-2">
                          <Label htmlFor="durationValue">自訂時長</Label>
                          <Input
                            id="durationValue"
                            type="number"
                            min={1}
                            step={1}
                            {...titleForm.register("durationValue", {
                              valueAsNumber: true,
                            })}
                          />
                          {titleForm.formState.errors.durationValue ? (
                            <p className="text-sm text-red-600">
                              {
                                titleForm.formState.errors.durationValue
                                  .message
                              }
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="durationUnit">單位</Label>
                          <select
                            id="durationUnit"
                            className="flex h-10 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                            {...titleForm.register("durationUnit")}
                          >
                            <option value="minutes">分鐘</option>
                            <option value="hours">小時</option>
                            <option value="days">天</option>
                          </select>
                        </div>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        建立後立即開始，約{" "}
                        {resolvedDurationMinutes >= MIN_DURATION_MINUTES &&
                        resolvedDurationMinutes <= MAX_DURATION_MINUTES
                          ? formatDurationMinutes(resolvedDurationMinutes)
                          : "—"}{" "}
                        後自動截止（最短{" "}
                        {formatDurationMinutes(MIN_DURATION_MINUTES)}，最長{" "}
                        {formatDurationMinutes(MAX_DURATION_MINUTES)}）。
                      </p>
                    </div>
                  ) : null}
                  {scheduleMode === "timed" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="votingStartsAt">開始時間</Label>
                        <Input
                          id="votingStartsAt"
                          type="datetime-local"
                          {...titleForm.register("votingStartsAt")}
                        />
                        {titleForm.formState.errors.votingStartsAt ? (
                          <p className="text-sm text-red-600">
                            {titleForm.formState.errors.votingStartsAt.message}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="votingEndsAt">截止時間</Label>
                        <Input
                          id="votingEndsAt"
                          type="datetime-local"
                          {...titleForm.register("votingEndsAt")}
                        />
                        {titleForm.formState.errors.votingEndsAt ? (
                          <p className="text-sm text-red-600">
                            {titleForm.formState.errors.votingEndsAt.message}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </fieldset>
                <div className="flex justify-end">
                  <Button type="submit">下一步</Button>
                </div>
              </form>
            ) : null}

            {createStep === 2 ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>投票選項</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setDraftCandidates([
                          newDraftCandidate({ name: "同意" }),
                          newDraftCandidate({ name: "不同意" }),
                          newDraftCandidate({ name: "棄權" }),
                        ])
                      }
                    >
                      快速填入：同意／不同意／棄權
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={showBulkCandidates ? "default" : "outline"}
                      onClick={() => setShowBulkCandidates((prev) => !prev)}
                    >
                      {showBulkCandidates ? "收合整批輸入" : "整批輸入"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDraftCandidates((prev) => [
                          ...prev,
                          newDraftCandidate(),
                        ])
                      }
                    >
                      新增選項
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  可用於選舉、議題表決等；選項名稱可自由填寫，「補充說明」為選填。候選人較多時可使用「整批輸入」。
                </p>

                {showBulkCandidates ? (
                  <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3">
                    <div>
                      <Label htmlFor="bulkCandidatesDraft">整批輸入選項</Label>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        每行一個選項。可用 Tab、逗號或｜分隔補充說明，例如：
                        <span className="font-mono">王小明｜甲單位</span>
                      </p>
                    </div>
                    <textarea
                      id="bulkCandidatesDraft"
                      className="min-h-36 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm"
                      placeholder={"王小明｜甲單位\n李小華｜乙單位\n陳小美"}
                      value={bulkCandidatesDraft}
                      onChange={(event) =>
                        setBulkCandidatesDraft(event.target.value)
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => applyBulkCandidates("replace")}
                      >
                        匯入並取代現有
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => applyBulkCandidates("append")}
                      >
                        附加到現有選項
                      </Button>
                    </div>
                  </div>
                ) : null}

                {draftCandidates.map((candidate, index) => (
                  <div
                    key={candidate.key}
                    className="space-y-3 rounded-lg border border-[var(--border)] p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        選項 {index + 1}
                      </span>
                      {draftCandidates.length > 2 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setDraftCandidates((prev) =>
                              prev.filter((c) => c.key !== candidate.key),
                            )
                          }
                        >
                          移除
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                      <div className="space-y-2">
                        {candidate.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={candidate.imageUrl}
                            alt={candidate.name || `選項 ${index + 1}`}
                            className="h-20 w-20 rounded-lg object-cover border border-[var(--border)]"
                          />
                        ) : (
                          <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                            無圖片
                          </div>
                        )}
                        <Input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          disabled={busy}
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            void onDraftImageChange(candidate.key, file);
                            event.target.value = "";
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Input
                          placeholder="選項名稱（例如：同意、候選人姓名）"
                          value={candidate.name}
                          onChange={(event) =>
                            setDraftCandidates((prev) =>
                              prev.map((c) =>
                                c.key === candidate.key
                                  ? { ...c, name: event.target.value }
                                  : c,
                              ),
                            )
                          }
                        />
                        <Input
                          placeholder="補充說明（選填，例如單位、備註）"
                          value={candidate.party}
                          onChange={(event) =>
                            setDraftCandidates((prev) =>
                              prev.map((c) =>
                                c.key === candidate.key
                                  ? { ...c, party: event.target.value }
                                  : c,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCreateStep(1);
                    }}
                  >
                    上一步
                  </Button>
                  <Button type="button" onClick={goCreateStep3}>
                    下一步
                  </Button>
                </div>
              </div>
            ) : null}

            {createStep === 3 ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-sm">
                  <div className="font-medium">{titleForm.getValues("title")}</div>
                  <div className="mt-1 text-[var(--muted-foreground)]">
                    {votingModeText(titleForm.getValues("votingMode"))} ·{" "}
                    {scheduleModeText(titleForm.getValues("scheduleMode"))} ·
                    選項 {draftCandidates.filter((c) => c.name.trim()).length}{" "}
                    個
                  </div>
                </div>
                {votingMode === "open" ? (
                  <Alert>
                    <p className="font-medium">此場無須登入，也不需可投票名單</p>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      建立後請複製專屬投票連結分享給參與者。系統會記錄連線位址雜湊，同一連線無法重複投票。此場不會出現在一般投票列表。
                    </p>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="voterEmailsDraft">此場可投票 Email</Label>
                    <textarea
                      id="voterEmailsDraft"
                      className="min-h-36 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                      placeholder={"alice@gmail.com\nbob@gmail.com"}
                      value={voterEmailsDraft}
                      onChange={(event) =>
                        setVoterEmailsDraft(event.target.value)
                      }
                    />
                    <p className="text-xs text-[var(--muted-foreground)]">
                      可先空白，建立後再於「查看投票列表」補上。此名單只屬於這一場。
                    </p>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCreateStep(2);
                    }}
                  >
                    上一步
                  </Button>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void submitCreate()}
                  >
                    {busy ? "建立中…" : "完成建立"}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {section === "list" ? (
        <div className="space-y-4">
          {!selectedId ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <CardTitle>投票列表</CardTitle>
                    <CardDescription>
                      {isSystemAdmin
                        ? "系統管理者可查看全部投票。"
                        : "僅顯示你建立或被授權管理的投票。"}
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => void loadElections(null)}
                  >
                    重新整理
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {elections.length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    尚無投票。請先到「建立新投票」。
                  </p>
                ) : (
                  <>
                    {pagedElections.map((election) => (
                      <button
                        key={election.electionId}
                        type="button"
                        onClick={() => void onSelect(election.electionId)}
                        className="w-full rounded-lg border border-[var(--border)] px-3 py-3 text-left transition hover:bg-[var(--muted)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{election.title}</span>
                          <div className="flex gap-2">
                            {election.myRole === "creator" ? (
                              <Badge>建立者</Badge>
                            ) : null}
                            {election.myRole === "manager" ? (
                              <Badge>共同管理者</Badge>
                            ) : null}
                            {election.myRole === "system" ? (
                              <Badge>系統</Badge>
                            ) : null}
                            <Badge>{votingModeText(election.votingMode)}</Badge>
                            <Badge>{phaseText(election.phase)}</Badge>
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {election.candidateCount ??
                            election.candidates?.length ??
                            0}{" "}
                          個選項 ·{" "}
                          {election.votingMode === "open"
                            ? "公開連結投票"
                            : `投票權人數 ${election.stats.eligibleVoters} 人`}{" "}
                          · 已投票人數 {election.stats.ballotCount} 人
                        </div>
                      </button>
                    ))}
                    <ListPagination
                      page={listPage}
                      totalItems={elections.length}
                      onPageChange={setListPage}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          ) : detailLoading || !selected ? (
            <Card>
              <CardHeader className="space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setProjectionOpen(false);
                    setSelectedId(null);
                    setSelectedDetail(null);
                    setVoters([]);
                    setAudit(null);
                  }}
                >
                  返回列表
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={detailTab === "overview" ? "default" : "outline"}
                    onClick={() => setDetailTab("overview")}
                  >
                    說明與選項
                  </Button>
                  <Button
                    variant={detailTab === "audit" ? "default" : "outline"}
                    onClick={() => {
                      setDetailTab("audit");
                      void runAudit();
                    }}
                  >
                    檢查資料
                  </Button>
                  <Button
                    variant={detailTab === "voters" ? "default" : "outline"}
                    onClick={() => setDetailTab("voters")}
                    disabled={selected.votingMode === "open"}
                    title={
                      selected.votingMode === "open"
                        ? "無須登入投票不使用可投票名單"
                        : undefined
                    }
                  >
                    可投票名單
                  </Button>
                  <Button
                    variant={detailTab === "managers" ? "default" : "outline"}
                    onClick={() => {
                      setDetailTab("managers");
                      if (selectedId) {
                        void loadManagers(selectedId);
                      }
                    }}
                  >
                    共同管理者
                  </Button>
                </div>
              </div>

              {detailTab === "overview" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{selected.title}</CardTitle>
                    <CardDescription>
                      狀態 <Badge>{phaseText(selected.phase)}</Badge> ·{" "}
                      <Badge>{votingModeText(selected.votingMode)}</Badge> ·{" "}
                      <Badge>{scheduleModeText(selected.scheduleMode)}</Badge> ·
                      已收到 {selected.stats.ballotCount} 票
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,20rem)]">
                      <div className="min-w-0 space-y-3">
                        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--muted-foreground)]">
                          {selected.description.trim()
                            ? selected.description
                            : "（無說明）"}
                        </div>
                        {selected.scheduleMode === "timed" ||
                        selected.scheduleMode === "duration" ? (
                          <p className="text-sm text-[var(--muted-foreground)]">
                            投票時間：{selected.scheduleLabel}
                          </p>
                        ) : null}
                        {selected.votingMode === "open" ? (
                          <Alert>
                            此場為無須登入投票，請透過上方連結分享給參與者。一般投票列表不會顯示此場。
                          </Alert>
                        ) : null}
                      </div>

                      <aside className="space-y-4 self-start rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-4 lg:sticky lg:top-4">
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-[var(--muted-foreground)]">
                            分享與檢視
                          </div>
                          <div className="flex flex-col gap-2">
                            <CopyVoteLinkButton
                              electionId={selected.electionId}
                              variant="outline"
                              className="w-full"
                            />
                            <Button asChild variant="outline" className="w-full">
                              <Link
                                href={`/vote/${encodeURIComponent(selected.electionId)}`}
                                target="_blank"
                              >
                                開啟投票頁
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              className="w-full"
                              onClick={() => setProjectionOpen(true)}
                            >
                              全螢幕檢視
                            </Button>
                            <Button asChild variant="outline" className="w-full">
                              <Link
                                href={`/results?id=${encodeURIComponent(selected.electionId)}`}
                              >
                                看結果
                              </Link>
                            </Button>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <div className="text-xs font-medium text-[var(--muted-foreground)]">
                            投票流程
                          </div>
                          <div className="flex flex-col gap-2">
                            {selected.phase === "voting" ? (
                              <Button
                                disabled={busy}
                                className="w-full"
                                onClick={() => void runAction("close")}
                              >
                                截止投票
                              </Button>
                            ) : null}
                            {selected.phase === "closed" ? (
                              <>
                                <Button
                                  disabled={busy}
                                  variant="secondary"
                                  className="w-full"
                                  onClick={() => void runAction("tally")}
                                >
                                  執行開票
                                </Button>
                                {selectedCanReopen ? (
                                  <Button
                                    disabled={busy}
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => void runAction("reopen")}
                                  >
                                    恢復投票
                                  </Button>
                                ) : null}
                              </>
                            ) : null}
                            {selected.phase === "tallied" ? (
                              <Button asChild className="w-full">
                                <Link
                                  href={`/results?id=${encodeURIComponent(selected.electionId)}`}
                                >
                                  查看開票結果
                                </Link>
                              </Button>
                            ) : null}
                            {selected.phase === "mixing" ? (
                              <p className="text-sm text-[var(--muted-foreground)]">
                                開票進行中，請稍候…
                              </p>
                            ) : null}
                          </div>
                          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                            {selected.phase === "voting"
                              ? "現場或線上投票結束後，請先截止再執行開票。"
                              : selected.phase === "closed"
                                ? selectedCanReopen
                                  ? "確認無誤後執行開票；若需繼續投票可先恢復。"
                                  : "投票時段已過，請執行開票公布結果。"
                                : selected.phase === "tallied"
                                  ? "此場已完成開票，可前往結果頁查看。"
                                  : null}
                          </p>
                        </div>
                      </aside>
                    </div>

                    <Separator />
                    <div className="space-y-3">
                      <div className="text-sm font-medium">投票選項</div>
                      {(selected.candidates ?? []).map((c) => (
                        <div
                          key={c.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3"
                        >
                          <CandidateVisual
                            name={c.name}
                            party={c.party}
                            imageUrl={c.imageUrl}
                          />
                          {selected.stats.ballotCount === 0 &&
                          selected.phase === "voting" ? (
                            <Input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/gif"
                              className="max-w-56"
                              disabled={busy}
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                void onExistingImageChange(c.id, file);
                                event.target.value = "";
                              }}
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>

                    <Separator />
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-[var(--muted-foreground)]">
                        危險操作
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={busy}
                          variant="outline"
                          size="sm"
                          onClick={() => void onReset()}
                        >
                          重設此投票
                        </Button>
                        <Button
                          disabled={busy}
                          variant="destructive"
                          size="sm"
                          onClick={() => void onDelete()}
                        >
                          刪除
                        </Button>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        重設會清除選票與結果並回到投票中；刪除後無法復原。
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {detailTab === "audit" ? (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>檢查投票資料</CardTitle>
                      <CardDescription>
                        確認「{selected.title}」資料是否正確。
                      </CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => void runAudit()}>
                      重新檢查
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {!audit ? (
                      <p className="text-sm text-[var(--muted-foreground)]">
                        檢查中…
                      </p>
                    ) : (
                      <>
                        <Alert>
                          結果：{audit.passed ? "通過" : "未完全通過"}（
                          {phaseText(audit.phase)}）
                        </Alert>
                        {audit.checks.map((c) => (
                          <div key={c.name} className="text-sm">
                            <span className="font-medium">{c.name}</span>
                            <span className="ml-2 text-[var(--muted-foreground)]">
                              {c.passed ? "通過" : "未通過"} · {c.detail}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {detailTab === "voters" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>修改可投票名單</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form
                      className="space-y-3"
                      onSubmit={emailsForm.handleSubmit(onAddEmails)}
                    >
                      <div className="space-y-2">
                        <Label htmlFor="emails">新增 Email</Label>
                        <textarea
                          id="emails"
                          className="min-h-24 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                          placeholder={"alice@gmail.com\nbob@gmail.com"}
                          {...emailsForm.register("emails")}
                        />
                      </div>
                      <Button type="submit" disabled={busy}>
                        加入名單
                      </Button>
                    </form>
                    <Separator />
                    <div className="space-y-2">
                      {voters.length === 0 ? (
                        <p className="text-sm text-[var(--muted-foreground)]">
                          此場尚無名單
                        </p>
                      ) : (
                        voters.map((v) => (
                          <div
                            key={v.email}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                          >
                            <div>
                              <div className="font-medium">{v.email}</div>
                              <div className="text-xs text-[var(--muted-foreground)]">
                                {v.hasVoted ? "已投票" : "尚未投票"}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy || v.hasVoted}
                              onClick={() => void onRemoveEmail(v.email)}
                            >
                              移除
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {detailTab === "managers" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>共同管理者</CardTitle>
                    <CardDescription>
                      建立者：{selected.createdByEmail ?? "（未知）"}
                      。共同管理者可管理此場投票的選項、名單與開票。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="managerEmails">新增共同管理者 Email</Label>
                        <textarea
                          id="managerEmails"
                          className="min-h-24 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                          placeholder={"coadmin@gmail.com"}
                          value={managerEmailsDraft}
                          onChange={(event) =>
                            setManagerEmailsDraft(event.target.value)
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        disabled={busy || !managerEmailsDraft.trim()}
                        onClick={() => void onAddManagers()}
                      >
                        加入共同管理者
                      </Button>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      {managers.length === 0 ? (
                        <p className="text-sm text-[var(--muted-foreground)]">
                          尚無管理者資料
                        </p>
                      ) : (
                        managers.map((m) => (
                          <div
                            key={m.email}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                          >
                            <div>
                              <div className="font-medium">{m.email}</div>
                              <div className="text-xs text-[var(--muted-foreground)]">
                                {m.isCreator ? "建立者" : "共同管理者"}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy || m.isCreator}
                              onClick={() => void onRemoveManager(m.email)}
                            >
                              移除
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {projectionOpen && selected ? (
        <ElectionProjectionView
          election={{
            electionId: selected.electionId,
            title: selected.title,
            description: selected.description,
            phase: selected.phase,
            scheduleMode: selected.scheduleMode,
            votingEndsAt: selected.votingEndsAt,
            scheduleLabel: selected.scheduleLabel,
            candidates: selected.candidates ?? [],
            ballotCount: selected.stats.ballotCount,
          }}
          busy={busy}
          onClose={() => setProjectionOpen(false)}
          onCloseVoting={() => {
            void runAction("close");
          }}
          onTally={() => {
            void (async () => {
              const ok = await runAction("tally");
              if (!ok) {
                return;
              }
              setProjectionOpen(false);
              router.push(`/results?id=${encodeURIComponent(selected.electionId)}`);
            })();
          }}
          onViewResults={() => {
            setProjectionOpen(false);
            router.push(`/results?id=${encodeURIComponent(selected.electionId)}`);
          }}
        />
      ) : null}
    </div>
  );
}
