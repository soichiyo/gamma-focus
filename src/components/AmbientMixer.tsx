"use client";

import { CloudRain, Waves, Coffee } from "lucide-react";
import { LAYER_CATALOG } from "@/audio/constants";
import type { LayerId, PersistedSettings, RuntimeState } from "@/types/audio-state";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "cloud-rain": CloudRain,
  waves: Waves,
  coffee: Coffee,
};

type AmbientMixerProps = {
  settings: PersistedSettings;
  runtime: RuntimeState;
  onToggleLayer: (layerId: LayerId) => void;
  onSetLayerVolume: (layerId: LayerId, volume: number) => void;
};

export function AmbientMixer({
  settings,
  runtime,
  onToggleLayer,
  onSetLayerVolume,
}: AmbientMixerProps) {
  return (
    <div className="flex flex-col gap-4">
      <span className="font-[family-name:var(--font-geist-mono)] text-[11px] font-semibold tracking-[0.1em] text-zinc-400">
        AMBIENT LAYERS
      </span>
      {LAYER_CATALOG.map((layer) => {
        const layerSettings = settings.layerSettings[layer.id];
        const status = runtime.layerStatus[layer.id];
        const isEnabled = layerSettings.enabled;
        const isError = status === "error";
        const Icon = ICONS[layer.icon];

        return (
          <div
            key={layer.id}
            className="flex items-center gap-3 rounded-xl bg-zinc-900 px-4 py-3"
          >
            {Icon && (
              <Icon
                className={`h-[18px] w-[18px] ${isEnabled ? "text-purple-500" : "text-zinc-600"}`}
              />
            )}
            <span
              className={`text-sm font-medium ${isEnabled ? "text-white" : "text-zinc-400"}`}
            >
              {layer.label}
            </span>
            {isError && (
              <span className="font-[family-name:var(--font-geist-mono)] text-[10px] text-red-400">
                Error
              </span>
            )}
            <div className="flex-1" />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(layerSettings.volume * 100)}
              onChange={(e) => onSetLayerVolume(layer.id, Number(e.target.value) / 100)}
              className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-zinc-800 accent-purple-500 disabled:opacity-30"
              disabled={!isEnabled}
            />
            <button
              onClick={() => onToggleLayer(layer.id)}
              className={`relative flex-shrink-0 h-5 w-9 rounded-full transition-colors ${isEnabled ? "bg-purple-500" : "bg-zinc-800"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full transition-all duration-200 ${isEnabled ? "translate-x-[16px] bg-white" : "translate-x-0 bg-zinc-600"}`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}
