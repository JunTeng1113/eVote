/**
 * 投影用輕柔環境音（Web Audio），免外部音檔授權問題。
 * 低調持續的 pad，適合投票進行中與開票氣氛。
 */

const STORAGE_KEY = "evote-projection-bgm";

export function readProjectionBgmPreference(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  return window.sessionStorage.getItem(STORAGE_KEY) !== "off";
}

export function writeProjectionBgmPreference(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
}

type AmbientEngine = {
  context: AudioContext;
  master: GainNode;
  oscillators: OscillatorNode[];
  lfos: OscillatorNode[];
  started: boolean;
};

let engine: AmbientEngine | null = null;

function ensureEngine(): AmbientEngine | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (engine) {
    return engine;
  }
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) {
    return null;
  }

  const context = new AudioCtx();
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);

  const toneBus = context.createGain();
  toneBus.gain.value = 1;
  toneBus.connect(master);

  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 920;
  filter.Q.value = 0.7;
  filter.connect(toneBus);

  // 柔和 C 大調延伸音：C3 E3 G3 B3 D4（偏明亮但不搶戲）
  const freqs = [130.81, 164.81, 196.0, 246.94, 293.66];
  const oscillators: OscillatorNode[] = [];
  const lfos: OscillatorNode[] = [];

  for (const [index, freq] of freqs.entries()) {
    const osc = context.createOscillator();
    osc.type = index % 2 === 0 ? "sine" : "triangle";
    osc.frequency.value = freq;

    const voiceGain = context.createGain();
    voiceGain.gain.value = 0.045 + (index === 0 ? 0.02 : 0);

    const lfo = context.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.07 + index * 0.018;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 0.018;
    lfo.connect(lfoGain);
    lfoGain.connect(voiceGain.gain);

    osc.connect(voiceGain);
    voiceGain.connect(filter);
    oscillators.push(osc);
    lfos.push(lfo);
  }

  // 極慢的主音量呼吸感（作用在 toneBus，不干擾靜音淡入淡出）
  const breath = context.createOscillator();
  breath.type = "sine";
  breath.frequency.value = 0.05;
  const breathGain = context.createGain();
  breathGain.gain.value = 0.08;
  breath.connect(breathGain);
  breathGain.connect(toneBus.gain);
  lfos.push(breath);

  engine = {
    context,
    master,
    oscillators,
    lfos,
    started: false,
  };
  return engine;
}

function fadeMaster(target: number, seconds = 0.9): void {
  if (!engine) {
    return;
  }
  const { context, master } = engine;
  const now = context.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(target, now + seconds);
}

export async function startProjectionBgm(): Promise<boolean> {
  const current = ensureEngine();
  if (!current) {
    return false;
  }
  if (current.context.state === "suspended") {
    await current.context.resume();
  }
  if (!current.started) {
    for (const osc of current.oscillators) {
      osc.start();
    }
    for (const lfo of current.lfos) {
      lfo.start();
    }
    current.started = true;
  }
  fadeMaster(0.11, 1.1);
  writeProjectionBgmPreference(true);
  return true;
}

export function stopProjectionBgm(): void {
  if (!engine) {
    writeProjectionBgmPreference(false);
    return;
  }
  fadeMaster(0, 0.6);
  writeProjectionBgmPreference(false);
}

export function disposeProjectionBgm(): void {
  if (!engine) {
    return;
  }
  const current = engine;
  engine = null;
  const now = current.context.currentTime;
  current.master.gain.cancelScheduledValues(now);
  current.master.gain.setValueAtTime(0, now);
  for (const osc of current.oscillators) {
    osc.stop();
  }
  for (const lfo of current.lfos) {
    lfo.stop();
  }
  void current.context.close();
}
