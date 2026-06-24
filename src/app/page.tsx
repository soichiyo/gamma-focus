"use client";

import { AmbientMixer } from "@/components/AmbientMixer";
import { FocusCheckIn } from "@/components/FocusCheckIn";
import { FocusMissionSetup } from "@/components/FocusMissionSetup";
import { FocusReview } from "@/components/FocusReview";
import { FocusTimer } from "@/components/FocusTimer";
import { MasterVolume } from "@/components/MasterVolume";
import { Player } from "@/components/Player";
import { SessionHistory } from "@/components/SessionHistory";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useFocusSession } from "@/hooks/useFocusSession";

export default function Home() {
  const {
    settings,
    runtime,
    togglePlay,
    toggleLayer,
    setLayerVolume,
    setMasterVolume,
  } = useAudioEngine();

  const focus = useFocusSession();

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

        {isSessionActive && activeSession && (
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

        {focus.isCheckInVisible && (
          <FocusCheckIn
            onSubmit={(response) => {
              focus.submitCheckIn(response);
            }}
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
