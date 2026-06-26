"use client";

import { AmbientMixer } from "@/components/AmbientMixer";
import { BreakDurationPicker } from "@/components/BreakDurationPicker";
import { BreakTimer } from "@/components/BreakTimer";
import { FocusCheckIn } from "@/components/FocusCheckIn";
import { FocusMissionSetup } from "@/components/FocusMissionSetup";
import { FocusReview } from "@/components/FocusReview";
import { FocusTimer } from "@/components/FocusTimer";
import { MasterVolume } from "@/components/MasterVolume";
import { Player } from "@/components/Player";
import { SessionHistory } from "@/components/SessionHistory";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useFocusSession } from "@/hooks/useFocusSession";
import { usePeripheralTimerEffects } from "@/hooks/usePeripheralTimerEffects";
import { useState } from "react";

export default function Home() {
  const {
    settings,
    runtime,
    togglePlay,
    toggleLayer,
    setLayerVolume,
    setMasterVolume,
    increaseWhiteNoise,
  } = useAudioEngine();

  const focus = useFocusSession();

  const [isBreakPickerVisible, setIsBreakPickerVisible] = useState(false);
  const peripheral = usePeripheralTimerEffects({
    activeSession: focus.activeSession,
    breakRemainingSeconds: focus.breakRemainingSeconds,
    onBreakNotified: focus.markActiveBreakNotified,
  });

  if (!settings || !focus.state) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
      </main>
    );
  }

  const activeSession = focus.activeSession;
  const isReviewing = activeSession?.status === "reviewing";
  const isSessionActive = Boolean(activeSession) && !isReviewing;
  const isBreakActive =
    activeSession?.breakState.status === "running" || activeSession?.breakState.status === "ended";

  return (
    <main className="flex min-h-screen justify-center p-4">
      <div className="flex w-full max-w-[460px] flex-col gap-6 py-6">
        <div className="rounded-2xl bg-[#0A0A0A] p-6">
          <Player isPlaying={runtime.intentToPlay} onTogglePlay={togglePlay} />
        </div>

        {!activeSession && (
          <FocusMissionSetup
            mission={focus.missionDraft}
            duration={focus.durationDraft}
            canStart={focus.canStart}
            onMissionChange={focus.setMissionDraft}
            onDurationChange={focus.setDurationDraft}
            onStart={focus.startSession}
          />
        )}

        {isSessionActive && activeSession && !isBreakActive && (
          <FocusTimer
            session={activeSession}
            elapsedSeconds={focus.elapsedSeconds}
            targetSeconds={focus.targetSeconds}
            onPause={focus.pauseActiveSession}
            onResume={focus.resumeActiveSession}
            onComplete={focus.completeActiveSession}
            onStop={focus.stopActiveSession}
          />
        )}

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

        {focus.isCheckInVisible && (
          <FocusCheckIn
            onSubmit={(response) => {
              const intervention = focus.submitCheckIn(response);
              if (intervention === "increase-white-noise") {
                void increaseWhiteNoise();
              }
              if (intervention === "pause-for-break") {
                setIsBreakPickerVisible(true);
              }
            }}
          />
        )}

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

        {isReviewing && activeSession && (
          <FocusReview
            session={activeSession}
            defaultOutcome={focus.reviewDefaultOutcome}
            onSubmit={focus.submitReview}
          />
        )}

        <div className="flex flex-col gap-6 rounded-2xl bg-[#0A0A0A] p-6">
          <AmbientMixer
            settings={settings}
            runtime={runtime}
            onToggleLayer={toggleLayer}
            onSetLayerVolume={setLayerVolume}
          />

          <div className="h-px bg-zinc-900" />

          <MasterVolume volume={settings.masterVolume} onSetVolume={setMasterVolume} />
        </div>

        <SessionHistory sessions={focus.state.history} />
      </div>
    </main>
  );
}
