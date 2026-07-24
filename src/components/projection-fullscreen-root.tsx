"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { disposeProjectionBgm } from "@/lib/projection-ambient-bgm";

const PROJECTION_BACKGROUND =
  "radial-gradient(1200px 600px at 10% -10%, rgba(27, 122, 110, 0.16), transparent 55%), radial-gradient(900px 500px at 90% 0%, rgba(11, 79, 108, 0.14), transparent 50%), linear-gradient(180deg, #eef5f7 0%, #f7fafb 45%, #e8f1f3 100%)";

/**
 * 單一全螢幕根節點：子內容可替換（投票投影 → 結果投影）而不退出 Fullscreen API。
 */
export function ProjectionFullscreenRoot({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const intentionalExitRef = useRef(false);

  useEffect(() => {
    intentionalExitRef.current = false;
    const node = rootRef.current;
    if (node && typeof node.requestFullscreen === "function") {
      void node.requestFullscreen().then(
        () => undefined,
        () => undefined,
      );
    }

    function onFullscreenChange() {
      if (!document.fullscreenElement && !intentionalExitRef.current) {
        onCloseRef.current();
      }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      intentionalExitRef.current = true;
      disposeProjectionBgm();
      if (
        document.fullscreenElement === node &&
        typeof document.exitFullscreen === "function"
      ) {
        void document.exitFullscreen().then(
          () => undefined,
          () => undefined,
        );
      }
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[80] flex flex-col overflow-auto bg-[#f3f7f8] text-[#0f1c24]"
      style={{ background: PROJECTION_BACKGROUND }}
    >
      {children}
    </div>
  );
}
