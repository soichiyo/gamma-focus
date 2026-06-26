export type SessionStatus = "idle" | "running" | "paused" | "reviewing";

export type FocusDuration = 15 | 25 | 45 | "open";

export type BreakDurationMinutes = 3 | 5 | 10;

export type BreakStatus = "idle" | "running" | "ended";

export type FocusBreakState = {
  status: BreakStatus;
  durationMinutes: BreakDurationMinutes | null;
  startedAt: string | null;
  endedAt: string | null;
  notifiedAt: string | null;
};

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
  breakState: FocusBreakState;
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
