import { useEffect } from 'react';

/** Keeps the screen on while a workout is open; re-acquired when the tab is visible again. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let disposed = false;
    const request = async () => {
      try {
        const next = await navigator.wakeLock.request('screen');
        if (disposed) void next.release();
        else lock = next;
      } catch {
        // Not allowed (battery saver, iframe, old browser): the workout works without it.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // ignore
  }
}

let audio: AudioContext | null = null;

/** Call from a user gesture so that the end-of-rest tone may play later. */
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    audio = null;
  }
}

/** A short, soft tone (off by default; YOU → Sound). */
export function softTone() {
  if (!audio) return;
  try {
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  } catch {
    // ignore
  }
}
