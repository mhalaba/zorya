import { prefersReducedMotion } from "./lib";

let ctx: AudioContext | null = null;
let sirenTimer: number | null = null;

function audio() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function beep(freq: number, dur: number, gain = 0.07, type: OscillatorType = "sine") {
  const ac = audio();
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(ac.destination);
  const t = ac.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function playWatch() {
  if (prefersReducedMotion()) {
    beep(440, 0.12, 0.04);
    return;
  }
  beep(494, 0.11, 0.06);
  window.setTimeout(() => beep(622, 0.14, 0.05), 140);
}

export function startSiren() {
  stopSiren();
  const pulse = () => {
    beep(680, 0.42, 0.08, "triangle");
    window.setTimeout(() => beep(510, 0.42, 0.08, "triangle"), 430);
  };
  pulse();
  sirenTimer = window.setInterval(pulse, 900);
}

export function stopSiren() {
  if (sirenTimer != null) {
    clearInterval(sirenTimer);
    sirenTimer = null;
  }
}

export function playTest(kind: "watch" | "siren") {
  if (kind === "watch") playWatch();
  else {
    startSiren();
    window.setTimeout(stopSiren, 2600);
  }
}
