"use client";

import { useEffect, useRef, useState } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildVoteShareMessage,
  buildVoteShareUrl,
} from "@/lib/election-share";

type CopyVoteLinkButtonProps = {
  electionId: string;
  title: string;
  votingEndsAt?: string | null;
  size?: "default" | "sm" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
  label?: string;
  className?: string;
  /** 僅顯示圖示，hover 以 Tooltip 提示 */
  iconOnly?: boolean;
};

function shareUrl(electionId: string): string {
  return buildVoteShareUrl(
    electionId,
    typeof window !== "undefined" ? window.location.origin : null,
  );
}

function shareMessage(
  electionId: string,
  title: string,
  votingEndsAt?: string | null,
): string {
  return buildVoteShareMessage({
    title,
    url: shareUrl(electionId),
    votingEndsAt,
  });
}

export function CopyVoteLinkButton({
  electionId,
  title,
  votingEndsAt = null,
  size = "default",
  variant = "outline",
  label = "複製連結",
  className,
  iconOnly = false,
}: CopyVoteLinkButtonProps) {
  const [open, setOpen] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const message = open ? shareMessage(electionId, title, votingEndsAt) : "";

  useEffect(() => {
    if (!open) {
      return;
    }
    const id = window.setTimeout(() => {
      const area = textRef.current;
      if (!area) {
        return;
      }
      area.focus();
      area.select();
    }, 0);
    return () => {
      window.clearTimeout(id);
    };
  }, [open, electionId, title, votingEndsAt]);

  async function copyToClipboard() {
    const value = shareMessage(electionId, title, votingEndsAt);
    if (!navigator.clipboard?.writeText) {
      toast.error("此瀏覽器不支援複製到剪貼簿");
      return;
    }
    await navigator.clipboard.writeText(value);
    toast.success("已複製投票訊息與連結");
  }

  const triggerButton = (
    <Button
      type="button"
      size={iconOnly ? "icon" : size}
      variant={variant}
      className={className}
      aria-label={label}
    >
      {iconOnly ? <Link2 className="h-4 w-4" aria-hidden /> : label}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {iconOnly ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>{triggerButton}</DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ) : (
        <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      )}
      <DialogContent>
        <DialogTitle>複製投票訊息</DialogTitle>
        <DialogDescription className="mt-1">
          將包含投票名稱、截止時間（若有）與連結的訊息分享給投票權人。
        </DialogDescription>
        <div className="relative mt-4">
          <textarea
            ref={textRef}
            readOnly
            value={message}
            rows={5}
            className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs leading-relaxed"
            onFocus={(event) => {
              event.currentTarget.select();
            }}
            onClick={(event) => {
              event.currentTarget.select();
            }}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            關閉
          </Button>
          <Button type="button" size="sm" onClick={() => void copyToClipboard()}>
            複製
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
