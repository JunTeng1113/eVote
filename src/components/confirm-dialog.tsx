"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PendingConfirm = ConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

function fullscreenContainer(): HTMLElement | undefined {
  const node = document.fullscreenElement;
  if (node instanceof HTMLElement) {
    return node;
  }
  return undefined;
}

/** 以 Dialog 取代 window.confirm，全螢幕時掛到 fullscreen 元素內以免退出。 */
export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);
  pendingRef.current = pending;

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      setPending({ ...options, resolve });
    });
  }

  function settle(confirmed: boolean) {
    const current = pendingRef.current;
    if (!current) {
      return;
    }
    pendingRef.current = null;
    setPending(null);
    current.resolve(confirmed);
  }

  const dialog = (
    <ConfirmDialogView
      pending={pending}
      onCancel={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  );

  return { confirm, dialog };
}

function ConfirmDialogView({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: PendingConfirm | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [container, setContainer] = useState<HTMLElement | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!pending) {
      setContainer(undefined);
      return;
    }
    setContainer(fullscreenContainer());
  }, [pending]);

  return (
    <Dialog
      open={Boolean(pending)}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <DialogContent
        container={container}
        className="z-[100]"
        overlayClassName="z-[99]"
      >
        <DialogTitle>{pending?.title ?? "確認"}</DialogTitle>
        <DialogDescription className="mt-2">
          {pending?.description ?? ""}
        </DialogDescription>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {pending?.cancelLabel ?? "取消"}
          </Button>
          <Button
            type="button"
            variant={pending?.destructive ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {pending?.confirmLabel ?? "確定"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
