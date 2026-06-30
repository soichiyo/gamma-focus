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

export const SESSION_HISTORY_LIMIT = 20;

export const DEFAULT_BREAK_STATE: FocusBreakState = {
  status: "idle",
  durationMinutes: null,
  startedAt: null,
  endedAt: null,
  notifiedAt: null,
};

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
    breakState: DEFAULT_BREAK_STATE,
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
  if (session && session.breakState.status === "running" && isBreakDue(session.breakState, now)) {
    return markBreakEnded(session, now);
  }
  if (!session || session.status !== "running" || !session.startedAt) return session;

  const gapSeconds = Math.floor((now.getTime() - new Date(session.startedAt).getTime()) / 1000);
  if (gapSeconds <= STALE_RUNNING_THRESHOLD_SECONDS) return session;

  return {
    ...session,
    status: "paused",
    pausedAt: now.toISOString(),
  };
}

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

function createId(now: Date): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${now.getTime()}-${random}`;
}
