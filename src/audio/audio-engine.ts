import { GAIN_RAMP_TIME, LAYER_CATALOG } from "./constants";
import { BinauralEngine } from "./binaural-engine";
import { AmbientPlayer } from "./ambient-player";
import type { LayerId, PersistedSettings, LayerStatus } from "@/types/audio-state";

export type AudioEngineCallbacks = {
  onLayerStatusChange: (layerId: LayerId, status: LayerStatus) => void;
  onContextStateChange: (state: "suspended" | "running" | "closed") => void;
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private binaural: BinauralEngine | null = null;
  private ambient: AmbientPlayer | null = null;
  private masterGain: GainNode | null = null;
  private callbacks: AudioEngineCallbacks;
  private playing = false;

  constructor(callbacks: AudioEngineCallbacks) {
    this.callbacks = callbacks;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
      this.ctx.onstatechange = () => {
        if (this.ctx) {
          this.callbacks.onContextStateChange(this.ctx.state as "suspended" | "running" | "closed");
        }
      };

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);

      this.binaural = new BinauralEngine(this.ctx);
      this.binaural.output.connect(this.masterGain);

      this.ambient = new AmbientPlayer(this.ctx);
      this.ambient.output.connect(this.masterGain);
    }
    return this.ctx;
  }

  async play(settings: PersistedSettings): Promise<void> {
    const ctx = this.ensureContext();

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const loadPromises = LAYER_CATALOG
      .filter((l) => settings.layerSettings[l.id].enabled)
      .map(async (layer) => {
        this.callbacks.onLayerStatusChange(layer.id, "loading");
        try {
          await this.ambient!.loadBuffer(layer.id, layer.fileName);
          return { id: layer.id, ok: true };
        } catch {
          this.callbacks.onLayerStatusChange(layer.id, "error");
          return { id: layer.id, ok: false };
        }
      });

    const results = await Promise.all(loadPromises);

    this.binaural!.start();

    for (const result of results) {
      if (result.ok) {
        const layerSettings = settings.layerSettings[result.id];
        this.ambient!.startLayer(result.id, layerSettings.volume);
        this.callbacks.onLayerStatusChange(result.id, "playing");
      }
    }

    this.masterGain!.gain.setTargetAtTime(
      settings.masterVolume,
      ctx.currentTime,
      GAIN_RAMP_TIME,
    );

    this.playing = true;
  }

  stop(): void {
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(0, now, GAIN_RAMP_TIME);

    setTimeout(() => {
      this.binaural?.stop();
      this.ambient?.stopAll();

      for (const layer of LAYER_CATALOG) {
        this.callbacks.onLayerStatusChange(layer.id, "idle");
      }

      this.ctx?.suspend();
      this.playing = false;
    }, GAIN_RAMP_TIME * 5 * 1000);
  }

  async toggleLayer(layerId: LayerId, enabled: boolean, volume: number): Promise<void> {
    if (!this.playing || !this.ambient) return;

    if (enabled) {
      this.callbacks.onLayerStatusChange(layerId, "loading");
      try {
        const layer = LAYER_CATALOG.find((l) => l.id === layerId)!;
        await this.ambient.loadBuffer(layerId, layer.fileName);
        this.ambient.startLayer(layerId, volume);
        this.callbacks.onLayerStatusChange(layerId, "playing");
      } catch {
        this.callbacks.onLayerStatusChange(layerId, "error");
      }
    } else {
      this.ambient.stopLayer(layerId);
      this.callbacks.onLayerStatusChange(layerId, "idle");
    }
  }

  setLayerVolume(layerId: LayerId, volume: number): void {
    this.ambient?.setLayerVolume(layerId, volume);
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, GAIN_RAMP_TIME);
    }
  }

  dispose(): void {
    this.binaural?.dispose();
    this.ambient?.dispose();
    this.masterGain?.disconnect();
    this.ctx?.close();
    this.ctx = null;
    this.playing = false;
  }
}
