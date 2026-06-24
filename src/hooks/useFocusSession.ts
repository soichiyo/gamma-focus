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
