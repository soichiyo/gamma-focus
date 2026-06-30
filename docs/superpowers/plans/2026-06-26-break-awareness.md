# Break Awareness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Gamma Focus breaks hard to miss by adding a real break timer, break-ended view, browser notification, tab title countdown, optional app badge, and safe return-to-focus flow.

**Architecture:** Extend the existing focus-session domain with an explicit `breakState` nested inside `FocusSession`. Keep all break math in pure session helpers, then add small client hooks for peripheral effects: Notifications API, document title, App Badging API, and optional Screen Wake Lock. The core app must work even when browser capabilities are unavailable or permission is denied.

**Tech Stack:** Next.js 16.2.2, React 19.2.4, TypeScript, Tailwind CSS 4, Vitest, Web Notifications API, App Badging API, Screen Wake Lock API, Page Visibility API.

---

## Scope

Build `Break Awareness v1` only:

- Need-break check-in starts a timed break instead of just pausing silently.
- User can choose 3, 5, or 10 minutes.
- Break view shows remaining time.
- Break end changes the visible app state to `Break ended`.
- Break end can trigger a browser notification, short sound cue, tab-title update, and app badge when supported.
- `Return to Focus` resumes the session and clears break peripherals.

Out of scope:

- Native Dock countdown rendering.
- Menu bar app.
- Electron/Tauri/macOS helper.
- Google Meet auto-pause.
- Writing to `personal-task-os`, `log-my-pc`, or any external source.

Official API references used for implementation decisions:

- Notifications permission is request-based: https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static
- Notifications API displays system notifications: https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API
- App Badging can set a number/dot on installed apps when supported: https://developer.mozilla.org/en-US/docs/Web/API/Badging_API
- `navigator.setAppBadge()` sets an app-icon badge when available: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/setAppBadge
- Screen Wake Lock can reduce screen dimming/locking when supported and secure: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
- Page Visibility can re-check state when the tab becomes visible again: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API

---

## Preflight Gates

- [ ] **Step 1: Confirm repo and worktree**

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

If unrelated dirty files exist, preserve them. If only docs plans are untracked, leave them alone unless the user asks to stage/commit docs.

- [ ] **Step 2: Read local Next.js docs if available**

Run:

```bash
find node_modules/next/dist/docs -maxdepth 2 -type f | sed -n '1,120p'
```

Read relevant docs before editing `src/app/*`. If absent, follow existing project patterns and record that in notes.

- [ ] **Step 3: Baseline tests and build**

Run:

```bash
npm run test
npm run build
```

Expected: both pass before feature work.

---

## File Structure

Create:

- `src/components/BreakTimer.tsx`: break countdown / ended / return-to-focus UI.
- `src/components/BreakDurationPicker.tsx`: 3/5/10 minute break chooser shown after need-break check-in.
- `src/hooks/usePeripheralTimerEffects.ts`: title, notification, badge, wake lock, and cue orchestration.
- `src/peripheral/browser-capabilities.ts`: typed wrappers for optional browser APIs.
- `src/peripheral/notification-sound.ts`: tiny Web Audio cue for break end.

Modify:

- `src/types/focus-session.ts`: add break types and `breakState` to `FocusSession`.
- `src/session/focus-session.ts`: add pure break helpers.
- `src/session/storage.ts`: sanitize persisted break state.
- `src/session/focus-session.test.ts`: add break timer tests.
- `src/session/storage.test.ts`: add break-state persistence tests.
- `src/hooks/useFocusSession.ts`: expose break lifecycle actions.
- `src/app/page.tsx`: wire break picker, break timer, and peripheral effects.
- `src/components/FocusCheckIn.tsx`: no required prop change if page handles `need-break`; optional copy-only tweaks allowed.
- `src/app/layout.tsx`: no change unless metadata title needs a more stable base.

---

## Task 1: Add Break Types

**Files:**

- Modify: `src/types/focus-session.ts`

- [ ] **Step 1: Add break types**

In `src/types/focus-session.ts`, add these types after `FocusDuration`:

```ts
export type BreakDurationMinutes = 3 | 5 | 10;

export type BreakStatus = "idle" | "running" | "ended";

export type FocusBreakState = {
  status: BreakStatus;
  durationMinutes: BreakDurationMinutes | null;
  startedAt: string | null;
  endedAt: string | null;
  notifiedAt: string | null;
};
```

Add `breakState` to `FocusSession`:

```ts
  breakState: FocusBreakState;
```

- [ ] **Step 2: Add a reusable idle break constant type expectation**

Do not create the constant in this file. The constant belongs in `src/session/focus-session.ts` in Task 2.

- [ ] **Step 3: Build to confirm expected failures**

Run:

```bash
npm run build
```

Expected: fail because `FocusSession` construction and storage do not yet provide `breakState`.

Do not commit this task by itself if the repo does not build. Continue to Task 2 and commit both type and helper changes together.

---

## Task 2: Add Pure Break Helpers

**Files:**

- Modify: `src/session/focus-session.ts`
- Modify: `src/types/focus-session.ts`
- Modify: `src/session/focus-session.test.ts`

- [ ] **Step 1: Update imports and constants**

In `src/session/focus-session.ts`, import `BreakDurationMinutes` and `FocusBreakState`:

```ts
import type {
  AudioInterventionId,
  BreakDurationMinutes,
  CheckInResponse,
  CoachSettings,
  FocusBreakState,
  FocusCheckIn,
  FocusDuration,
  FocusSession,
  FocusSessionReview,
  PersistedSessionState,
} from "@/types/focus-session";
```

Add after `SESSION_HISTORY_LIMIT`:

```ts
export const DEFAULT_BREAK_STATE: FocusBreakState = {
  status: "idle",
  durationMinutes: null,
  startedAt: null,
  endedAt: null,
  notifiedAt: null,
};
```

- [ ] **Step 2: Add breakState to new sessions**

In `createFocusSession`, add:

```ts
    breakState: DEFAULT_BREAK_STATE,
```

Place it before `checkIns`.

- [ ] **Step 3: Add break helper functions**

Add these functions before `createId`:

```ts
export function startBreak(
  session: FocusSession,
  durationMinutes: BreakDurationMinutes,
  now = new Date(),
): FocusSession {
  if (session.status === "reviewing") return session;

  return {
    ...pauseSession(session, now),
    breakState: {
      status: "running",
      durationMinutes,
      startedAt: now.toISOString(),
      endedAt: null,
      notifiedAt: null,
    },
  };
}

export function getBreakDurationSeconds(breakState: FocusBreakState): number | null {
  return breakState.durationMinutes === null ? null : breakState.durationMinutes * 60;
}

export function getBreakElapsedSeconds(
  breakState: FocusBreakState,
  now = new Date(),
): number {
  if (!breakState.startedAt) return 0;
  return Math.max(0, Math.floor((now.getTime() - new Date(breakState.startedAt).getTime()) / 1000));
}

export function getBreakRemainingSeconds(
  breakState: FocusBreakState,
  now = new Date(),
): number | null {
  const durationSeconds = getBreakDurationSeconds(breakState);
  if (durationSeconds === null) return null;
  return Math.max(0, durationSeconds - getBreakElapsedSeconds(breakState, now));
}

export function isBreakDue(
  breakState: FocusBreakState,
  now = new Date(),
): boolean {
  return breakState.status === "running" && getBreakRemainingSeconds(breakState, now) === 0;
}

export function markBreakEnded(session: FocusSession, now = new Date()): FocusSession {
  if (session.breakState.status !== "running") return session;

  return {
    ...session,
    breakState: {
      ...session.breakState,
      status: "ended",
      endedAt: now.toISOString(),
    },
  };
}

export function markBreakNotified(session: FocusSession, now = new Date()): FocusSession {
  if (session.breakState.status !== "ended") return session;

  return {
    ...session,
    breakState: {
      ...session.breakState,
      notifiedAt: now.toISOString(),
    },
  };
}

export function returnFromBreak(session: FocusSession, now = new Date()): FocusSession {
  if (session.breakState.status === "idle") return session;

  return {
    ...resumeSession(session, now),
    breakState: DEFAULT_BREAK_STATE,
  };
}
```

- [ ] **Step 4: Update stale restore behavior**

In `restoreActiveSession`, before the existing running-session stale check, add:

```ts
  if (session.breakState.status === "running" && isBreakDue(session.breakState, now)) {
    return markBreakEnded(session, now);
  }
```

- [ ] **Step 5: Add break tests**

Append to `src/session/focus-session.test.ts`:

```ts
import {
  getBreakRemainingSeconds,
  markBreakEnded,
  returnFromBreak,
  startBreak,
} from "@/session/focus-session";
```

If there is already an import block from `@/session/focus-session`, merge these names into it instead of creating a duplicate import.

Add tests:

```ts
  it("starts a timed break by pausing the active session", () => {
    const session = createFocusSession("Write plan", 25, new Date("2026-06-26T00:00:00.000Z"));
    const breakSession = startBreak(session, 5, new Date("2026-06-26T00:02:00.000Z"));

    expect(breakSession.status).toBe("paused");
    expect(breakSession.breakState).toEqual({
      status: "running",
      durationMinutes: 5,
      startedAt: "2026-06-26T00:02:00.000Z",
      endedAt: null,
      notifiedAt: null,
    });
  });

  it("computes remaining break time", () => {
    const session = createFocusSession("Write plan", 25, new Date("2026-06-26T00:00:00.000Z"));
    const breakSession = startBreak(session, 3, new Date("2026-06-26T00:00:00.000Z"));

    expect(getBreakRemainingSeconds(breakSession.breakState, new Date("2026-06-26T00:01:15.000Z"))).toBe(105);
    expect(getBreakRemainingSeconds(breakSession.breakState, new Date("2026-06-26T00:04:00.000Z"))).toBe(0);
  });

  it("marks a due break as ended and returns to focus", () => {
    const session = createFocusSession("Write plan", 25, new Date("2026-06-26T00:00:00.000Z"));
    const breakSession = startBreak(session, 3, new Date("2026-06-26T00:00:00.000Z"));
    const ended = markBreakEnded(breakSession, new Date("2026-06-26T00:03:00.000Z"));
    const resumed = returnFromBreak(ended, new Date("2026-06-26T00:04:00.000Z"));

    expect(ended.breakState.status).toBe("ended");
    expect(resumed.status).toBe("running");
    expect(resumed.breakState.status).toBe("idle");
  });
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm run test -- src/session/focus-session.test.ts
```

Expected: all focus-session tests pass.

- [ ] **Step 7: Build**

Run:

```bash
npm run build
```

Expected: build may still fail until storage sanitization is updated in Task 3. If the only errors are missing `breakState` from storage sanitization, continue.

- [ ] **Step 8: Commit after Task 3**

Do not commit yet unless the build passes. Commit type/helper/storage together after Task 3.

---

## Task 3: Persist And Sanitize Break State

**Files:**

- Modify: `src/session/storage.ts`
- Modify: `src/session/storage.test.ts`
- Modify: `src/types/focus-session.ts`
- Modify: `src/session/focus-session.ts`
- Modify: `src/session/focus-session.test.ts`

- [ ] **Step 1: Update storage imports**

In `src/session/storage.ts`, import:

```ts
import {
  DEFAULT_BREAK_STATE,
  DEFAULT_SESSION_STATE,
  SESSION_HISTORY_LIMIT,
} from "@/session/focus-session";
import type { BreakDurationMinutes, FocusBreakState, FocusSession, PersistedSessionState } from "@/types/focus-session";
```

- [ ] **Step 2: Add break-state sanitizer**

Add near `sanitizeSession`:

```ts
function sanitizeBreakState(value: unknown): FocusBreakState {
  if (!value || typeof value !== "object") return { ...DEFAULT_BREAK_STATE };
  const breakState = value as Partial<FocusBreakState>;

  const status =
    breakState.status === "running" || breakState.status === "ended" || breakState.status === "idle"
      ? breakState.status
      : "idle";

  return {
    status,
    durationMinutes: isBreakDuration(breakState.durationMinutes)
      ? breakState.durationMinutes
      : null,
    startedAt: typeof breakState.startedAt === "string" ? breakState.startedAt : null,
    endedAt: typeof breakState.endedAt === "string" ? breakState.endedAt : null,
    notifiedAt: typeof breakState.notifiedAt === "string" ? breakState.notifiedAt : null,
  };
}

function isBreakDuration(value: unknown): value is BreakDurationMinutes {
  return value === 3 || value === 5 || value === 10;
}
```

- [ ] **Step 3: Include breakState in sanitized sessions**

In the returned object from `sanitizeSession`, add:

```ts
    breakState: sanitizeBreakState(session.breakState),
```

Place it before `checkIns`.

- [ ] **Step 4: Add storage test**

Append to `src/session/storage.test.ts`:

```ts
  it("round-trips active break state", () => {
    const session = createFocusSession("Break test", 25, new Date("2026-06-26T00:00:00.000Z"));
    const activeBreak = {
      ...session,
      status: "paused" as const,
      breakState: {
        status: "running" as const,
        durationMinutes: 5 as const,
        startedAt: "2026-06-26T00:01:00.000Z",
        endedAt: null,
        notifiedAt: null,
      },
    };

    saveSessionState({
      version: 1,
      activeSession: activeBreak,
      history: [activeBreak],
      coachSettings: { checkInIntervalMinutes: 15, enableAudioInterventions: true },
    });

    const state = loadSessionState();

    expect(state.activeSession?.breakState).toEqual({
      status: "running",
      durationMinutes: 5,
      startedAt: "2026-06-26T00:01:00.000Z",
      endedAt: null,
      notifiedAt: null,
    });
  });
```

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm run test -- src/session/focus-session.test.ts src/session/storage.test.ts
npm run build
```

Expected: both pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/types/focus-session.ts src/session/focus-session.ts src/session/storage.ts src/session/focus-session.test.ts src/session/storage.test.ts
git commit -m "feat: ブレイクタイマー状態を保存"
```

---

## Task 4: Add Peripheral Browser Capability Wrappers

**Files:**

- Create: `src/peripheral/browser-capabilities.ts`
- Create: `src/peripheral/notification-sound.ts`

- [ ] **Step 1: Add optional browser API wrappers**

Create `src/peripheral/browser-capabilities.ts`:

```ts
type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

type WakeLockSentinel = {
  release: () => Promise<void>;
  released: boolean;
  addEventListener: (type: "release", listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinel>;
  };
};

export function canNotify(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!canNotify()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!canNotify()) return "unsupported";
  return Notification.requestPermission();
}

export function showBreakEndedNotification(mission: string): boolean {
  if (!canNotify() || Notification.permission !== "granted") return false;

  new Notification("Break ended", {
    body: mission ? `Return to focus: ${mission}` : "Return to focus.",
    silent: false,
  });
  return true;
}

export async function setAppBadge(value?: number): Promise<boolean> {
  const badgeNavigator = navigator as BadgeNavigator;
  if (!badgeNavigator.setAppBadge) return false;

  await badgeNavigator.setAppBadge(value);
  return true;
}

export async function clearAppBadge(): Promise<boolean> {
  const badgeNavigator = navigator as BadgeNavigator;
  if (!badgeNavigator.clearAppBadge) return false;

  await badgeNavigator.clearAppBadge();
  return true;
}

export async function requestScreenWakeLock(): Promise<WakeLockSentinel | null> {
  const wakeLockNavigator = navigator as WakeLockNavigator;
  if (!wakeLockNavigator.wakeLock) return null;

  try {
    return await wakeLockNavigator.wakeLock.request("screen");
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Add short break-ended sound cue**

Create `src/peripheral/notification-sound.ts`:

```ts
export function playBreakEndedCue(): void {
  try {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextConstructor();
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();

    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.0001;

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.start(now);
    osc.stop(now + 0.5);
    osc.onended = () => {
      void ctx.close();
    };
  } catch {
    // Sound cues are optional. Never break the focus flow for audio failures.
  }
}
```

- [ ] **Step 3: Add TypeScript compatibility for webkitAudioContext**

If TypeScript complains about `window.webkitAudioContext`, add this at the top of `src/peripheral/notification-sound.ts`:

```ts
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
```

- [ ] **Step 4: Build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/peripheral/browser-capabilities.ts src/peripheral/notification-sound.ts
git commit -m "feat: ブレイク通知用ブラウザ機能を追加"
```

---

## Task 5: Add Peripheral Effects Hook

**Files:**

- Create: `src/hooks/usePeripheralTimerEffects.ts`

- [ ] **Step 1: Add hook**

Create `src/hooks/usePeripheralTimerEffects.ts`:

```ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearAppBadge,
  getNotificationPermission,
  requestNotificationPermission,
  requestScreenWakeLock,
  setAppBadge,
  showBreakEndedNotification,
} from "@/peripheral/browser-capabilities";
import { playBreakEndedCue } from "@/peripheral/notification-sound";
import type { FocusSession } from "@/types/focus-session";

type PeripheralTimerEffectsInput = {
  activeSession: FocusSession | null;
  breakRemainingSeconds: number | null;
  onBreakNotified: () => void;
};

export function usePeripheralTimerEffects({
  activeSession,
  breakRemainingSeconds,
  onBreakNotified,
}: PeripheralTimerEffectsInput) {
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const baseTitleRef = useRef("Gamma Focus");
  const wakeLockRef = useRef<{ release: () => Promise<void>; released: boolean } | null>(null);
  const breakState = activeSession?.breakState;
  const mission = activeSession?.mission ?? "";

  useEffect(() => {
    setNotificationPermission(getNotificationPermission());
  }, []);

  const requestNotifications = useCallback(async () => {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    return permission;
  }, []);

  const title = useMemo(() => {
    if (!activeSession) return baseTitleRef.current;
    if (breakState?.status === "ended") return "Break ended · Gamma Focus";
    if (breakState?.status === "running" && breakRemainingSeconds !== null) {
      return `Break ${formatMinutesSeconds(breakRemainingSeconds)} · Gamma Focus`;
    }
    return `${formatMinutesSeconds(activeSession.elapsedBeforePauseSeconds)} · Gamma Focus`;
  }, [activeSession, breakRemainingSeconds, breakState?.status]);

  useEffect(() => {
    document.title = title;
    return () => {
      document.title = baseTitleRef.current;
    };
  }, [title]);

  useEffect(() => {
    if (breakState?.status !== "running" || breakRemainingSeconds === null) return;

    const badgeValue = Math.max(1, Math.ceil(breakRemainingSeconds / 60));
    void setAppBadge(badgeValue).catch(() => undefined);
  }, [breakRemainingSeconds, breakState?.status]);

  useEffect(() => {
    if (breakState?.status === "idle" || !activeSession) {
      void clearAppBadge().catch(() => undefined);
    }
  }, [activeSession, breakState?.status]);

  useEffect(() => {
    let cancelled = false;

    async function lock() {
      if (breakState?.status !== "running") return;
      const sentinel = await requestScreenWakeLock();
      if (cancelled) {
        await sentinel?.release();
        return;
      }
      wakeLockRef.current = sentinel;
    }

    void lock();

    return () => {
      cancelled = true;
      const sentinel = wakeLockRef.current;
      wakeLockRef.current = null;
      if (sentinel && !sentinel.released) {
        void sentinel.release().catch(() => undefined);
      }
    };
  }, [breakState?.status]);

  useEffect(() => {
    if (!activeSession || breakState?.status !== "ended" || breakState.notifiedAt) return;

    showBreakEndedNotification(mission);
    playBreakEndedCue();
    void setAppBadge().catch(() => undefined);
    onBreakNotified();
  }, [activeSession, breakState, mission, onBreakNotified]);

  return {
    notificationPermission,
    requestNotifications,
  };
}

function formatMinutesSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
```

- [ ] **Step 2: Review title elapsed behavior**

The hook uses `activeSession.elapsedBeforePauseSeconds` for non-break title text. If the implementer wants live focus countdown in the title too, they must pass `elapsedSeconds` from `useFocusSession`. Do not broaden that in this pass unless the user asks.

- [ ] **Step 3: Build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/hooks/usePeripheralTimerEffects.ts
git commit -m "feat: ブレイク終了の周辺通知を追加"
```

---

## Task 6: Extend Focus Session Hook With Break Lifecycle

**Files:**

- Modify: `src/hooks/useFocusSession.ts`

- [ ] **Step 1: Import break helpers and type**

Update imports from `@/session/focus-session`:

```ts
  getBreakRemainingSeconds,
  isBreakDue,
  markBreakEnded,
  markBreakNotified,
  returnFromBreak,
  startBreak,
```

Import type:

```ts
  BreakDurationMinutes,
```

- [ ] **Step 2: Derive break remaining seconds**

After `targetSeconds`, add:

```ts
  const breakRemainingSeconds = activeSession
    ? getBreakRemainingSeconds(activeSession.breakState, now)
    : null;
```

- [ ] **Step 3: Mark break ended when due**

Add this effect after the check-in visibility effect:

```ts
  useEffect(() => {
    setState((prev) => {
      if (!prev?.activeSession) return prev;
      if (!isBreakDue(prev.activeSession.breakState, now)) return prev;
      return { ...prev, activeSession: markBreakEnded(prev.activeSession, now) };
    });
  }, [now]);
```

- [ ] **Step 4: Add lifecycle callbacks**

Add before `submitCheckIn`:

```ts
  const startActiveBreak = useCallback((durationMinutes: BreakDurationMinutes) => {
    setState((prev) => {
      if (!prev?.activeSession) return prev;
      return { ...prev, activeSession: startBreak(prev.activeSession, durationMinutes) };
    });
    setIsCheckInVisible(false);
  }, []);

  const returnToFocus = useCallback(() => {
    setState((prev) => {
      if (!prev?.activeSession) return prev;
      return { ...prev, activeSession: returnFromBreak(prev.activeSession) };
    });
  }, []);

  const markActiveBreakNotified = useCallback(() => {
    setState((prev) => {
      if (!prev?.activeSession) return prev;
      return { ...prev, activeSession: markBreakNotified(prev.activeSession) };
    });
  }, []);
```

- [ ] **Step 5: Return new values**

Add to the returned object:

```ts
    breakRemainingSeconds,
    startActiveBreak,
    returnToFocus,
    markActiveBreakNotified,
```

- [ ] **Step 6: Build**

Run:

```bash
npm run build
```

Expected: build passes after page wiring is completed in later tasks. If the only errors are unused hook return values, continue.

- [ ] **Step 7: Commit after Task 8**

Do not commit until UI wiring is complete unless the build passes.

---

## Task 7: Add Break Duration Picker

**Files:**

- Create: `src/components/BreakDurationPicker.tsx`

- [ ] **Step 1: Create picker component**

Create `src/components/BreakDurationPicker.tsx`:

```tsx
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
```

- [ ] **Step 2: Build**

Run:

```bash
npm run build
```

Expected: build passes if unused exports are acceptable; otherwise continue and wire it in Task 9.

---

## Task 8: Add Break Timer View

**Files:**

- Create: `src/components/BreakTimer.tsx`

- [ ] **Step 1: Create timer component**

Create `src/components/BreakTimer.tsx`:

```tsx
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
```

- [ ] **Step 2: Build**

Run:

```bash
npm run build
```

Expected: build passes if unused exports are acceptable; otherwise continue and wire it in Task 9.

---

## Task 9: Wire Break Flow Into Page

**Files:**

- Modify: `src/app/page.tsx`
- Modify: `src/hooks/useFocusSession.ts`
- Create: `src/components/BreakDurationPicker.tsx`
- Create: `src/components/BreakTimer.tsx`

- [ ] **Step 1: Add imports**

In `src/app/page.tsx`, add:

```ts
import { BreakDurationPicker } from "@/components/BreakDurationPicker";
import { BreakTimer } from "@/components/BreakTimer";
import { usePeripheralTimerEffects } from "@/hooks/usePeripheralTimerEffects";
```

Also import `useState`:

```ts
import { useState } from "react";
```

- [ ] **Step 2: Add break picker state and peripheral hook**

Inside `Home`, after `const focus = useFocusSession();`, add:

```ts
  const [isBreakPickerVisible, setIsBreakPickerVisible] = useState(false);
  const peripheral = usePeripheralTimerEffects({
    activeSession: focus.activeSession,
    breakRemainingSeconds: focus.breakRemainingSeconds,
    onBreakNotified: focus.markActiveBreakNotified,
  });
```

- [ ] **Step 3: Derive break flags**

After `isSessionActive`, add:

```ts
  const isBreakActive =
    activeSession?.breakState.status === "running" || activeSession?.breakState.status === "ended";
```

- [ ] **Step 4: Hide normal timer during break**

Change the timer condition from:

```tsx
        {isSessionActive && activeSession && (
```

to:

```tsx
        {isSessionActive && activeSession && !isBreakActive && (
```

- [ ] **Step 5: Add break timer after normal timer**

Add below the `FocusTimer` block:

```tsx
        {isBreakActive && activeSession && (
          <BreakTimer
            session={activeSession}
            remainingSeconds={focus.breakRemainingSeconds}
            notificationPermission={peripheral.notificationPermission}
            onRequestNotifications={() => {
              void peripheral.requestNotifications();
            }}
            onReturnToFocus={() => {
              focus.returnToFocus();
              setIsBreakPickerVisible(false);
            }}
          />
        )}
```

- [ ] **Step 6: Add break duration picker**

Add this block after the check-in block:

```tsx
        {isBreakPickerVisible && activeSession && !isBreakActive && (
          <BreakDurationPicker
            onStartBreak={(durationMinutes) => {
              focus.startActiveBreak(durationMinutes);
              setIsBreakPickerVisible(false);
              if (runtime.intentToPlay) {
                void togglePlay();
              }
            }}
            onCancel={() => setIsBreakPickerVisible(false)}
          />
        )}
```

- [ ] **Step 7: Change need-break check-in behavior**

Update the `FocusCheckIn` handler from:

```tsx
              if (intervention === "pause-for-break" && runtime.intentToPlay) {
                void togglePlay();
                focus.pauseActiveSession();
              }
```

to:

```tsx
              if (intervention === "pause-for-break") {
                setIsBreakPickerVisible(true);
              }
```

Do not pause or stop audio until the user chooses a break duration.

- [ ] **Step 8: Build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 9: Commit Tasks 6-9 together if needed**

If earlier hook/component commits were deferred due to build errors, commit all wired break flow files now:

```bash
git add src/hooks/useFocusSession.ts src/hooks/usePeripheralTimerEffects.ts src/components/BreakDurationPicker.tsx src/components/BreakTimer.tsx src/app/page.tsx
git commit -m "feat: ブレイク終了に気づける導線を追加"
```

---

## Task 10: Add Manual Verification Aids And Run Full Checks

**Files:**

- Modify: `README.md` only if the feature is verified

- [ ] **Step 1: Full tests and build**

Run:

```bash
npm run test
npm run build
```

Expected: all tests and build pass.

- [ ] **Step 2: Manual browser smoke test**

Run:

```bash
npm run dev -- --port 3000
```

Open `http://localhost:3000`.

Verify:

- Start a focus session.
- Trigger `Focus check`.
- Click `Break`.
- Choose `3m`.
- Audio stops only after choosing the break duration.
- Break timer appears.
- `Enable break notification` appears when permission is `default`.
- Clicking notification permission button does not break the app if permission is denied.
- When the timer reaches `00:00`, the view changes to `Break ended`.
- Tab title changes during break and at break end.
- `Return to Focus` resumes the session view.
- Manual `Pause`, `Review`, and `Stop` still work outside break state.

Stop the dev server after the check.

- [ ] **Step 3: Optional fast local test for break end**

During manual testing, temporarily use `3m` and adjust localStorage only if needed. Do not commit any debug shortcuts.

If faster repeat testing is needed, use browser devtools to inspect state, but do not add a permanent hidden test button.

- [ ] **Step 4: README update**

If the feature is verified, update `README.md` with a short bullet:

```md
- Break Awareness: timed 3/5/10 minute breaks with return-to-focus view, optional browser notification, title countdown, and supported app badge.
```

- [ ] **Step 5: Commit README if changed**

Run:

```bash
git add README.md
git commit -m "docs: ブレイク通知機能を説明"
```

- [ ] **Step 6: Final status**

Run:

```bash
git status --short --branch
```

Expected: clean after commits, or only unrelated files that were already present before implementation.

---

## Risk Notes

- Browser notifications require permission and may not fire on every platform.
- App Badging works only where the browser/platform supports it, often best for installed PWAs.
- Screen Wake Lock requires support and a secure context; it can release when the tab loses visibility.
- The feature must never rely on these APIs for correctness. The source of truth is the local session state and break-ended view.
- Do not promise exact Dock countdown behavior in this web-only iteration.

---

## Notes For Claude

- Keep this feature web-first and graceful-degradation-first.
- Do not introduce a native wrapper.
- Do not add push notifications or service workers in this pass.
- Do not create hidden debug controls.
- Do not make medical or productivity efficacy claims.
- Preserve the existing Focus Session OS flow: mission, timer, check-in, review, history.

