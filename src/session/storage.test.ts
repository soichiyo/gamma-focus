// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createFocusSession } from "@/session/focus-session";
import { loadSessionState, SESSION_STORAGE_KEY, saveSessionState } from "@/session/storage";

describe("session storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default state when nothing is stored", () => {
    const state = loadSessionState();

    expect(state.version).toBe(1);
    expect(state.activeSession).toBeNull();
    expect(state.history).toEqual([]);
  });

  it("falls back to default state on invalid JSON", () => {
    localStorage.setItem(SESSION_STORAGE_KEY, "{not valid json");

    const state = loadSessionState();

    expect(state.activeSession).toBeNull();
    expect(state.history).toEqual([]);
  });

  it("falls back to default state on an unknown version", () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ version: 99, history: [] }));

    const state = loadSessionState();

    expect(state.version).toBe(1);
    expect(state.history).toEqual([]);
  });

  it("round-trips a saved active session", () => {
    const session = createFocusSession("Write tests", 25);
    saveSessionState({
      version: 1,
      activeSession: session,
      history: [session],
      coachSettings: { checkInIntervalMinutes: 15, enableAudioInterventions: true },
    });

    const state = loadSessionState();

    expect(state.activeSession?.mission).toBe("Write tests");
    expect(state.history).toHaveLength(1);
  });

  it("drops malformed sessions from history", () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        activeSession: null,
        history: [{ id: "x" }, null, "garbage"],
        coachSettings: { checkInIntervalMinutes: 15, enableAudioInterventions: true },
      }),
    );

    const state = loadSessionState();

    expect(state.history).toEqual([]);
  });

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
});
