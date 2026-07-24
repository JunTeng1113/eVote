"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  readProjectionBgmPreference,
  startProjectionBgm,
  stopProjectionBgm,
} from "@/lib/projection-ambient-bgm";

/** 投影 BGM 開關；音訊生命週期由 ProjectionFullscreenRoot 釋放。 */
export function ProjectionBgmButton() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    const preferOn = readProjectionBgmPreference();
    setEnabled(preferOn);
    if (!preferOn) {
      return;
    }
    let cancelled = false;
    void startProjectionBgm().then((ok) => {
      if (cancelled) {
        return;
      }
      setEnabled(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    if (enabled) {
      stopProjectionBgm();
      setEnabled(false);
      return;
    }
    const ok = await startProjectionBgm();
    setEnabled(ok);
  }

  if (!ready) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="背景音樂"
        disabled
      >
        <VolumeX className="h-4 w-4" aria-hidden />
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={enabled ? "關閉背景音樂" : "開啟背景音樂"}
          aria-pressed={enabled}
          onClick={() => void toggle()}
        >
          {enabled ? (
            <Volume2 className="h-4 w-4" aria-hidden />
          ) : (
            <VolumeX className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {enabled ? "關閉背景音樂" : "開啟背景音樂"}
      </TooltipContent>
    </Tooltip>
  );
}
