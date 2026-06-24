"use client";

import { Battery, Coffee, Waves } from "lucide-react";
import type { CheckInResponse } from "@/types/focus-session";

type FocusCheckInProps = {
  onSubmit: (response: CheckInResponse) => void;
};

export function FocusCheckIn({ onSubmit }: FocusCheckInProps) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-purple-500/40 bg-purple-500/10 p-4">
      <div>
        <p className="text-sm font-semibold text-white">Focus check</p>
        <p className="mt-1 text-xs text-zinc-400">Mark where your attention is right now.</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onSubmit("focused")}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 text-xs text-white hover:bg-zinc-800"
        >
          <Battery className="h-4 w-4 text-emerald-400" />
          Focused
        </button>
        <button
          type="button"
          onClick={() => onSubmit("drifting")}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 text-xs text-white hover:bg-zinc-800"
        >
          <Waves className="h-4 w-4 text-purple-400" />
          Drifting
        </button>
        <button
          type="button"
          onClick={() => onSubmit("need-break")}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 text-xs text-white hover:bg-zinc-800"
        >
          <Coffee className="h-4 w-4 text-amber-300" />
          Break
        </button>
      </div>
    </section>
  );
}
