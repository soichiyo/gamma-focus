"use client";

import type { FocusSession } from "@/types/focus-session";

type SessionHistoryProps = {
  sessions: FocusSession[];
};

export function SessionHistory({ sessions }: SessionHistoryProps) {
  if (sessions.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <span className="font-[family-name:var(--font-geist-mono)] text-[11px] font-semibold tracking-[0.1em] text-zinc-400">
        RECENT SESSIONS
      </span>
      <div className="flex flex-col gap-2">
        {sessions.slice(0, 5).map((session) => (
          <article key={session.id} className="rounded-lg bg-zinc-900 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-xs font-medium text-white">{session.mission}</p>
              {session.review && (
                <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-purple-400">
                  {session.review.focusRating}/5
                </span>
              )}
            </div>
            <p className="mt-1 font-[family-name:var(--font-geist-mono)] text-[10px] text-zinc-600">
              {formatDate(session.completedAt ?? session.review?.createdAt ?? session.startedAt)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "No date";

  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
