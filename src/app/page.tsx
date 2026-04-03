"use client";

import { Player } from "@/components/Player";
import { AmbientMixer } from "@/components/AmbientMixer";
import { MasterVolume } from "@/components/MasterVolume";
import { useAudioEngine } from "@/hooks/useAudioEngine";

export default function Home() {
  const {
    settings,
    runtime,
    togglePlay,
    toggleLayer,
    setLayerVolume,
    setMasterVolume,
  } = useAudioEngine();

  if (!settings) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="flex items-center justify-center min-h-screen p-4">
      <div className="flex w-full max-w-[420px] flex-col gap-8 rounded-2xl bg-[#0A0A0A] p-8">
        <Player
          isPlaying={runtime.intentToPlay}
          onTogglePlay={togglePlay}
        />

        <div className="h-px bg-zinc-900" />

        <AmbientMixer
          settings={settings}
          runtime={runtime}
          onToggleLayer={toggleLayer}
          onSetLayerVolume={setLayerVolume}
        />

        <div className="h-px bg-zinc-900" />

        <MasterVolume
          volume={settings.masterVolume}
          onSetVolume={setMasterVolume}
        />
      </div>
    </main>
  );
}
