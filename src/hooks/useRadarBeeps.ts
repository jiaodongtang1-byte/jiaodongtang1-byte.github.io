"use client";

import { useCallback, useEffect, useRef } from "react";
import { beepHz, beepIntervalMs } from "@/src/lib/radar";

const BEEP_MS = 110;
const PEAK_GAIN = 0.16;
const SILENT_INTERVAL_MS = 2_600;

type RadarBeepOptions = {
  active: boolean;
  distanceM: number;
  muted: boolean;
};

/**
 * Proximity beeps for the radar. The AudioContext must be created and resumed
 * from a real user gesture (iOS suspends anything created in a timer callback),
 * so `arm()` is called from the first tap that starts the exploration.
 *
 * The beep loop reads the live distance from a ref instead of restarting on
 * every GPS fix: fixes arrive about once a second, which would otherwise reset
 * the timer before it could ever fire a 2.6 s heartbeat.
 */
export function useRadarBeeps({ active, distanceM, muted }: RadarBeepOptions) {
  const contextRef = useRef<AudioContext | null>(null);
  const distanceRef = useRef(distanceM);
  distanceRef.current = distanceM;

  const arm = useCallback(() => {
    if (typeof window === "undefined") return;
    const Constructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructor) return;
    if (!contextRef.current) contextRef.current = new Constructor();
    void contextRef.current.resume().catch(() => {});
  }, []);

  useEffect(() => {
    if (!active || muted) return;
    let cancelled = false;
    let timer = 0;

    function tick() {
      if (cancelled) return;
      const distance = distanceRef.current;
      const context = contextRef.current;
      if (context && context.state === "running") {
        const hz = beepHz(distance);
        if (hz > 0) {
          const now = context.currentTime;
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(hz, now);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(PEAK_GAIN, now + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + BEEP_MS / 1000);
          oscillator.connect(gain).connect(context.destination);
          oscillator.start(now);
          oscillator.stop(now + BEEP_MS / 1000 + 0.02);
        }
        const vibrate = (navigator as Navigator & { vibrate?: (pattern: number) => boolean })
          .vibrate;
        vibrate?.call(navigator, 18);
      }
      timer = window.setTimeout(tick, beepIntervalMs(distance) || SILENT_INTERVAL_MS);
    }

    timer = window.setTimeout(tick, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active, muted]);

  useEffect(
    () => () => {
      void contextRef.current?.close().catch(() => {});
      contextRef.current = null;
    },
    [],
  );

  return { arm };
}
