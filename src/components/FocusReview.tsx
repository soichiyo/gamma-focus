"use client";

import { useState } from "react";
import type { FocusSession, FocusSessionReview } from "@/types/focus-session";

type FocusReviewProps = {
  session: FocusSession;
  defaultOutcome?: FocusSessionReview["outcome"];
  onSubmit: (review: Omit<FocusSessionReview, "createdAt">) => void;
};

const RATINGS = [1, 2, 3, 4, 5] as const;
const OUTCOMES = [
  { value: "completed", label: "Done" },
  { value: "partial", label: "Partial" },
  { value: "abandoned", label: "Dropped" },
] as const;

export function FocusReview({ session, defaultOutcome = "completed", onSubmit }: FocusReviewProps) {
  const [focusRating, setFocusRating] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [outcome, setOutcome] = useState<"completed" | "partial" | "abandoned">(defaultOutcome);
  const [note, setNote] = useState("");

  return (
    <section className="flex flex-col gap-4 rounded-lg bg-zinc-950 p-4">
      <div>
        <p className="text-sm font-semibold text-white">Session review</p>
        <p className="mt-1 truncate text-xs text-zinc-500">{session.mission}</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.1em] text-zinc-500">
          Focus
        </span>
        <div className="grid grid-cols-5 gap-2">
          {RATINGS.map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => setFocusRating(rating)}
              className={`h-9 rounded-lg text-sm ${
                focusRating === rating
                  ? "bg-purple-500 text-white"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              {rating}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {OUTCOMES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setOutcome(option.value)}
            className={`h-9 rounded-lg text-xs ${
              outcome === option.value
                ? "bg-purple-500 text-white"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="What helped or pulled you away?"
        className="min-h-20 resize-none rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-purple-500"
      />

      <button
        type="button"
        onClick={() => onSubmit({ focusRating, outcome, note })}
        className="h-10 rounded-lg bg-purple-500 text-sm font-semibold text-white hover:bg-purple-400"
      >
        Save Review
      </button>
    </section>
  );
}
