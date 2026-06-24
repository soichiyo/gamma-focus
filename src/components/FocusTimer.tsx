"use client";

import { Check, Pause, Play, X } from "lucide-react";
import type { FocusSession } from "@/types/focus-session";

type FocusTimerProps = {
  session: FocusSession;
  elapsedSeconds: number;
  targetSeconds: number | null;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onStop: () => void;
};

export function FocusTimer({
  session,
  elapsedSeconds,
  targetSeconds,
  onPause,
  onResume,
  onComplete,
  onStop,
}: FocusTimerProps) {
  const progress = targetSeconds
    ? Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100))
    : null;

  return (
    <section className="flex flex-col gap-4 rounded-lg bg-zinc-950 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{session.mission}</p>
          <p className="mt-1 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.1em] text-zinc-500">
            {session.status === "paused" ? "Paused" : "In focus"}
          </p>
        </div>
        <div className="font-[family-name:var(--font-geist-mono)] text-2xl font-semibold text-white">
          {formatSeconds(elapsedSeconds)}
        </div>
      </div>

      {progress !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-purple-500 transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {session.status === "paused" ? (
          <button
            type="button"
            onClick={onResume}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 text-sm text-white hover:bg-zinc-800"
          >
            <Play className="h-4 w-4 fill-current" />
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={onPause}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 text-sm text-white hover:bg-zinc-800"
          >
            <Pause className="h-4 w-4" />
            Pause
          </button>
        )}
        <button
          type="button"
          onClick={onComplete}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-purple-500 text-sm font-semibold text-white hover:bg-purple-400"
        >
          <Check className="h-4 w-4" />
          Review
        </button>
        <button
          type="button"
          onClick={onStop}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 text-sm text-zinc-400 hover:bg-zinc-800"
        >
          <X className="h-4 w-4" />
          Stop
        </button>
      </div>
    </section>
  );
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
