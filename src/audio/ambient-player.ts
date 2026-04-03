import { AMBIENT_GAIN, GAIN_RAMP_TIME } from "./constants";
import type { LayerId } from "@/types/audio-state";

type LayerInstance = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};

export class AmbientPlayer {
  private ctx: AudioContext;
  private bufferCache = new Map<LayerId, AudioBuffer>();
  private activeInstances = new Map<LayerId, LayerInstance>();
  private layerGains = new Map<LayerId, GainNode>();
  private outputGain: GainNode;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = AMBIENT_GAIN;
  }

  get output(): GainNode {
    return this.outputGain;
  }

  async loadBuffer(layerId: LayerId, fileName: string): Promise<void> {
    if (this.bufferCache.has(layerId)) return;

    const response = await fetch(`/sounds/${fileName}`);
    if (!response.ok) throw new Error(`Failed to load ${fileName}: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.bufferCache.set(layerId, audioBuffer);
  }

  private getOrCreateLayerGain(layerId: LayerId): GainNode {
    let gain = this.layerGains.get(layerId);
    if (!gain) {
      gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.outputGain);
      this.layerGains.set(layerId, gain);
    }
    return gain;
  }

  startLayer(layerId: LayerId, volume: number): void {
    this.stopLayer(layerId);

    const buffer = this.bufferCache.get(layerId);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = this.getOrCreateLayerGain(layerId);
    gain.gain.setTargetAtTime(volume, this.ctx.currentTime, GAIN_RAMP_TIME);
    source.connect(gain);
    source.start();

    source.onended = () => {
      this.activeInstances.delete(layerId);
    };

    this.activeInstances.set(layerId, { source, gain });
  }

  stopLayer(layerId: LayerId): void {
    const instance = this.activeInstances.get(layerId);
    if (!instance) return;

    const now = this.ctx.currentTime;
    instance.gain.gain.setTargetAtTime(0, now, GAIN_RAMP_TIME);

    try {
      instance.source.stop(now + GAIN_RAMP_TIME * 5);
    } catch {
      // Already stopped
    }
    this.activeInstances.delete(layerId);
  }

  setLayerVolume(layerId: LayerId, volume: number): void {
    const instance = this.activeInstances.get(layerId);
    if (instance) {
      instance.gain.gain.setTargetAtTime(volume, this.ctx.currentTime, GAIN_RAMP_TIME);
    }
  }

  stopAll(): void {
    for (const layerId of this.activeInstances.keys()) {
      this.stopLayer(layerId);
    }
  }

  dispose(): void {
    this.stopAll();
    for (const gain of this.layerGains.values()) {
      gain.disconnect();
    }
    this.outputGain.disconnect();
    this.bufferCache.clear();
    this.layerGains.clear();
  }
}
