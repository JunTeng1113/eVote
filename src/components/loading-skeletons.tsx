import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthControlsSkeleton() {
  return (
    <div className="flex items-center gap-2" aria-busy="true" aria-label="載入中">
      <Skeleton className="hidden h-4 w-20 sm:block" />
      <Skeleton className="hidden h-4 w-28 sm:block" />
      <Skeleton className="h-8 w-14 rounded-md" />
    </div>
  );
}

export function VoteCardSkeleton() {
  return (
    <Card aria-busy="true" aria-label="載入中">
      <CardHeader className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="mt-2 h-11 w-36 rounded-md" />
      </CardContent>
    </Card>
  );
}

export function ResultsPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="載入中">
      <div className="space-y-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Card>
        <CardHeader className="space-y-3">
          <Skeleton className="h-6 w-56" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Skeleton className="h-[220px] w-[220px] shrink-0 rounded-full" />
            <div className="w-full space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-11/12" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="載入中">
      <div className="space-y-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-28 rounded-md" />
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>
      <Card>
        <CardHeader className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}

export function LoginCardSkeleton() {
  return (
    <Card aria-busy="true" aria-label="載入中">
      <CardHeader className="space-y-3">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-40 rounded-md" />
      </CardContent>
    </Card>
  );
}
