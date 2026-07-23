import { cn } from "@/lib/utils";

export function Alert({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="alert"
      className={cn(
        "relative w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm",
        className,
      )}
      {...props}
    />
  );
}
