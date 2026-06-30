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
