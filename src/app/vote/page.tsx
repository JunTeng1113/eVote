import { Suspense } from "react";
import { VoteWizard } from "@/components/vote-wizard";
import { VoteCardSkeleton } from "@/components/loading-skeletons";

export default function VotePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--primary)]">
          投票
        </h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          選擇一場投票後，挑選選項即可送出。每位有資格的帳號每場只能投一次。
        </p>
      </div>
      <Suspense fallback={<VoteCardSkeleton />}>
        <VoteWizard />
      </Suspense>
    </div>
  );
}
