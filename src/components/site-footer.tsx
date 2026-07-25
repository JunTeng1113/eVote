"use client";

import { useEffect, useState } from "react";

const DEVICE_ID_KEY = "evote-online-device-id";
const HEARTBEAT_MS = 25_000;
const CHANNEL_NAME = "evote-online-presence";

function getOrCreateDeviceId(): string {
  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing && existing.length >= 8 && existing.length <= 64) {
    return existing;
  }
  const created = crypto.randomUUID().replaceAll("-", "");
  window.localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = window.setTimeout(() => resolve(), ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

async function postHeartbeat(deviceId: string): Promise<number | null> {
  const res = await fetch("/api/presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId }),
    keepalive: true,
  });
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as { ok?: boolean; onlineCount?: number };
  if (!data.ok || typeof data.onlineCount !== "number") {
    return null;
  }
  return data.onlineCount;
}

async function fetchOnlineCount(): Promise<number | null> {
  const res = await fetch("/api/presence");
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as { ok?: boolean; onlineCount?: number };
  if (!data.ok || typeof data.onlineCount !== "number") {
    return null;
  }
  return data.onlineCount;
}

/**
 * 同一瀏覽器多個分頁共用 localStorage 裝置 ID，只算 1 人。
 * 有 Web Locks 時由單一領導分頁送心跳，其餘分頁透過 BroadcastChannel 同步人數。
 */
export function SiteFooter() {
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  useEffect(() => {
    const deviceId = getOrCreateDeviceId();
    const abort = new AbortController();
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(CHANNEL_NAME)
        : null;

    channel?.addEventListener("message", (event: MessageEvent) => {
      const data = event.data as { onlineCount?: unknown };
      if (typeof data?.onlineCount === "number") {
        setOnlineCount(data.onlineCount);
      }
    });

    function publishCount(count: number) {
      setOnlineCount(count);
      channel?.postMessage({ onlineCount: count });
    }

    async function runLeaderLoop() {
      while (!abort.signal.aborted) {
        const count = await postHeartbeat(deviceId);
        if (count !== null) {
          publishCount(count);
        }
        await sleep(HEARTBEAT_MS, abort.signal);
      }
    }

    void fetchOnlineCount().then((count) => {
      if (count !== null) {
        setOnlineCount(count);
      }
    });

    const locks = navigator.locks;
    if (locks && typeof locks.request === "function") {
      void locks.request("evote-online-presence", () => runLeaderLoop());
    } else {
      void runLeaderLoop();
    }

    return () => {
      abort.abort();
      channel?.close();
    };
  }, []);

  return (
    <footer className="border-t border-[var(--border)]/70 py-6 text-center text-xs text-[var(--muted-foreground)]">
      eVote · 線上投票
      {onlineCount === null ? null : ` · 目前在線 ${onlineCount} 人`}
    </footer>
  );
}
