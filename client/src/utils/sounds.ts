let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/** Play a gentle two-tone chime to signal it's your turn */
export function playTurnChime(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Two-note ascending chime (E5 → G5)
    const notes = [659.25, 783.99];
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = notes[i];
      gain.gain.setValueAtTime(0, now + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.15 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.5);
    }
  } catch {
    // Audio not available
  }
}

/** Play a soft gong sound when someone calls Tichu or Grand Tichu */
export function playGongSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Low resonant gong: layered sine waves with decay
    const fundamentals = [130.81, 164.81, 261.63]; // C3, E3, C4
    const gains = [0.12, 0.06, 0.04];
    for (let i = 0; i < fundamentals.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = fundamentals[i];
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(gains[i], now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.6);
    }
  } catch {
    // Audio not available
  }
}
