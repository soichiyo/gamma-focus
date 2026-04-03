"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine } from "@/audio/audio-engine";
import { LAYER_CATALOG, loadSettings, saveSettings } from "@/audio/constants";
import type { LayerId, PersistedSettings, RuntimeState } from "@/types/audio-state";

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine | null>(null);
  const [settings, setSettings] = useState<PersistedSettings | null>(null);
  const [runtime, setRuntime] = useState<RuntimeState>({
    intentToPlay: false,
    contextState: "suspended",
    layerStatus: Object.fromEntries(LAYER_CATALOG.map((l) => [l.id, "idle"])) as RuntimeState["layerStatus"],
  });

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    if (settings) saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const engine = new AudioEngine({
      onLayerStatusChange: (layerId, status) => {
        setRuntime((prev) => ({
          ...prev,
          layerStatus: { ...prev.layerStatus, [layerId]: status },
        }));
      },
      onContextStateChange: (state) => {
        setRuntime((prev) => ({ ...prev, contextState: state }));
      },
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const togglePlay = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || !settings) return;

    if (engine.isPlaying) {
      engine.stop();
      setRuntime((prev) => ({ ...prev, intentToPlay: false }));
    } else {
      setRuntime((prev) => ({ ...prev, intentToPlay: true }));
      await engine.play(settings);
    }
  }, [settings]);

  const toggleLayer = useCallback(async (layerId: LayerId) => {
    if (!settings) return;
    const newEnabled = !settings.layerSettings[layerId].enabled;
    const newSettings: PersistedSettings = {
      ...settings,
      layerSettings: {
        ...settings.layerSettings,
        [layerId]: { ...settings.layerSettings[layerId], enabled: newEnabled },
      },
    };
    setSettings(newSettings);

    const engine = engineRef.current;
    if (engine?.isPlaying) {
      await engine.toggleLayer(layerId, newEnabled, newSettings.layerSettings[layerId].volume);
    }
  }, [settings]);

  const setLayerVolume = useCallback((layerId: LayerId, volume: number) => {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        layerSettings: {
          ...prev.layerSettings,
          [layerId]: { ...prev.layerSettings[layerId], volume },
        },
      };
    });
    engineRef.current?.setLayerVolume(layerId, volume);
  }, []);

  const setMasterVolume = useCallback((volume: number) => {
    setSettings((prev) => {
      if (!prev) return prev;
      return { ...prev, masterVolume: volume };
    });
    engineRef.current?.setMasterVolume(volume);
  }, []);

  return {
    settings,
    runtime,
    togglePlay,
    toggleLayer,
    setLayerVolume,
    setMasterVolume,
  };
}
