// A short two-note "ding" synthesized with Web Audio — no sound file to ship
// or download. Browsers only allow audio after the user has interacted with
// the page once; before that this silently does nothing.

let ctx: AudioContext | null = null;
let lastPlayedAt = 0;
const MIN_GAP_MS = 1500;

export function playMessageSound() {
  const now = Date.now();
  // A burst of messages plays one ding, not a drum roll.
  if (now - lastPlayedAt < MIN_GAP_MS) return;
  lastPlayedAt = now;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const start = ctx.currentTime + 0.01;
    for (const [freq, offset] of [[880, 0], [1318.5, 0.09]] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start + offset);
      gain.gain.linearRampToValueAtTime(0.07, start + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.4);
    }
  } catch {
    // No audio available (old browser, blocked): notifications still show.
  }
}
