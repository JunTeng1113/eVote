import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[rgba(11,79,108,0.12)]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
