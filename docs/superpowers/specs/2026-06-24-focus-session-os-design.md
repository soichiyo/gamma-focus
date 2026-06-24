# Gamma Focus: Focus Session OS + Adaptive Audio Coach Design

## Summary

Gamma Focus will evolve from a simple 40Hz binaural beat player into a local-first focus session app. The first product direction is A-B: Focus Session OS as the core experience, with a light Adaptive Audio Coach layered into the session.

The product should help a user start a focused work block, keep the audio environment stable, recover when attention drops, and capture a short review when the session ends. It should not attempt desktop monitoring, browser surveillance, or focus scoring in this repository. Those belong to `log-my-pc` / Focus Score Lab and can feed Gamma Focus later through an external signal interface.

## Current State

The current app is a small Next.js 16 / React 19 client app:

- `src/app/page.tsx` renders the whole experience.
- `src/hooks/useAudioEngine.ts` owns settings, runtime state, and audio controls.
- `src/audio/audio-engine.ts` coordinates binaural and ambient playback.
- `src/audio/binaural-engine.ts` generates a 200Hz / 240Hz binaural beat.
- `src/audio/ambient-player.ts` loops ambient audio files.
- `src/components/Player.tsx`, `AmbientMixer.tsx`, and `MasterVolume.tsx` render the existing UI.
- Settings are persisted in `localStorage`.

The current app has no session model, timer, mission input, intervention state, review flow, or session history.

## Product Direction

### Focus Session OS

The main unit is a focus session. A session starts with a short mission, runs as a flow timer, keeps audio controls available, and ends with a lightweight review.

The session should be flexible, not strict Pomodoro-first. The default behavior should support "start and flow" while still offering a target duration for users who want a boundary.

Initial session capabilities:

- Set a one-line mission before starting.
- Choose target duration from short options: 15, 25, 45 minutes, or open-ended.
- Start, pause, resume, stop, and complete a session.
- Show elapsed time and target progress when a target duration exists.
- Keep existing binaural and ambient audio controls available during the session.
- Save a compact review after completion or intentional stop.
- Store recent session history locally.

### Adaptive Audio Coach v1

The first coach should not rely on surveillance or external sensors. It should use explicit user check-ins and simple time-based nudges.

Initial coach capabilities:

- After a configurable interval, ask for a quick state check.
- Supported check-in responses: focused, drifting, need break.
- When the user is drifting, apply a small audio intervention and show a short text prompt.
- When the user needs a break, pause audio and offer to resume later.
- Record check-ins and interventions in the session log.
- Keep interventions reversible and gentle.

### Someday Roadmap

These are explicitly out of the first implementation:

- Google Meet / Zoom / call-start auto-pause.
- Chrome extension based active-tab detection.
- macOS active-window or Accessibility monitoring.
- Eye tracking.
- Automatic focus score calculation.
- Server sync, accounts, teams, or cloud storage.

The app should still leave a small design opening for external signals. Later, `log-my-pc` can send events such as `meeting_started`, `distraction_detected`, or `focus_recovered`, and Gamma Focus can respond with audio/session changes.

## UX Model

The first screen should remain the product experience, not a landing page.

Recommended layout:

1. Session header:
   - Product name.
   - Current session status.
   - Small headphone reminder.

2. Mission setup:
   - One-line mission input.
   - Target duration segmented control.
   - Primary start button.

3. Session runtime:
   - Elapsed time.
   - Target duration or open-ended label.
   - Pause/resume and complete actions.
   - Current coach state.

4. Audio surface:
   - Existing play/stop control.
   - Existing ambient mixer.
   - Existing master volume.

5. Check-in / review:
   - Inline check-in prompt during a running session.
   - Review panel after completion or stop.

Avoid a marketing layout. This is a personal operating surface for repeated work. It should be calm, dense enough to scan, and avoid oversized hero composition.

## State Model

Add a separate session domain next to the existing audio domain.

Suggested session types:

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

export type FocusSessionReview = {
  focusRating: 1 | 2 | 3 | 4 | 5;
  outcome: "completed" | "partial" | "abandoned";
  note: string;
  createdAt: string;
};
```

Persisted state should be versioned:

```ts
export type PersistedSessionState = {
  version: 1;
  activeSession: FocusSession | null;
  history: FocusSession[];
  coachSettings: {
    checkInIntervalMinutes: 10 | 15 | 20;
    enableAudioInterventions: boolean;
  };
};
```

## Audio Intervention Model

The first audio interventions should use existing capabilities:

- `increase-white-noise`: enable white noise if available and raise it to a moderate volume.
- `soft-reset`: lower master volume briefly, then restore it.
- `pause-for-break`: stop audio and leave the session paused.

The implementation should avoid hidden, surprising changes. When an intervention changes audio settings, the UI should show what changed and allow the user to continue normally.

## External Signals

Do not implement external signal sources in this iteration. Define only the conceptual boundary:

```ts
export type ExternalFocusSignal =
  | { type: "meeting_started"; source: "manual" | "extension" | "log-my-pc"; createdAt: string }
  | { type: "distraction_detected"; source: "log-my-pc"; createdAt: string; label?: string }
  | { type: "focus_recovered"; source: "log-my-pc"; createdAt: string };
```

Future behavior:

- `meeting_started`: stop audio or enter Meeting Mode.
- `distraction_detected`: trigger a coach check-in or gentle audio reset.
- `focus_recovered`: clear the coach prompt.

## Storage

Use `localStorage` for the first iteration.

Storage keys:

- Existing audio settings: keep `gamma-focus-settings`.
- New session state: use `gamma-focus-session-state`.

History should be capped to the most recent 20 sessions to keep the app simple and local.

## Testing Strategy

The current project has no test setup. The implementation should add a small test stack only if it remains lightweight. Recommended:

- Vitest for pure session storage/reducer functions.
- Manual browser verification for Web Audio and UI.
- `npm run build` as the main integration gate.

High-value automated tests:

- Session start validates mission and creates a running session.
- Pause/resume preserves elapsed time.
- Complete moves session into review state.
- Review stores completed session in capped history.
- Drifting check-in chooses an audio intervention.
- Storage loader falls back safely on invalid JSON or unknown versions.

## Non-Goals

- No medical claims about ADHD, cognition, gamma waves, or treatment effects.
- No automatic diagnosis of focus.
- No background monitoring inside Gamma Focus.
- No cloud persistence.
- No extension or desktop app in this repo for the first implementation.

## Open Decisions

These can be decided during implementation without changing the product direction:

- Whether the review appears as a modal, inline panel, or full replacement panel.
- Whether audio starts automatically when a session starts. Recommended default: session start also starts audio after the same user gesture.
- Exact check-in interval default. Recommended default: 15 minutes.

