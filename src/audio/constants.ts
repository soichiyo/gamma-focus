import type { LayerCatalog, LayerId, PersistedSettings } from "@/types/audio-state";

export const BASE_FREQ = 200;
export const BEAT_FREQ = 40;

export const BINAURAL_GAIN = 0.3;
export const AMBIENT_GAIN = 0.5;
export const GAIN_RAMP_TIME = 0.02;

export const LAYER_CATALOG: LayerCatalog[] = [
  { id: "rain", label: "Rain", icon: "cloud-rain", fileName: "rain.mp3" },
  { id: "white-noise", label: "White Noise", icon: "waves", fileName: "white-noise.mp3" },
  { id: "cafe", label: "Cafe", icon: "coffee", fileName: "cafe.mp3" },
];

export const DEFAULT_SETTINGS: PersistedSettings = {
  version: 1,
  masterVolume: 0.7,
  layerSettings: {
    rain: { enabled: false, volume: 0.3 },
    "white-noise": { enabled: false, volume: 0.3 },
    cafe: { enabled: false, volume: 0.3 },
  },
};

const STORAGE_KEY = "gamma-focus-settings";

export function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1) return { ...DEFAULT_SETTINGS };

    const layerSettings = {} as PersistedSettings["layerSettings"];
    for (const layer of LAYER_CATALOG) {
      const saved = parsed.layerSettings?.[layer.id];
      layerSettings[layer.id] = {
        enabled: typeof saved?.enabled === "boolean" ? saved.enabled : false,
        volume: typeof saved?.volume === "number" ? Math.max(0, Math.min(1, saved.volume)) : 0.3,
      };
    }

    return {
      version: 1,
      masterVolume: typeof parsed.masterVolume === "number"
        ? Math.max(0, Math.min(1, parsed.masterVolume))
        : 0.7,
      layerSettings,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: PersistedSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage full or unavailable
  }
}
