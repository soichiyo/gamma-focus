export type LayerId = "rain" | "white-noise" | "cafe";

export type LayerCatalog = {
  id: LayerId;
  label: string;
  icon: string;
  fileName: string;
};

export type LayerSettings = {
  enabled: boolean;
  volume: number;
};

export type PersistedSettings = {
  version: 1;
  masterVolume: number;
  layerSettings: Record<LayerId, LayerSettings>;
};

export type LayerStatus = "idle" | "loading" | "playing" | "error";

export type RuntimeState = {
  intentToPlay: boolean;
  contextState: "suspended" | "running" | "closed";
  layerStatus: Record<LayerId, LayerStatus>;
};
