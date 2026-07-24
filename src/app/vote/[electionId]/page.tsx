import type { Metadata } from "next";
import { Suspense } from "react";
import { VoteWizard } from "@/components/vote-wizard";
import { VoteCardSkeleton } from "@/components/loading-skeletons";
import { getElection } from "@/lib/store/election-store";
import { votingModeLabel } from "@/lib/voting-mode";

type VoteByIdPageProps = {
  params: Promise<{ electionId: string }>;
};

export async function generateMetadata({
  params,
}: VoteByIdPageProps): Promise<Metadata> {
  const { electionId } = await params;
  const election = await getElection(electionId);
  if (!election) {
    return {
      title: "找不到投票｜eVote",
      description: "此投票連結無效或投票已刪除。",
    };
  }

  const title = `${election.title}｜eVote`;
  const description =
    election.description.trim() ||
    `${votingModeLabel(election.votingMode)} · 線上投票`;

  return {
    title,
    description,
    openGraph: {
      title: election.title,
      description,
      type: "website",
      siteName: "eVote",
    },
    twitter: {
      card: "summary",
      title: election.title,
      description,
    },
  };
}

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
