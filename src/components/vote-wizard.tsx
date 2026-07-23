"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState, startTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CandidateVisual } from "@/components/candidate-visual";
import { CopyVoteLinkButton } from "@/components/copy-vote-link-button";
import { VoteCardSkeleton } from "@/components/loading-skeletons";
import {
  ListPagination,
  LIST_PAGE_SIZE,
  slicePage,
} from "@/components/list-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { voteChoiceSchema } from "@/lib/schemas/voting";
import { buildVoteShareUrl } from "@/lib/election-share";

type ElectionPublic = {
  electionId: string;
  title: string;
  description: string;
  phase: string;
  votingMode: "anonymous" | "named" | "open";
  scheduleMode: "unlimited" | "timed" | "duration";
  votingStartsAt: string | null;
  votingEndsAt: string | null;
  scheduleLabel?: string;
  windowStatus?: "open" | "not_started" | "ended" | "closed";
  candidates: Array<{
    id: string;
    name: string;
    party: string;
    imageUrl: string | null;
  }>;
  crypto: {
    elgamalPk: string;
    issuerN: string;
    issuerE: string;
  };
};

type ElectionOption = {
  electionId: string;
  title: string;
  description: string;
  phase: string;
  scheduleMode: "unlimited" | "timed" | "duration";
  scheduleLabel?: string;
  windowStatus?: "open" | "not_started" | "ended" | "closed";
  eligible: boolean;
  hasVoted: boolean;
};

type MeStatus = {
  ok?: boolean;
  eligible?: boolean;
  hasVoted?: boolean;
  phase?: string;
  windowStatus?: "open" | "not_started" | "ended" | "closed";
  message?: string;
  email?: string;
  error?: string;
};

type ChoiceForm = z.infer<typeof voteChoiceSchema>;

function windowStatusText(status: string): string {
  switch (status) {
    case "open":
      return "投票中";
    case "not_started":
      return "尚未開始";
    case "ended":
      return "已結束";
    case "closed":
      return "已截止";
    default:
      return status;
  }
}

function isVotingClosed(params: {
  windowStatus?: string;
  phase?: string;
}): boolean {
  const { windowStatus, phase } = params;
  if (windowStatus === "closed" || windowStatus === "ended") {
    return true;
  }
  return phase === "closed" || phase === "mixing" || phase === "tallied";
}

function scheduleModeBadge(mode: string): string {
  if (mode === "timed") {
    return "計時投票";
  }
  if (mode === "duration") {
    return "限時投票";
  }
  return "無時間限制";
}

function hasScheduleWindow(mode: string): boolean {
  return mode === "timed" || mode === "duration";
}

function ViewResultsButton({
  electionId,
  phase,
  size = "default",
}: {
  electionId: string;
  phase?: string;
  size?: "default" | "sm";
}) {
  const tallied = phase === "tallied";
  if (tallied) {
    return (
      <Button asChild size={size}>
        <Link href={`/results?id=${encodeURIComponent(electionId)}`}>
          查看結果
        </Link>
      </Button>
    );
  }
  return (
    <Button type="button" size={size} disabled title="尚未開票">
      查看結果
    </Button>
  );
}

export function VoteWizard({
  initialElectionId,
}: {
  initialElectionId?: string;
}) {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const presetId = initialElectionId || searchParams.get("id");

  const [options, setOptions] = useState<ElectionOption[]>([]);
  const [listPage, setListPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [election, setElection] = useState<ElectionPublic | null>(null);
  const [me, setMe] = useState<MeStatus | null>(null);
  const [meLoading, setMeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [receiptHash, setReceiptHash] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  /** 無專屬連結時先顯示列表；選定後只顯示該場投票 */
  const [showList, setShowList] = useState(!presetId);
  /** 專屬連結：先載投票資訊，資格狀態可稍後補齊 */
  const [linkBootstrapping, setLinkBootstrapping] = useState(Boolean(presetId));

  const choiceForm = useForm<ChoiceForm>({
    resolver: zodResolver(voteChoiceSchema),
    defaultValues: { candidateId: "" },
  });

  const isOpenMode = election?.votingMode === "open";
  const pagedOptions = slicePage(options, listPage, LIST_PAGE_SIZE);

  useEffect(() => {
    if (!presetId) {
      setLinkBootstrapping(false);
      return;
    }
    let alive = true;
    void (async () => {
      setLinkBootstrapping(true);
      await selectElection(presetId, alive);
      if (alive) {
        setLinkBootstrapping(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }
    if (presetId) {
      return;
    }
    let alive = true;
    void (async () => {
      setListLoading(true);
      const res = await fetch("/api/eligibility");
      const data = (await res.json()) as {
        ok?: boolean;
        elections?: ElectionOption[];
      };
      if (!alive) {
        return;
      }
      setListLoading(false);
      if (!data.elections) {
        return;
      }
      // 一般列表只顯示自己有投票資格的場次（不含無須登入場次）
      const eligibleOptions = data.elections.filter((e) => e.eligible);
      startTransition(() => {
        setOptions(eligibleOptions);
        setListPage(1);
        setShowList(true);
      });
    })();
    return () => {
      alive = false;
    };
  }, [status, presetId]);

  // 專屬連結且需登入場次：登入完成後補載資格狀態
  useEffect(() => {
    if (!presetId || status !== "authenticated") {
      return;
    }
    if (!election || election.votingMode === "open") {
      return;
    }
    if (me) {
      return;
    }
    let alive = true;
    void (async () => {
      await selectElection(presetId, alive);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, presetId, election?.votingMode, me]);

  async function switchGoogleAccount() {
    const callbackUrl =
      typeof window !== "undefined"
        ? window.location.href
        : election
          ? buildVoteShareUrl(election.electionId)
          : "/vote";
    await signOut({ redirect: false });
    await signIn("google", { callbackUrl });
  }

  function backToList() {
    setShowList(true);
    setElection(null);
    setMe(null);
    setError(null);
    setDone(false);
    setReceiptHash(null);
    setProgress(null);
    choiceForm.reset({ candidateId: "" });
  }

  async function selectElection(electionId: string, alive = true) {
    setError(null);
    setDone(false);
    setReceiptHash(null);
    setProgress(null);
    choiceForm.reset({ candidateId: "" });
    setMeLoading(true);

    const electionRes = await fetch(
      `/api/election?id=${encodeURIComponent(electionId)}`,
    );
    const electionData = (await electionRes.json()) as ElectionPublic & {
      error?: string;
      ok?: boolean;
    };
    if (!alive) {
      return;
    }
    if (!electionRes.ok) {
      setError(electionData.error ?? "找不到此投票");
      setElection(null);
      setMe(null);
      setMeLoading(false);
      setLinkBootstrapping(false);
      return;
    }
    // 先顯示投票資訊，資格狀態稍後補齊
    setElection(electionData);
    setShowList(false);
    setLinkBootstrapping(false);

    if (electionData.votingMode === "open") {
      const guestRes = await fetch(
        `/api/ballot/guest?electionId=${encodeURIComponent(electionId)}`,
      );
      const guestData = (await guestRes.json()) as MeStatus & {
        ok?: boolean;
        error?: string;
      };
      if (!alive) {
        return;
      }
      setMeLoading(false);
      if (!guestRes.ok || guestData.ok === false) {
        setMe({
          eligible: false,
          hasVoted: false,
          message: guestData.error ?? "無法確認投票狀態",
        });
        return;
      }
      setMe({
        eligible: true,
        hasVoted: Boolean(guestData.hasVoted),
        phase: guestData.phase,
        windowStatus: guestData.windowStatus,
        message: guestData.message,
      });
      return;
    }

    if (status !== "authenticated") {
      setMe(null);
      setMeLoading(false);
      return;
    }

    const meRes = await fetch(
      `/api/eligibility?electionId=${encodeURIComponent(electionId)}`,
    );
    const meData = (await meRes.json()) as MeStatus;
    if (!alive) {
      return;
    }
    setMe(meData);
    setMeLoading(false);
  }

  async function onSubmitBallot(values: ChoiceForm) {
    if (!election) {
      setError("請先選擇一場投票");
      return;
    }
    const candidateIndex = election.candidates.findIndex(
      (c) => c.id === values.candidateId,
    );
    if (candidateIndex < 0) {
      setError("請選擇一個選項");
      return;
    }

    setBusy(true);
    setError(null);

    if (election.votingMode === "named") {
      setProgress("正在送出記名投票…");
      const submitRes = await fetch("/api/ballot/named", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          electionId: election.electionId,
          candidateId: values.candidateId,
        }),
      });
      const submitData = (await submitRes.json()) as {
        ok: boolean;
        error?: string;
        receiptHash?: string;
      };
      setBusy(false);
      setProgress(null);
      if (!submitData.ok || !submitData.receiptHash) {
        setError(submitData.error ?? "送出失敗，請稍後再試");
        return;
      }
      setReceiptHash(submitData.receiptHash);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("evote-receipt", submitData.receiptHash);
      }
      setDone(true);
      setMe((prev) =>
        prev ? { ...prev, hasVoted: true, message: "你已經完成投票" } : prev,
      );
      setOptions((prev) =>
        prev.map((item) =>
          item.electionId === election.electionId
            ? { ...item, hasVoted: true }
            : item,
        ),
      );
      return;
    }

    if (election.votingMode === "open") {
      setProgress("正在送出投票…");
      const submitRes = await fetch("/api/ballot/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          electionId: election.electionId,
          candidateId: values.candidateId,
        }),
      });
      const submitData = (await submitRes.json()) as {
        ok: boolean;
        error?: string;
        receiptHash?: string;
      };
      setBusy(false);
      setProgress(null);
      if (!submitData.ok || !submitData.receiptHash) {
        setError(submitData.error ?? "送出失敗，請稍後再試");
        return;
      }
      setReceiptHash(submitData.receiptHash);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("evote-receipt", submitData.receiptHash);
      }
      setDone(true);
      setMe((prev) =>
        prev ? { ...prev, hasVoted: true, message: "你已經完成投票" } : prev,
      );
      return;
    }

    setProgress("正在確認投票資格…");
    const authRes = await fetch("/api/eligibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ electionId: election.electionId }),
    });
    const authData = (await authRes.json()) as {
      ok: boolean;
      error?: string;
      authTicket?: string;
    };
    if (!authData.ok || !authData.authTicket) {
      setBusy(false);
      setProgress(null);
      setError(authData.error ?? "無法取得投票資格");
      return;
    }

    setProgress("正在準備你的選票…");
    const [
      {
        blindMessage,
        messageFromCredentialSeed,
        randomBlindingFactor,
        randomCredentialSeed,
        unblindSignature,
        verifyBlindSignature,
      },
      { encryptBallot },
      { createCredentialProof, proveBallotValidity },
    ] = await Promise.all([
      import("@/lib/crypto/blind-signature"),
      import("@/lib/crypto/elgamal"),
      import("@/lib/crypto/zk-proof"),
    ]);

    const seed = randomCredentialSeed();
    const messageHex = messageFromCredentialSeed(election.electionId, seed);
    const blinding = randomBlindingFactor(election.crypto.issuerN);
    const blindedMessage = blindMessage(
      messageHex,
      blinding,
      election.crypto.issuerN,
      election.crypto.issuerE,
    );

    const credRes = await fetch("/api/credential/blind-sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        electionId: election.electionId,
        authTicket: authData.authTicket,
        blindedMessage,
      }),
    });
    const credData = (await credRes.json()) as {
      ok: boolean;
      error?: string;
      blindedSignature?: string;
    };
    if (!credData.ok || !credData.blindedSignature) {
      setBusy(false);
      setProgress(null);
      setError(credData.error ?? "準備選票失敗，請稍後再試");
      return;
    }

    const signatureHex = unblindSignature(
      credData.blindedSignature,
      blinding,
      election.crypto.issuerN,
    );
    if (
      !verifyBlindSignature(
        messageHex,
        signatureHex,
        election.crypto.issuerN,
        election.crypto.issuerE,
      )
    ) {
      setBusy(false);
      setProgress(null);
      setError("選票準備失敗，請重新整理後再試");
      return;
    }

    setProgress("正在送出投票…");
    const { ciphertext, randomnessHex } = encryptBallot(
      election.crypto.elgamalPk,
      candidateIndex,
    );
    const ballotProof = proveBallotValidity(
      election.crypto.elgamalPk,
      ciphertext,
      candidateIndex,
      election.candidates.length,
      randomnessHex,
    );
    const credentialProof = createCredentialProof(
      election.electionId,
      messageHex,
      signatureHex,
      election.crypto.issuerN,
      election.crypto.issuerE,
    );
    if (!credentialProof) {
      setBusy(false);
      setProgress(null);
      setError("選票準備失敗，請重新整理後再試");
      return;
    }

    const submitRes = await fetch("/api/ballot/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        electionId: election.electionId,
        ciphertext,
        ballotProof,
        credentialProof,
      }),
    });
    const submitData = (await submitRes.json()) as {
      ok: boolean;
      error?: string;
      receiptHash?: string;
    };
    setBusy(false);
    setProgress(null);
    if (!submitData.ok || !submitData.receiptHash) {
      setError(submitData.error ?? "送出失敗，請稍後再試");
      return;
    }

    setReceiptHash(submitData.receiptHash);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("evote-receipt", submitData.receiptHash);
    }
    setDone(true);
    setMe((prev) =>
      prev ? { ...prev, hasVoted: true, message: "你已經完成投票" } : prev,
    );
    setOptions((prev) =>
      prev.map((item) =>
        item.electionId === election.electionId
          ? { ...item, hasVoted: true }
          : item,
      ),
    );
  }

  if (status === "loading" || (linkBootstrapping && !election)) {
    return <VoteCardSkeleton />;
  }

  if (!session?.user && !isOpenMode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>請先登入</CardTitle>
          <CardDescription>
            {presetId
              ? election
                ? `「${election.title}」需登入後投票。請使用有投票資格的 Google 帳號登入。`
                : "你正透過專屬投票連結進入。請使用有投票資格的 Google 帳號登入。"
              : "使用 Google 帳號登入後即可投票。只有主辦單位允許的帳號可以投票。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() =>
              void signIn("google", {
                callbackUrl:
                  typeof window !== "undefined"
                    ? window.location.href
                    : "/vote",
              })
            }
          >
            使用 Google 登入
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (done && receiptHash && election) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>投票成功</CardTitle>
          <CardDescription>
            「{election.title}」已完成。請保存確認碼。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="break-all font-mono text-xs">{receiptHash}</Alert>
          <p className="text-sm text-[var(--muted-foreground)]">
            {election.votingMode === "named"
              ? "此場為記名投票，開票後主辦單位與結果頁可對照你的選擇。"
              : election.votingMode === "open"
                ? "此場無須登入；系統以連線位址防止重複投票，確認碼不會顯示你投給誰。"
                : "為保護投票隱私，確認碼不會顯示你投給誰。"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/confirm">去確認投票</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/results?id=${election.electionId}`}>開票結果</Link>
            </Button>
            {!isOpenMode ? (
              <Button variant="ghost" onClick={backToList}>
                回到投票列表
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {showList ? (
        <Card>
          <CardHeader>
            <CardTitle>選擇投票</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {listLoading ? (
              <div className="space-y-2" aria-busy="true" aria-label="載入中">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : options.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                目前沒有你可以參與的投票。
              </p>
            ) : (
              <>
                {pagedOptions.map((item) => {
                const closed = isVotingClosed({
                  windowStatus: item.windowStatus,
                  phase: item.phase,
                });
                return (
                  <div
                    key={item.electionId}
                    className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{item.title}</div>
                      <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {hasScheduleWindow(item.scheduleMode) &&
                        item.scheduleLabel
                          ? `${item.scheduleLabel} · `
                          : ""}
                        {item.hasVoted
                          ? "你已投過這場"
                          : closed
                            ? "投票已截止"
                            : "你可以投票"}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Badge>
                        {closed
                          ? "已截止"
                          : windowStatusText(item.windowStatus ?? item.phase)}
                      </Badge>
                      {closed ? (
                        <ViewResultsButton
                          electionId={item.electionId}
                          phase={item.phase}
                          size="sm"
                        />
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void selectElection(item.electionId)}
                        >
                          查看投票
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
                <ListPagination
                  page={listPage}
                  totalItems={options.length}
                  onPageChange={setListPage}
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Alert className="border-red-300/50 bg-red-50 text-red-900">{error}</Alert>
      ) : null}

      {!showList && election && !me && meLoading ? (
        <Card>
          <CardHeader className="space-y-3">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-11 w-36 rounded-md" />
          </CardContent>
        </Card>
      ) : null}

      {!showList && election && me ? (
        <Card>
          <CardHeader>
            {!isOpenMode ? (
              <div className="mb-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={backToList}
                >
                  ← 返回列表
                </Button>
              </div>
            ) : null}
            <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 items-start">
              <CardTitle className="min-w-0 self-center">
                {election.title}
              </CardTitle>
              <div className="flex flex-wrap justify-end gap-2 self-center">
                <Badge>
                  {election.votingMode === "named"
                    ? "記名投票"
                    : election.votingMode === "open"
                      ? "無須登入"
                      : "不記名投票"}
                </Badge>
                <Badge>{scheduleModeBadge(election.scheduleMode)}</Badge>
              </div>
              <CardDescription className="min-w-0">
                {election.description || "（無說明）"}
                {hasScheduleWindow(election.scheduleMode) &&
                election.scheduleLabel ? (
                  <span className="mt-1 block text-xs">
                    投票時間：{election.scheduleLabel}
                  </span>
                ) : null}
              </CardDescription>
              <div className="justify-self-end self-end">
                <CopyVoteLinkButton
                  electionId={election.electionId}
                  variant="outline"
                  size="sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isOpenMode && !me.eligible ? (
              <Alert className="border-amber-300/60 bg-amber-50 text-amber-950">
                {me.message ?? "目前無法投票，請稍後再試。"}
              </Alert>
            ) : !me.eligible && !isOpenMode ? (
              <div className="space-y-3">
                <Alert className="border-amber-300/60 bg-amber-50 text-amber-950">
                  <p className="font-medium">你沒有權限投票這場</p>
                  <p className="mt-1 text-sm">
                    目前登入帳號{" "}
                    <span className="font-medium">
                      {session?.user?.email ?? "（未知）"}
                    </span>{" "}
                    不在可投票名單中。若你有其他可投票帳號，請切換帳號後再使用此連結。
                  </p>
                </Alert>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => void switchGoogleAccount()}>
                    使用其他帳號登入
                  </Button>
                  {isVotingClosed({
                    windowStatus: me.windowStatus,
                    phase: me.phase ?? election.phase,
                  }) ? (
                    <ViewResultsButton
                      electionId={election.electionId}
                      phase={me.phase ?? election.phase}
                    />
                  ) : null}
                </div>
              </div>
            ) : me.hasVoted ? (
              <div className="space-y-3">
                <Alert>你已經完成這場投票。</Alert>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <Link href="/confirm">確認投票</Link>
                  </Button>
                  {isVotingClosed({
                    windowStatus: me.windowStatus,
                    phase: me.phase ?? election.phase,
                  }) ? (
                    <ViewResultsButton
                      electionId={election.electionId}
                      phase={me.phase ?? election.phase}
                    />
                  ) : null}
                </div>
              </div>
            ) : isVotingClosed({
                windowStatus: me.windowStatus,
                phase: me.phase ?? election.phase,
              }) ? (
              <div className="space-y-3">
                <Alert>{me.message ?? "這場投票已截止。"}</Alert>
                <ViewResultsButton
                  electionId={election.electionId}
                  phase={me.phase ?? election.phase}
                />
              </div>
            ) : (me.windowStatus ?? "closed") !== "open" ? (
              <Alert>{me.message ?? "這場投票目前無法投票。"}</Alert>
            ) : (
              <form
                className="space-y-4"
                onSubmit={choiceForm.handleSubmit(onSubmitBallot)}
              >
                {progress ? <Alert>{progress}</Alert> : null}
                <div className="space-y-2">
                  <Label>投票選項</Label>
                  <div className="grid gap-2">
                    {election.candidates.map((c) => (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-3 hover:bg-[var(--muted)]"
                      >
                        <input
                          type="radio"
                          value={c.id}
                          {...choiceForm.register("candidateId")}
                        />
                        <CandidateVisual
                          name={c.name}
                          party={c.party}
                          imageUrl={c.imageUrl}
                        />
                      </label>
                    ))}
                  </div>
                  {choiceForm.formState.errors.candidateId ? (
                    <p className="text-sm text-red-600">
                      {choiceForm.formState.errors.candidateId.message}
                    </p>
                  ) : null}
                </div>
                <Button type="submit" disabled={busy} size="lg">
                  {busy
                    ? "處理中…"
                    : election.votingMode === "named"
                      ? "確認送出記名投票"
                      : "確認送出投票"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!showList && error && !election ? (
        <Button type="button" variant="outline" onClick={backToList}>
          ← 返回列表
        </Button>
      ) : null}
    </div>
  );
}
