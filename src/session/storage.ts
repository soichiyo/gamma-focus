import {
  DEFAULT_BREAK_STATE,
  DEFAULT_SESSION_STATE,
  SESSION_HISTORY_LIMIT,
} from "@/session/focus-session";
import type { BreakDurationMinutes, FocusBreakState, FocusSession, PersistedSessionState } from "@/types/focus-session";

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
    breakState: sanitizeBreakState(session.breakState),
    checkIns: Array.isArray(session.checkIns) ? session.checkIns : [],
    review: session.review ?? null,
  };
}

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

function isSupportedInterval(value: unknown): value is 10 | 15 | 20 {
  return value === 10 || value === 15 || value === 20;
}
