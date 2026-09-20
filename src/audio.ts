/** Notification tones. Alarm is a single tone, never a repeating siren. */

let ctx: AudioContext | null = null;

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

export function playAlarm() {
  beep(880, 0.28, 0.09, "triangle");
  window.setTimeout(() => beep(660, 0.35, 0.08, "triangle"), 160);
}

export function playOstrzezenie() {
  beep(520, 0.16, 0.06);
  window.setTimeout(() => beep(620, 0.18, 0.05), 140);
}

export function playOdwolanie() {
  beep(392, 0.22, 0.05);
}

export function playWatch() {
  playOstrzezenie();
}
