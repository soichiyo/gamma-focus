# Focus Session OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Gamma Focus into a local-first Focus Session OS with a mission-based flow timer, lightweight check-ins, session review, local history, and gentle adaptive audio interventions.

**Architecture:** Keep the existing audio engine intact and add a separate focus-session domain. Use pure state/storage utilities for session behavior, a React hook for runtime orchestration, and small client components for setup, timer, check-in, review, and history. Gamma Focus remains a single-page local app.

**Tech Stack:** Next.js 16.2.2, React 19.2.4, TypeScript, Tailwind CSS 4, Web Audio API, localStorage, optional Vitest for pure logic tests.

---

## Review Revisions (2026-06-24, post-Codex)

This plan was revised after an independent design + code review. Implementers must follow the revised tasks below, not any earlier draft:

- **Intervention must be computed outside the `setState` updater** (Task 4). A React `useState` updater is not invoked synchronously at dispatch time, so returning a value mutated inside it is unreliable (often always `"none"`) — which would make the audio coach effectively never fire. `submitCheckIn` now derives the intervention from committed `state.coachSettings` before calling `setState` and returns it deterministically.
- **Persisted running sessions must not replay closed-app time** (Tasks 2 & 4). `getElapsedSeconds` grows from `startedAt`, so a reload hours later would show a multi-hour phantom session. The hook now checkpoints elapsed into persisted state on an interval, and `restoreActiveSession` pauses a stale running session on load (freezing elapsed at the last checkpoint).
- **Storage must type-check under `strict: true`** (Task 3). `filter(Boolean)` does not narrow `(FocusSession | null)[]`, and `String(status).includes(...)` does not narrow `status`. Both now use explicit type guards.
- **Stop saves a review, not a silent discard** (Tasks 4, 6, 7, 9). Per the spec ("Save a compact review after completion or intentional stop"), Stop moves to review with a default `abandoned` outcome instead of dropping the session. Complete moves to review with a default `completed` outcome.
- **Check-in visibility clears when there is no active session** (Task 4, minor).

---

## Preflight Gates

- [ ] **Step 1: Confirm repository and worktree**

Run:

```bash
pwd
git status --short --branch
```

Expected:

```text
/Users/soichiyo/Develop/atelier/gamma-focus
## main...origin/main
```

If there are unexpected dirty files, stop and ask the user before editing those files.

- [ ] **Step 2: Install dependencies if `node_modules` is missing**

Run:

```bash
test -d node_modules && echo "node_modules present" || npm install
```

Expected:

```text
node_modules present
```

or a successful `npm install`.

- [ ] **Step 3: Read the Next.js 16 local docs before editing code**

Run:

```bash
find node_modules/next/dist/docs -maxdepth 2 -type f | sed -n '1,120p'
```

Then read the relevant docs for App Router, client components, routing, and metadata before touching `src/app/*`.

If `node_modules/next/dist/docs` is absent after install, record that in the implementation notes and proceed by following the patterns already present in this repository.

- [ ] **Step 4: Baseline build**

Run:

```bash
npm run build
```

Expected: build succeeds before feature work begins. If it fails, fix or report the baseline failure before implementing this plan.

---

## File Structure

Create:

- `src/types/focus-session.ts`: session, review, check-in, and external signal types.
- `src/session/focus-session.ts`: pure session constructors, reducers, elapsed-time helpers, history cap, and check-in intervention selection.
- `src/session/storage.ts`: versioned localStorage load/save for session state.
- `src/hooks/useFocusSession.ts`: React orchestration for session state, ticking elapsed time, persistence, and coach prompts.
- `src/components/FocusMissionSetup.tsx`: mission input, duration selector, and start action.
- `src/components/FocusTimer.tsx`: elapsed timer, target progress, pause/resume, complete, and stop actions.
- `src/components/FocusCheckIn.tsx`: focused/drifting/need-break check-in controls.
- `src/components/FocusReview.tsx`: session review form.
- `src/components/SessionHistory.tsx`: compact recent session list.
- Optional test files under `src/session/*.test.ts` if Vitest is added.

Modify:

- `src/app/page.tsx`: compose the session UI with the existing audio controls.
- `src/hooks/useAudioEngine.ts`: expose small helpers needed by interventions if required.
- `src/audio/audio-engine.ts`: add only minimal methods if the existing hook cannot support a soft audio reset.
- `src/components/Player.tsx`: adjust copy and controls if page-level session controls make the big play button redundant.
- `src/components/AmbientMixer.tsx`: keep existing behavior; only adjust layout if needed.
- `src/components/MasterVolume.tsx`: keep existing behavior.
- `package.json`: add test scripts only if a test runner is installed.

Do not modify:

- `public/sounds/*` unless the user explicitly asks for new audio assets.
- `next.config.ts` unless Next.js docs require it.
- `README.md` until after implementation is verified.

---

## Task 1: Add Focus Session Types

**Files:**

- Create: `src/types/focus-session.ts`

- [ ] **Step 1: Create the type file**

Add:

```ts
export type SessionStatus = "idle" | "running" | "paused" | "reviewing";

export type FocusDuration = 15 | 25 | 45 | "open";

export type CheckInResponse = "focused" | "drifting" | "need-break";

export type AudioInterventionId =
  | "none"
  | "increase-white-noise"
  | "soft-reset"
  | "pause-for-break";

export type FocusCheckIn = {
  id: string;
  createdAt: string;
  elapsedSeconds: number;
  response: CheckInResponse;
  interventionId: AudioInterventionId;
};

export type FocusSessionReview = {
  focusRating: 1 | 2 | 3 | 4 | 5;
  outcome: "completed" | "partial" | "abandoned";
  note: string;
  createdAt: string;
};

export type FocusSession = {
  id: string;
  mission: string;
  duration: FocusDuration;
  status: SessionStatus;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  elapsedBeforePauseSeconds: number;
  checkIns: FocusCheckIn[];
  review: FocusSessionReview | null;
};

export type CoachSettings = {
  checkInIntervalMinutes: 10 | 15 | 20;
  enableAudioInterventions: boolean;
};

export type PersistedSessionState = {
  version: 1;
  activeSession: FocusSession | null;
  history: FocusSession[];
  coachSettings: CoachSettings;
};

export type ExternalFocusSignal =
  | {
      type: "meeting_started";
      source: "manual" | "extension" | "log-my-pc";
      createdAt: string;
    }
  | {
      type: "distraction_detected";
      source: "log-my-pc";
      createdAt: string;
      label?: string;
    }
  | {
      type: "focus_recovered";
      source: "log-my-pc";
      createdAt: string;
    };
```

- [ ] **Step 2: Type-check**

Run:

```bash
npm run build
```

Expected: build passes with the new unused type file.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/types/focus-session.ts
git commit -m "feat: 集中セッションの型を追加"
```

---

## Task 2: Add Pure Session Logic

**Files:**

- Create: `src/session/focus-session.ts`

- [ ] **Step 1: Add session helper implementation**

Add:

```ts
import type {
  AudioInterventionId,
  CheckInResponse,
  CoachSettings,
  FocusCheckIn,
  FocusDuration,
  FocusSession,
  FocusSessionReview,
  PersistedSessionState,
} from "@/types/focus-session";

export const SESSION_HISTORY_LIMIT = 20;

export const DEFAULT_COACH_SETTINGS: CoachSettings = {
  checkInIntervalMinutes: 15,
  enableAudioInterventions: true,
};

export const DEFAULT_SESSION_STATE: PersistedSessionState = {
  version: 1,
  activeSession: null,
  history: [],
  coachSettings: DEFAULT_COACH_SETTINGS,
};

export function createFocusSession(
  mission: string,
  duration: FocusDuration,
  now = new Date(),
): FocusSession {
  return {
    id: createId(now),
    mission: mission.trim(),
    duration,
    status: "running",
    startedAt: now.toISOString(),
    pausedAt: null,
    completedAt: null,
    elapsedBeforePauseSeconds: 0,
    checkIns: [],
    review: null,
  };
}

export function canStartSession(mission: string): boolean {
  return mission.trim().length > 0;
}

export function pauseSession(session: FocusSession, now = new Date()): FocusSession {
  if (session.status !== "running") return session;

  return {
    ...session,
    status: "paused",
    pausedAt: now.toISOString(),
    elapsedBeforePauseSeconds: getElapsedSeconds(session, now),
  };
}

export function resumeSession(session: FocusSession, now = new Date()): FocusSession {
  if (session.status !== "paused") return session;

  return {
    ...session,
    status: "running",
    pausedAt: null,
    startedAt: now.toISOString(),
  };
}

export function moveToReview(session: FocusSession, now = new Date()): FocusSession {
  if (session.status === "reviewing") return session;

  return {
    ...session,
    status: "reviewing",
    completedAt: now.toISOString(),
    elapsedBeforePauseSeconds: getElapsedSeconds(session, now),
    pausedAt: null,
  };
}

export function attachReview(
  session: FocusSession,
  review: Omit<FocusSessionReview, "createdAt">,
  now = new Date(),
): FocusSession {
  return {
    ...session,
    status: "idle",
    review: {
      ...review,
      createdAt: now.toISOString(),
    },
  };
}

export function addCheckIn(
  session: FocusSession,
  response: CheckInResponse,
  interventionId: AudioInterventionId,
  now = new Date(),
): FocusSession {
  const checkIn: FocusCheckIn = {
    id: createId(now),
    createdAt: now.toISOString(),
    elapsedSeconds: getElapsedSeconds(session, now),
    response,
    interventionId,
  };

  return {
    ...session,
    checkIns: [...session.checkIns, checkIn],
  };
}

export function chooseIntervention(
  response: CheckInResponse,
  settings: CoachSettings,
): AudioInterventionId {
  if (!settings.enableAudioInterventions) return "none";
  if (response === "focused") return "none";
  if (response === "need-break") return "pause-for-break";
  return "increase-white-noise";
}

export function getElapsedSeconds(session: FocusSession, now = new Date()): number {
  if (!session.startedAt) return session.elapsedBeforePauseSeconds;
  if (session.status === "paused" || session.status === "reviewing") {
    return session.elapsedBeforePauseSeconds;
  }

  const startedAt = new Date(session.startedAt).getTime();
  const deltaSeconds = Math.max(0, Math.floor((now.getTime() - startedAt) / 1000));
  return session.elapsedBeforePauseSeconds + deltaSeconds;
}

export function getTargetSeconds(duration: FocusDuration): number | null {
  return duration === "open" ? null : duration * 60;
}

export function isCheckInDue(
  session: FocusSession,
  settings: CoachSettings,
  now = new Date(),
): boolean {
  if (session.status !== "running") return false;

  const intervalSeconds = settings.checkInIntervalMinutes * 60;
  const elapsedSeconds = getElapsedSeconds(session, now);
  const latestCheckIn = session.checkIns.at(-1);

  if (!latestCheckIn) return elapsedSeconds >= intervalSeconds;

  return elapsedSeconds - latestCheckIn.elapsedSeconds >= intervalSeconds;
}

export function addSessionToHistory(
  history: FocusSession[],
  session: FocusSession,
): FocusSession[] {
  return [session, ...history].slice(0, SESSION_HISTORY_LIMIT);
}

export const CHECKPOINT_INTERVAL_SECONDS = 10;
export const STALE_RUNNING_THRESHOLD_SECONDS = 15;

// Fold accumulated elapsed time into persisted state and re-anchor startedAt to
// now. Persisting this on an interval means a reload never replays wall-clock
// time that passed while the app was closed.
export function checkpointElapsed(session: FocusSession, now = new Date()): FocusSession {
  if (session.status !== "running" || !session.startedAt) return session;

  return {
    ...session,
    elapsedBeforePauseSeconds: getElapsedSeconds(session, now),
    startedAt: now.toISOString(),
  };
}

// On load, a "running" session whose last checkpoint is older than the
// checkpoint interval means the app was closed mid-session. The wall clock can
// no longer be trusted, so freeze elapsed at the last checkpoint and require an
// explicit resume.
export function restoreActiveSession(
  session: FocusSession | null,
  now = new Date(),
): FocusSession | null {
  if (!session || session.status !== "running" || !session.startedAt) return session;

  const gapSeconds = Math.floor((now.getTime() - new Date(session.startedAt).getTime()) / 1000);
  if (gapSeconds <= STALE_RUNNING_THRESHOLD_SECONDS) return session;

  return {
    ...session,
    status: "paused",
    pausedAt: now.toISOString(),
  };
}

function createId(now: Date): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${now.getTime()}-${random}`;
}
```

- [ ] **Step 2: Type-check**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/session/focus-session.ts
git commit -m "feat: 集中セッションの状態遷移を追加"
```

---

## Task 3: Add Session Storage

**Files:**

- Create: `src/session/storage.ts`

- [ ] **Step 1: Add storage functions**

Add:

```ts
import {
  DEFAULT_SESSION_STATE,
  SESSION_HISTORY_LIMIT,
} from "@/session/focus-session";
import type { FocusSession, PersistedSessionState } from "@/types/focus-session";

export const SESSION_STORAGE_KEY = "gamma-focus-session-state";

export function loadSessionState(): PersistedSessionState {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return cloneDefaultState();

    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) return cloneDefaultState();

    const rawHistory: unknown[] = Array.isArray(parsed.history) ? parsed.history : [];
    const history = rawHistory
      .map(sanitizeSession)
      .filter((session): session is FocusSession => session !== null)
      .slice(0, SESSION_HISTORY_LIMIT);

    return {
      version: 1,
      activeSession: sanitizeSession(parsed.activeSession),
      history,
      coachSettings: {
        checkInIntervalMinutes: isSupportedInterval(parsed.coachSettings?.checkInIntervalMinutes)
          ? parsed.coachSettings.checkInIntervalMinutes
          : DEFAULT_SESSION_STATE.coachSettings.checkInIntervalMinutes,
        enableAudioInterventions:
          typeof parsed.coachSettings?.enableAudioInterventions === "boolean"
            ? parsed.coachSettings.enableAudioInterventions
            : DEFAULT_SESSION_STATE.coachSettings.enableAudioInterventions,
      },
    };
  } catch {
    return cloneDefaultState();
  }
}

export function saveSessionState(state: PersistedSessionState): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable
  }
}

function cloneDefaultState(): PersistedSessionState {
  return {
    version: 1,
    activeSession: null,
    history: [],
    coachSettings: { ...DEFAULT_SESSION_STATE.coachSettings },
  };
}

function sanitizeSession(value: unknown): FocusSession | null {
  if (!value || typeof value !== "object") return null;
  const session = value as Partial<FocusSession>;
  const status = session.status;

  if (
    typeof session.id !== "string" ||
    typeof session.mission !== "string" ||
    (status !== "idle" && status !== "running" && status !== "paused" && status !== "reviewing")
  ) {
    return null;
  }

  return {
    id: session.id,
    mission: session.mission,
    duration: session.duration === 15 || session.duration === 25 || session.duration === 45
      ? session.duration
      : "open",
    status,
    startedAt: typeof session.startedAt === "string" ? session.startedAt : null,
    pausedAt: typeof session.pausedAt === "string" ? session.pausedAt : null,
    completedAt: typeof session.completedAt === "string" ? session.completedAt : null,
    elapsedBeforePauseSeconds:
      typeof session.elapsedBeforePauseSeconds === "number"
        ? Math.max(0, session.elapsedBeforePauseSeconds)
        : 0,
    checkIns: Array.isArray(session.checkIns) ? session.checkIns : [],
    review: session.review ?? null,
  };
}

function isSupportedInterval(value: unknown): value is 10 | 15 | 20 {
  return value === 10 || value === 15 || value === 20;
}
```

- [ ] **Step 2: Type-check**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/session/storage.ts
git commit -m "feat: 集中セッションをローカル保存"
```

---

## Task 4: Add Session Hook

**Files:**

- Create: `src/hooks/useFocusSession.ts`

- [ ] **Step 1: Add hook implementation**

Add:

```ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addCheckIn,
  addSessionToHistory,
  attachReview,
  canStartSession,
  CHECKPOINT_INTERVAL_SECONDS,
  checkpointElapsed,
  chooseIntervention,
  createFocusSession,
  getElapsedSeconds,
  getTargetSeconds,
  isCheckInDue,
  moveToReview,
  pauseSession,
  restoreActiveSession,
  resumeSession,
} from "@/session/focus-session";
import { loadSessionState, saveSessionState } from "@/session/storage";
import type {
  AudioInterventionId,
  CheckInResponse,
  FocusDuration,
  FocusSessionReview,
  PersistedSessionState,
} from "@/types/focus-session";

type ReviewDefaultOutcome = FocusSessionReview["outcome"];

export function useFocusSession() {
  const [state, setState] = useState<PersistedSessionState | null>(null);
  const [missionDraft, setMissionDraft] = useState("");
  const [durationDraft, setDurationDraft] = useState<FocusDuration>(25);
  const [now, setNow] = useState(() => new Date());
  const [isCheckInVisible, setIsCheckInVisible] = useState(false);
  const [reviewDefaultOutcome, setReviewDefaultOutcome] =
    useState<ReviewDefaultOutcome>("completed");

  useEffect(() => {
    const loaded = loadSessionState();
    const restored: PersistedSessionState = {
      ...loaded,
      activeSession: restoreActiveSession(loaded.activeSession),
    };
    setState(restored);
    setMissionDraft(restored.activeSession?.mission ?? "");
    setDurationDraft(restored.activeSession?.duration ?? 25);
  }, []);

  useEffect(() => {
    if (state) saveSessionState(state);
  }, [state]);

  // Display tick: drives the visible timer without persisting every second.
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  // Checkpoint tick: fold accumulated elapsed into persisted state so a reload
  // never replays wall-clock time spent with the app closed.
  useEffect(() => {
    const interval = window.setInterval(() => {
      setState((prev) => {
        if (!prev?.activeSession || prev.activeSession.status !== "running") return prev;
        return { ...prev, activeSession: checkpointElapsed(prev.activeSession) };
      });
    }, CHECKPOINT_INTERVAL_SECONDS * 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!state?.activeSession) {
      setIsCheckInVisible(false);
      return;
    }

    setIsCheckInVisible(isCheckInDue(state.activeSession, state.coachSettings, now));
  }, [now, state]);

  const activeSession = state?.activeSession ?? null;
  const elapsedSeconds = activeSession ? getElapsedSeconds(activeSession, now) : 0;
  const targetSeconds = activeSession ? getTargetSeconds(activeSession.duration) : null;

  const canStart = useMemo(() => canStartSession(missionDraft), [missionDraft]);

  const startSession = useCallback(() => {
    if (!canStart) return;

    const session = createFocusSession(missionDraft, durationDraft);
    setState((prev) => ({
      ...(prev ?? loadSessionState()),
      activeSession: session,
    }));
    setIsCheckInVisible(false);
  }, [canStart, durationDraft, missionDraft]);

  const pauseActiveSession = useCallback(() => {
    setState((prev) => {
      if (!prev?.activeSession) return prev;
      return { ...prev, activeSession: pauseSession(prev.activeSession) };
    });
  }, []);

  const resumeActiveSession = useCallback(() => {
    setState((prev) => {
      if (!prev?.activeSession) return prev;
      return { ...prev, activeSession: resumeSession(prev.activeSession) };
    });
  }, []);

  const completeActiveSession = useCallback(() => {
    setReviewDefaultOutcome("completed");
    setState((prev) => {
      if (!prev?.activeSession) return prev;
      return { ...prev, activeSession: moveToReview(prev.activeSession) };
    });
    setIsCheckInVisible(false);
  }, []);

  // Stop is an intentional end, not a silent discard: move to review so the
  // session is still captured, defaulting the outcome to "abandoned".
  const stopActiveSession = useCallback(() => {
    setReviewDefaultOutcome("abandoned");
    setState((prev) => {
      if (!prev?.activeSession) return prev;
      return { ...prev, activeSession: moveToReview(prev.activeSession) };
    });
    setIsCheckInVisible(false);
  }, []);

  // Derive the intervention from committed state BEFORE calling setState. A
  // useState updater is not guaranteed to run synchronously at dispatch time,
  // so a value mutated inside it cannot be returned reliably.
  const submitCheckIn = useCallback(
    (response: CheckInResponse): AudioInterventionId => {
      if (!state?.activeSession) return "none";

      const intervention = chooseIntervention(response, state.coachSettings);
      setState((prev) => {
        if (!prev?.activeSession) return prev;
        return {
          ...prev,
          activeSession: addCheckIn(prev.activeSession, response, intervention),
        };
      });
      setIsCheckInVisible(false);
      return intervention;
    },
    [state],
  );

  const submitReview = useCallback((review: Omit<FocusSessionReview, "createdAt">) => {
    setState((prev) => {
      if (!prev?.activeSession) return prev;

      const reviewedSession = attachReview(prev.activeSession, review);
      return {
        ...prev,
        activeSession: null,
        history: addSessionToHistory(prev.history, reviewedSession),
      };
    });
    setMissionDraft("");
    setDurationDraft(25);
    setReviewDefaultOutcome("completed");
  }, []);

  return {
    state,
    activeSession,
    missionDraft,
    durationDraft,
    elapsedSeconds,
    targetSeconds,
    canStart,
    isCheckInVisible,
    reviewDefaultOutcome,
    setMissionDraft,
    setDurationDraft,
    startSession,
    pauseActiveSession,
    resumeActiveSession,
    completeActiveSession,
    stopActiveSession,
    submitCheckIn,
    submitReview,
  };
}
```

- [ ] **Step 2: Type-check**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/hooks/useFocusSession.ts
git commit -m "feat: 集中セッションのフックを追加"
```

---

## Task 5: Add Mission Setup Component

**Files:**

- Create: `src/components/FocusMissionSetup.tsx`

- [ ] **Step 1: Add component**

Add:

```tsx
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
          TODAY'S MISSION
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
```

- [ ] **Step 2: Type-check**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/components/FocusMissionSetup.tsx
git commit -m "feat: 集中ミッション入力を追加"
```

---

## Task 6: Add Timer Component

**Files:**

- Create: `src/components/FocusTimer.tsx`

- [ ] **Step 1: Add component**

Add:

```tsx
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
```

- [ ] **Step 2: Type-check**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/components/FocusTimer.tsx
git commit -m "feat: 集中タイマーを追加"
```

---

## Task 7: Add Check-In and Review Components

**Files:**

- Create: `src/components/FocusCheckIn.tsx`
- Create: `src/components/FocusReview.tsx`

- [ ] **Step 1: Add check-in component**

Add to `src/components/FocusCheckIn.tsx`:

```tsx
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
```

- [ ] **Step 2: Add review component**

Add to `src/components/FocusReview.tsx`:

```tsx
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
```

- [ ] **Step 3: Type-check**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/components/FocusCheckIn.tsx src/components/FocusReview.tsx
git commit -m "feat: 集中チェックインとレビューを追加"
```

---

## Task 8: Add Session History

**Files:**

- Create: `src/components/SessionHistory.tsx`

- [ ] **Step 1: Add component**

Add:

```tsx
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
```

- [ ] **Step 2: Type-check**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/components/SessionHistory.tsx
git commit -m "feat: 集中セッション履歴を追加"
```

---

## Task 9: Wire Session UI Into Home Page

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace page composition**

Update `src/app/page.tsx` to:

```tsx
"use client";

import { AmbientMixer } from "@/components/AmbientMixer";
import { FocusCheckIn } from "@/components/FocusCheckIn";
import { FocusMissionSetup } from "@/components/FocusMissionSetup";
import { FocusReview } from "@/components/FocusReview";
import { FocusTimer } from "@/components/FocusTimer";
import { MasterVolume } from "@/components/MasterVolume";
import { Player } from "@/components/Player";
import { SessionHistory } from "@/components/SessionHistory";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useFocusSession } from "@/hooks/useFocusSession";

export default function Home() {
  const {
    settings,
    runtime,
    togglePlay,
    toggleLayer,
    setLayerVolume,
    setMasterVolume,
  } = useAudioEngine();

  const focus = useFocusSession();

  if (!settings || !focus.state) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
      </main>
    );
  }

  const activeSession = focus.activeSession;
  const isReviewing = activeSession?.status === "reviewing";
  const isSessionActive = Boolean(activeSession) && !isReviewing;

  return (
    <main className="flex min-h-screen justify-center p-4">
      <div className="flex w-full max-w-[460px] flex-col gap-6 py-6">
        <div className="rounded-2xl bg-[#0A0A0A] p-6">
          <Player isPlaying={runtime.intentToPlay} onTogglePlay={togglePlay} />
        </div>

        {!activeSession && (
          <FocusMissionSetup
            mission={focus.missionDraft}
            duration={focus.durationDraft}
            canStart={focus.canStart}
            onMissionChange={focus.setMissionDraft}
            onDurationChange={focus.setDurationDraft}
            onStart={focus.startSession}
          />
        )}

        {isSessionActive && activeSession && (
          <FocusTimer
            session={activeSession}
            elapsedSeconds={focus.elapsedSeconds}
            targetSeconds={focus.targetSeconds}
            onPause={focus.pauseActiveSession}
            onResume={focus.resumeActiveSession}
            onComplete={focus.completeActiveSession}
            onStop={focus.stopActiveSession}
          />
        )}

        {focus.isCheckInVisible && (
          <FocusCheckIn
            onSubmit={(response) => {
              focus.submitCheckIn(response);
            }}
          />
        )}

        {isReviewing && activeSession && (
          <FocusReview
            session={activeSession}
            defaultOutcome={focus.reviewDefaultOutcome}
            onSubmit={focus.submitReview}
          />
        )}

        <div className="flex flex-col gap-6 rounded-2xl bg-[#0A0A0A] p-6">
          <AmbientMixer
            settings={settings}
            runtime={runtime}
            onToggleLayer={toggleLayer}
            onSetLayerVolume={setLayerVolume}
          />

          <div className="h-px bg-zinc-900" />

          <MasterVolume volume={settings.masterVolume} onSetVolume={setMasterVolume} />
        </div>

        <SessionHistory sessions={focus.state.history} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Manual smoke test**

Run:

```bash
npm run dev
```

Open the local URL. Verify:

- Mission input appears.
- Start requires a non-empty mission.
- Starting a session shows the timer.
- Pause/resume works.
- Complete opens review (default outcome Done).
- Stop opens review (default outcome Dropped) and the session is still saved.
- Saving review returns to setup and adds a recent session.
- Existing audio play, ambient layer toggles, and master volume still work.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/app/page.tsx
git commit -m "feat: 集中セッションUIを接続"
```

---

## Task 10: Add Gentle Audio Interventions

**Files:**

- Modify: `src/hooks/useAudioEngine.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add audio intervention helpers to the hook**

In `src/hooks/useAudioEngine.ts`, add the following callbacks before the return:

```ts
  const increaseWhiteNoise = useCallback(async () => {
    if (!settings) return;

    const layerId = "white-noise";
    const volume = Math.max(settings.layerSettings[layerId].volume, 0.45);
    const newSettings: PersistedSettings = {
      ...settings,
      layerSettings: {
        ...settings.layerSettings,
        [layerId]: { enabled: true, volume },
      },
    };

    setSettings(newSettings);

    const engine = engineRef.current;
    if (engine?.isPlaying) {
      await engine.toggleLayer(layerId, true, volume);
      engine.setLayerVolume(layerId, volume);
    }
  }, [settings]);

  const softReset = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !settings) return;

    engine.setMasterVolume(Math.max(0.2, settings.masterVolume * 0.55));

    window.setTimeout(() => {
      engine.setMasterVolume(settings.masterVolume);
    }, 1600);
  }, [settings]);
```

Then include them in the returned object:

```ts
    increaseWhiteNoise,
    softReset,
```

- [ ] **Step 2: Apply interventions from check-in**

In `src/app/page.tsx`, destructure the new helpers:

```ts
    increaseWhiteNoise,
    softReset,
```

Update the `FocusCheckIn` handler:

```tsx
          <FocusCheckIn
            onSubmit={(response) => {
              const intervention = focus.submitCheckIn(response);
              if (intervention === "increase-white-noise") {
                void increaseWhiteNoise();
              }
              if (intervention === "soft-reset") {
                softReset();
              }
              if (intervention === "pause-for-break" && runtime.intentToPlay) {
                void togglePlay();
                focus.pauseActiveSession();
              }
            }}
          />
```

- [ ] **Step 3: Build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 4: Manual smoke test**

Run:

```bash
npm run dev
```

Verify:

- A drifting check-in enables or raises white noise.
- A break check-in stops audio and pauses the session.
- Existing manual audio controls still work after an intervention.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/hooks/useAudioEngine.ts src/app/page.tsx
git commit -m "feat: 音の集中復帰介入を追加"
```

---

## Task 11: Add Lightweight Tests If Time Allows

**Files:**

- Modify: `package.json`
- Create: `src/session/focus-session.test.ts`
- Create: `src/session/storage.test.ts`

- [ ] **Step 1: Add Vitest**

Run:

```bash
npm install -D vitest jsdom
```

If the npm cache has root-owned files, install with a temp cache: `npm install -D vitest jsdom --cache "$TMPDIR/npm-cache"`.

Then add `vitest.config.ts` so Vitest resolves the `@/` path alias (without it the test imports fail to resolve):

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 2: Add test scripts**

Update `package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Add session logic tests**

Create `src/session/focus-session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  addSessionToHistory,
  canStartSession,
  checkpointElapsed,
  chooseIntervention,
  createFocusSession,
  getElapsedSeconds,
  pauseSession,
  restoreActiveSession,
  resumeSession,
} from "@/session/focus-session";
import type { FocusSession } from "@/types/focus-session";

describe("focus session logic", () => {
  it("requires a non-empty mission", () => {
    expect(canStartSession("")).toBe(false);
    expect(canStartSession("  ")).toBe(false);
    expect(canStartSession("Write PRD")).toBe(true);
  });

  it("creates a running session", () => {
    const session = createFocusSession("Write PRD", 25, new Date("2026-06-24T00:00:00.000Z"));

    expect(session.status).toBe("running");
    expect(session.mission).toBe("Write PRD");
    expect(session.duration).toBe(25);
  });

  it("preserves elapsed time across pause and resume", () => {
    const session = createFocusSession("Build", "open", new Date("2026-06-24T00:00:00.000Z"));
    const paused = pauseSession(session, new Date("2026-06-24T00:02:00.000Z"));
    const resumed = resumeSession(paused, new Date("2026-06-24T00:05:00.000Z"));

    expect(paused.elapsedBeforePauseSeconds).toBe(120);
    expect(getElapsedSeconds(resumed, new Date("2026-06-24T00:06:00.000Z"))).toBe(180);
  });

  it("chooses gentle interventions from check-ins", () => {
    const settings = { checkInIntervalMinutes: 15, enableAudioInterventions: true } as const;

    expect(chooseIntervention("focused", settings)).toBe("none");
    expect(chooseIntervention("drifting", settings)).toBe("increase-white-noise");
    expect(chooseIntervention("need-break", settings)).toBe("pause-for-break");
  });

  it("caps history to 20 sessions", () => {
    const sessions = Array.from({ length: 25 }, (_, index) =>
      createFocusSession(`Session ${index}`, 25, new Date(2026, 5, 24, 0, index)),
    );

    const history = sessions.reduce<FocusSession[]>(
      (acc, session) => addSessionToHistory(acc, session),
      [],
    );

    expect(history).toHaveLength(20);
    expect(history[0].mission).toBe("Session 24");
  });

  it("checkpoints elapsed time without losing or replaying it", () => {
    const session = createFocusSession("Build", "open", new Date("2026-06-24T00:00:00.000Z"));
    const checkpointed = checkpointElapsed(session, new Date("2026-06-24T00:00:30.000Z"));

    expect(checkpointed.elapsedBeforePauseSeconds).toBe(30);
    expect(getElapsedSeconds(checkpointed, new Date("2026-06-24T00:00:45.000Z"))).toBe(45);
  });

  it("pauses a stale running session on restore instead of replaying closed time", () => {
    const session = createFocusSession("Build", "open", new Date("2026-06-24T00:00:00.000Z"));
    const checkpointed = checkpointElapsed(session, new Date("2026-06-24T00:00:30.000Z"));
    const restored = restoreActiveSession(checkpointed, new Date("2026-06-24T03:00:00.000Z"));

    expect(restored?.status).toBe("paused");
    expect(getElapsedSeconds(restored!, new Date("2026-06-24T03:00:00.000Z"))).toBe(30);
  });

  it("keeps a freshly checkpointed running session on restore", () => {
    const session = createFocusSession("Build", "open", new Date("2026-06-24T00:00:00.000Z"));
    const checkpointed = checkpointElapsed(session, new Date("2026-06-24T00:00:05.000Z"));
    const restored = restoreActiveSession(checkpointed, new Date("2026-06-24T00:00:07.000Z"));

    expect(restored?.status).toBe("running");
  });
});
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 6: Commit**

Run:

```bash
git add package.json package-lock.json src/session/focus-session.test.ts
git commit -m "test: 集中セッションロジックを検証"
```

---

## Task 12: Final Verification and Handoff

- [ ] **Step 1: Check status**

Run:

```bash
git status --short --branch
```

Expected: only intentional files are dirty, or the tree is clean after commits.

- [ ] **Step 2: Build**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Manual verification**

Run:

```bash
npm run dev
```

Verify:

- First screen is the usable focus app, not a landing page.
- No text overlaps at mobile width around 390px.
- Mission entry, duration selection, session timer, pause/resume, review, and history work.
- Existing 40Hz playback and ambient controls still work.
- Check-in interventions are visible and reversible enough for the user to understand.

- [ ] **Step 4: Update README only after verification**

If the feature is verified, update `README.md` to describe:

- Focus Session OS.
- Adaptive Audio Coach v1.
- Local-only storage.
- No automatic desktop monitoring yet.

- [ ] **Step 5: Commit docs update if README changed**

Run:

```bash
git add README.md
git commit -m "docs: 集中セッション機能を説明"
```

---

## Notes for Claude

- Do not build Google Meet auto-pause in this pass. Keep it as a future external signal integration.
- Do not add accounts, backend storage, analytics, or monitoring.
- Do not claim medical efficacy for ADHD, gamma waves, or concentration.
- Prefer existing patterns in this repo over framework assumptions.
- Before editing Next.js files, follow `AGENTS.md`: read relevant local docs under `node_modules/next/dist/docs/` if available.
- If the generated implementation needs to deviate from this plan, update the plan or leave an implementation note explaining why.

