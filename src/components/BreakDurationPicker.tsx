"use client";

import { Coffee } from "lucide-react";
import type { BreakDurationMinutes } from "@/types/focus-session";

type BreakDurationPickerProps = {
  onStartBreak: (durationMinutes: BreakDurationMinutes) => void;
  onCancel: () => void;
};

const BREAK_OPTIONS: BreakDurationMinutes[] = [3, 5, 10];

export function BreakDurationPicker({ onStartBreak, onCancel }: BreakDurationPickerProps) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-amber-300/40 bg-amber-300/10 p-4">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <Coffee className="h-4 w-4 text-amber-300" />
          Start a break
        </p>
        <p className="mt-1 text-xs text-zinc-400">Pick a short reset. Gamma will call you back.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {BREAK_OPTIONS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => onStartBreak(minutes)}
            className="h-10 rounded-lg bg-zinc-900 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            {minutes}m
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="h-9 rounded-lg bg-zinc-900 text-xs text-zinc-400 transition-colors hover:bg-zinc-800"
      >
        Stay in session
      </button>
    </section>
  );
}
