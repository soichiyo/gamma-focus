"use client";

import { Bell, BellOff, Coffee, RotateCcw } from "lucide-react";
import type { FocusSession } from "@/types/focus-session";

type BreakTimerProps = {
  session: FocusSession;
  remainingSeconds: number | null;
  notificationPermission: NotificationPermission | "unsupported";
  onRequestNotifications: () => void;
  onReturnToFocus: () => void;
};

export function BreakTimer({
  session,
  remainingSeconds,
  notificationPermission,
  onRequestNotifications,
  onReturnToFocus,
}: BreakTimerProps) {
  const isEnded = session.breakState.status === "ended";
  const label = isEnded ? "Break ended" : "On break";

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-amber-300/40 bg-amber-300/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <Coffee className="h-4 w-4 text-amber-300" />
            {label}
          </p>
          <p className="mt-1 truncate text-xs text-zinc-400">{session.mission}</p>
        </div>
        <div className="font-[family-name:var(--font-geist-mono)] text-2xl font-semibold text-white">
          {isEnded ? "00:00" : formatSeconds(remainingSeconds ?? 0)}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {notificationPermission === "default" && (
          <button
            type="button"
            onClick={onRequestNotifications}
            className="flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-900 text-xs text-white hover:bg-zinc-800"
          >
            <Bell className="h-4 w-4 text-purple-400" />
            Enable break notification
          </button>
        )}
        {notificationPermission === "denied" && (
          <p className="flex items-center gap-2 text-xs text-zinc-500">
            <BellOff className="h-4 w-4" />
            Browser notifications are blocked. Gamma will still update this view.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onReturnToFocus}
        className="flex h-11 items-center justify-center gap-2 rounded-lg bg-purple-500 text-sm font-semibold text-white transition-colors hover:bg-purple-400"
      >
        <RotateCcw className="h-4 w-4" />
        Return to Focus
      </button>
    </section>
  );
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
