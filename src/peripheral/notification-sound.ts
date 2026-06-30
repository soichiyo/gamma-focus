declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export function playBreakEndedCue(): void {
  try {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextConstructor();
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();

    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.0001;

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.start(now);
    osc.stop(now + 0.5);
    osc.onended = () => {
      void ctx.close();
    };
  } catch {
    // Sound cues are optional. Never break the focus flow for audio failures.
  }
}
