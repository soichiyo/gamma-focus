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
    const session = createFocusSession("Build", "open", new Date("2026-06-24T00:00:05.000Z"));
    const checkpointed = checkpointElapsed(session, new Date("2026-06-24T00:00:05.000Z"));
    const restored = restoreActiveSession(checkpointed, new Date("2026-06-24T00:00:07.000Z"));

    expect(restored?.status).toBe("running");
  });
});
