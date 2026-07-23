"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { buildVoteShareUrl } from "@/lib/election-share";

type CopyVoteLinkButtonProps = {
  electionId: string;
  size?: "default" | "sm";
  variant?: "default" | "outline" | "secondary" | "ghost";
  label?: string;
  className?: string;
};

function shareUrl(electionId: string): string {
  return buildVoteShareUrl(
    electionId,
    typeof window !== "undefined" ? window.location.origin : null,
  );
}

function copyHint(): string {
  if (typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.userAgent)) {
    return "按下 ⌘C 鍵即可複製";
  }
  return "按下 Ctrl+C 鍵即可複製";
}

export function CopyVoteLinkButton({
  electionId,
  size = "default",
  variant = "outline",
  label = "複製連結",
  className,
}: CopyVoteLinkButtonProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const url = open ? shareUrl(electionId) : "";

  useEffect(() => {
    if (!open) {
      return;
    }
    const id = window.setTimeout(() => {
      const input = inputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      input.select();
    }, 0);
    return () => {
      window.clearTimeout(id);
    };
  }, [open, electionId]);

  async function copyToClipboard() {
    const value = shareUrl(electionId);
    if (!navigator.clipboard?.writeText) {
      toast.error("此瀏覽器不支援複製到剪貼簿");
      return;
    }
    await navigator.clipboard.writeText(value);
    toast.success("已複製投票連結");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size={size} variant={variant} className={className}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>複製投票連結</DialogTitle>
        <DialogDescription className="mt-1">
          將此連結分享給其他可投票者。
        </DialogDescription>
        <div className="relative mt-4">
          <Input
            ref={inputRef}
            readOnly
            value={url}
            className="font-mono text-xs"
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
