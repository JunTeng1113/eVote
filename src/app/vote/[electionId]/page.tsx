import { Suspense } from "react";
import { VoteWizard } from "@/components/vote-wizard";
import { VoteCardSkeleton } from "@/components/loading-skeletons";

type VoteByIdPageProps = {
  params: Promise<{ electionId: string }>;
};

export default async function VoteByIdPage({ params }: VoteByIdPageProps) {
  const { electionId } = await params;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--primary)]">
          投票
        </h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          請登入後送出選票。每位有資格的帳號每場只能投一次。
        </p>
      </div>
      <Suspense fallback={<VoteCardSkeleton />}>
        <VoteWizard initialElectionId={electionId} />
      </Suspense>
    </div>
  );
}
