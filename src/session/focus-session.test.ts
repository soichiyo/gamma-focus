import { describe, expect, it } from "vitest";
import {
  addSessionToHistory,
  canStartSession,
  checkpointElapsed,
  chooseIntervention,
  createFocusSession,
  getBreakRemainingSeconds,
  getElapsedSeconds,
  markBreakEnded,
  pauseSession,
  restoreActiveSession,
  resumeSession,
  returnFromBreak,
  startBreak,
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
    const session = createFocusSession("Build", "open", new Date("2026-06-24T00:00:05.000Z"));
    const checkpointed = checkpointElapsed(session, new Date("2026-06-24T00:00:05.000Z"));
    const restored = restoreActiveSession(checkpointed, new Date("2026-06-24T00:00:07.000Z"));

    expect(restored?.status).toBe("running");
  });

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
});
