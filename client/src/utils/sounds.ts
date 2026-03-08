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

/** Play a dramatic gong sound when someone calls Tichu or Grand Tichu */
export function playGongSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Initial impact noise burst for the "strike"
    const bufferSize = ctx.sampleRate * 0.08;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 1.5;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start(now);

    // Rich layered tones with inharmonic partials (metallic gong character)
    const partials = [
      { freq: 100, gain: 0.25, decay: 3.0, type: 'sine' as OscillatorType },
      { freq: 130.81, gain: 0.20, decay: 2.5, type: 'sine' as OscillatorType },
      { freq: 261.63, gain: 0.10, decay: 2.0, type: 'sine' as OscillatorType },
      { freq: 349.23, gain: 0.06, decay: 1.8, type: 'triangle' as OscillatorType },
      { freq: 523.25, gain: 0.04, decay: 1.2, type: 'sine' as OscillatorType },
      { freq: 698.46, gain: 0.02, decay: 0.8, type: 'sine' as OscillatorType },
    ];

    for (const p of partials) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = p.type;
      osc.frequency.value = p.freq;
      // Slight pitch bend down on attack for gong character
      osc.frequency.setValueAtTime(p.freq * 1.02, now);
      osc.frequency.exponentialRampToValueAtTime(p.freq, now + 0.15);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(p.gain, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + p.decay);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + p.decay + 0.1);
    }

    // Slow amplitude modulation (tremolo) on a mid partial for shimmer
    const shimmerOsc = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    shimmerOsc.type = 'sine';
    shimmerOsc.frequency.value = 220;
    lfo.frequency.value = 6;
    lfoGain.gain.value = 0.04;
    shimmerGain.gain.setValueAtTime(0.08, now);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    lfo.connect(lfoGain);
    lfoGain.connect(shimmerGain.gain);
    shimmerOsc.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    shimmerOsc.start(now);
    lfo.start(now);
    shimmerOsc.stop(now + 2.6);
    lfo.stop(now + 2.6);
  } catch {
    // Audio not available
  }
}
