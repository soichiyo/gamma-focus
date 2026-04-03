import { BASE_FREQ, BEAT_FREQ, BINAURAL_GAIN, GAIN_RAMP_TIME } from "./constants";

export class BinauralEngine {
  private ctx: AudioContext;
  private oscL: OscillatorNode | null = null;
  private oscR: OscillatorNode | null = null;
  private gainL: GainNode;
  private gainR: GainNode;
  private merger: ChannelMergerNode;
  private outputGain: GainNode;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    this.gainL = ctx.createGain();
    this.gainR = ctx.createGain();
    this.gainL.gain.value = 1;
    this.gainR.gain.value = 1;

    this.merger = ctx.createChannelMerger(2);
    this.gainL.connect(this.merger, 0, 0);
    this.gainR.connect(this.merger, 0, 1);

    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 0;
    this.merger.connect(this.outputGain);
  }

  get output(): GainNode {
    return this.outputGain;
  }

  start(): void {
    this.oscL = this.ctx.createOscillator();
    this.oscL.type = "sine";
    this.oscL.frequency.value = BASE_FREQ;
    this.oscL.connect(this.gainL);

    this.oscR = this.ctx.createOscillator();
    this.oscR.type = "sine";
    this.oscR.frequency.value = BASE_FREQ + BEAT_FREQ;
    this.oscR.connect(this.gainR);

    this.outputGain.gain.setTargetAtTime(BINAURAL_GAIN, this.ctx.currentTime, GAIN_RAMP_TIME);

    this.oscL.start();
    this.oscR.start();
  }

  stop(): void {
    const now = this.ctx.currentTime;
    this.outputGain.gain.setTargetAtTime(0, now, GAIN_RAMP_TIME);

    const stopTime = now + GAIN_RAMP_TIME * 5;
    this.oscL?.stop(stopTime);
    this.oscR?.stop(stopTime);
    this.oscL = null;
    this.oscR = null;
  }

  dispose(): void {
    this.stop();
    this.merger.disconnect();
    this.outputGain.disconnect();
  }
}
