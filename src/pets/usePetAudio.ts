/**
 * Web Audio 禅音引擎 —— 从 222/project/src/hooks/usePetAudio.ts 百分百复刻。
 * 全部声音由振荡器实时合成，无音频素材下载。
 */
import { useCallback, useEffect, useRef } from 'react';
import type { SoundType } from './petData';

export function usePetAudio(initialSound: SoundType = 'wood') {
  const ctxRef = useRef<AudioContext | null>(null);
  const soundRef = useRef<SoundType>(initialSound);

  const initAudio = useCallback(() => {
    if (!ctxRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new Ctor();
    }
    if (ctxRef.current.state === 'suspended') {
      void ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const playWood = useCallback((ctx: AudioContext) => {
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const base = 680 + (Math.random() * 30 - 15);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(base, now);
    osc1.frequency.exponentialRampToValueAtTime(310, now + 0.12);
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(base * 2.3, now);
    osc2.frequency.exponentialRampToValueAtTime(base * 0.9, now + 0.05);
    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.28);
    osc2.stop(now + 0.06);
  }, []);

  const playCrystal = useCallback((ctx: AudioContext) => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.45);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }, []);

  const playPop = useCallback((ctx: AudioContext) => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(560, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.07);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }, []);

  const playMeow = useCallback((ctx: AudioContext) => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.linearRampToValueAtTime(980, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.24);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }, []);

  const play = useCallback(
    (type?: SoundType) => {
      const ctx = initAudio();
      if (!ctx) return;
      const t = type ?? soundRef.current;
      switch (t) {
        case 'wood':
          playWood(ctx);
          break;
        case 'crystal':
          playCrystal(ctx);
          break;
        case 'pop':
          playPop(ctx);
          break;
        case 'meow':
          playMeow(ctx);
          break;
      }
    },
    [initAudio, playWood, playCrystal, playPop, playMeow]
  );

  const setSound = useCallback((type: SoundType) => {
    soundRef.current = type;
  }, []);

  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  return { play, setSound };
}
