import { cn } from "@/lib/utils";

type CandidateVisualProps = {
  name: string;
  party: string;
  imageUrl?: string | null;
  className?: string;
  imageClassName?: string;
};

export function CandidateVisual({
  name,
  party,
  imageUrl,
  className,
  imageClassName,
}: CandidateVisualProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name}
          className={cn(
            "h-14 w-14 rounded-lg object-cover border border-[var(--border)] bg-[var(--muted)]",
            imageClassName,
          )}
        />
      ) : (
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--muted)] text-sm font-semibold text-[var(--muted-foreground)]",
            imageClassName,
          )}
        >
          {name.slice(0, 1)}
        </div>
      )}
      <span>
        <span className="font-medium">{name}</span>
        {party.trim() && party.trim() !== "無黨籍" ? (
          <span className="ml-2 text-sm text-[var(--muted-foreground)]">
            {party}
          </span>
        ) : null}
      </span>
    </div>
  );
}
