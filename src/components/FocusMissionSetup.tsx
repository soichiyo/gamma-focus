"use client";

import { Play } from "lucide-react";
import type { FocusDuration } from "@/types/focus-session";

type FocusMissionSetupProps = {
  mission: string;
  duration: FocusDuration;
  canStart: boolean;
  onMissionChange: (mission: string) => void;
  onDurationChange: (duration: FocusDuration) => void;
  onStart: () => void;
};

const DURATIONS: Array<{ value: FocusDuration; label: string }> = [
  { value: 15, label: "15m" },
  { value: 25, label: "25m" },
  { value: 45, label: "45m" },
  { value: "open", label: "Flow" },
];

export function FocusMissionSetup({
  mission,
  duration,
  canStart,
  onMissionChange,
  onDurationChange,
  onStart,
}: FocusMissionSetupProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="focus-mission"
          className="font-[family-name:var(--font-geist-mono)] text-[11px] font-semibold tracking-[0.1em] text-zinc-400"
        >
          TODAY&apos;S MISSION
        </label>
        <input
          id="focus-mission"
          value={mission}
          onChange={(event) => onMissionChange(event.target.value)}
          placeholder="What are you focusing on?"
          className="h-11 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-purple-500"
        />
      </div>

      <div className="grid grid-cols-4 gap-2">
        {DURATIONS.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onDurationChange(option.value)}
            className={`h-9 rounded-lg text-xs font-medium transition-colors ${
              duration === option.value
                ? "bg-purple-500 text-white"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={!canStart}
        className="flex h-11 items-center justify-center gap-2 rounded-lg bg-purple-500 text-sm font-semibold text-white transition-colors hover:bg-purple-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        <Play className="h-4 w-4 fill-current" />
        Start Focus Session
      </button>
    </section>
  );
}
