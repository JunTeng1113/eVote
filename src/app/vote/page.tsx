import { Suspense } from "react";
import { VoteWizard } from "@/components/vote-wizard";
import { VoteCardSkeleton } from "@/components/loading-skeletons";

export default function VotePage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<VoteCardSkeleton />}>
        <VoteWizard />
      </Suspense>
    </div>
  );
}
