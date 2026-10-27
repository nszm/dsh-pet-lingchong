/**
 * 灵宠引擎 —— 今日能量 / 光晕灵气 / 连击心流 / 治愈值 / 本机陪伴日记 / 粒子。
 * ---------------------------------------------------------------------------
 * 从主项目 `src/pets/usePetEngine.ts` 复制。与原版的差别只有 import：
 * `usePersistentState` / `dateKey` 换成本插件自备的精简版（键名不变，
 * 依旧落 `lijing.pet.progress.v1`，与主项目灵宠页共用同一份存档）。
 *   · 今日轻叩、累计轻叩、每只灵宠的陪伴次数、七日心流全部落在本机；
 *   · 陪伴日记由真实轻叩生成（每 6 次一笔）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePersistentState } from '../host/miniStore';
import { dateKey } from '../host/dateKey';
import {
  DYNAMIC_REACTIONS,
  PET_PROGRESS_KEY,
  isPetProgress,
  type Pet,
  type PetLogItem,
  type PetProgress
} from './petData';

export type { PetLogItem };

export interface Particle {
  id: number;
  type: 'chip' | 'emoji' | 'sparkle';
  text?: string;
  left: number;
  top: number;
  tx?: number;
  ty?: number;
  rotStart?: string;
  rotMid?: string;
  rotEnd?: string;
}

const COMBO_WINDOW_MS = 3000;
const MAX_LOG = 6;

let particleId = 0;

const todayKey = (): string => dateKey(new Date());

const clockLabel = (): string => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const freshProgress = (): PetProgress => ({
  date: todayKey(),
  taps: 0,
  totalTaps: 0,
  byPet: {},
  daily: {},
  log: [],
  seq: 0
});

/** 只保留近 14 天，防止 daily 字典无限增长 */
const pruneDaily = (daily: Record<string, number>): Record<string, number> => {
  const keys = Object.keys(daily).sort();
  if (keys.length <= 14) return daily;
  const kept = keys.slice(-14);
  const next: Record<string, number> = {};
  for (const k of kept) next[k] = daily[k];
  return next;
};

export interface PetEngineOptions {
  /** 粒子 / 浮字开关（设置页可关） */
  effects?: boolean;
  /** 飘字心愿文案 */
  blessing?: string;
}

export function usePetEngine(options: PetEngineOptions = {}) {
  const [stored, setStored] = usePersistentState<PetProgress>(
    PET_PROGRESS_KEY,
    freshProgress(),
    isPetProgress
  );

  const effectsRef = useRef(options.effects !== false);
  effectsRef.current = options.effects !== false;
  const blessingRef = useRef(options.blessing ?? DYNAMIC_REACTIONS[0]);
  blessingRef.current = options.blessing ?? DYNAMIC_REACTIONS[0];

  // 跨天时展示层先按「今日 0 次」渲染，落盘由下面的 effect 补齐
  const today = todayKey();
  const progress: PetProgress =
    stored.date === today ? stored : { ...stored, date: today, taps: 0, log: [] };

  const [combo, setCombo] = useState(0);
  const [comboBar, setComboBar] = useState(0);
  const [comboSubtext, setComboSubtext] = useState('静候轻叩');
  const [particles, setParticles] = useState<Particle[]>([]);

  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 跨天归零：只复位今日计数与日记，累计能量 / 图鉴陪伴次数保留
  useEffect(() => {
    if (stored.date !== today) {
      setStored((prev) => ({ ...prev, date: today, taps: 0, log: [] }));
    }
  }, [stored.date, today, setStored]);

  const spawnParticles = useCallback(() => {
    const chipText = blessingRef.current;
    const reaction = DYNAMIC_REACTIONS[Math.floor(Math.random() * DYNAMIC_REACTIONS.length)];

    const newParticles: Particle[] = [];
    // 飘字锚点放在**灵宠头顶上方（卡外）**：负百分比 = 灵宠图顶部之上。
    newParticles.push({
      id: particleId++,
      type: 'chip',
      text: chipText,
      left: 50 + (Math.random() * 8 - 4),
      top: -10
    });
    newParticles.push({
      id: particleId++,
      type: 'emoji',
      text: reaction,
      left: 50 + (Math.random() * 8 - 4),
      top: -14,
      rotStart: `${Math.random() * 10 - 5}deg`,
      rotMid: `${Math.random() * 6 - 3}deg`,
      rotEnd: `${Math.random() * 8 - 4}deg`
    });
    for (let i = 0; i < 5; i++) {
      const angle = (i * 72 + Math.random() * 30) * (Math.PI / 180);
      const dist = 38 + Math.random() * 28;
      newParticles.push({
        id: particleId++,
        type: 'sparkle',
        left: 50,
        top: -10,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);

    const ids = new Set(newParticles.map((p) => p.id));
    window.setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !ids.has(p.id)));
    }, 950);
  }, []);

  const registerInteraction = useCallback(
    (pet: Pet) => {
      const day = todayKey();
      const time = clockLabel();

      setStored((prev) => {
        const base: PetProgress =
          prev.date === day ? prev : { ...prev, date: day, taps: 0, log: [] };
        const taps = base.taps + 1;
        const petTaps = (base.byPet[pet.id] ?? 0) + 1;

        let log = base.log;
        let seq = base.seq;
        if (taps % 6 === 0) {
          const item: PetLogItem = {
            id: seq + 1,
            time,
            pet: pet.label,
            count: taps,
            text: `轻叩 ${taps} 次 · 心流共振`
          };
          log = [item, ...base.log].slice(0, MAX_LOG);
          seq += 1;
        }

        return {
          ...base,
          taps,
          totalTaps: base.totalTaps + 1,
          byPet: { ...base.byPet, [pet.id]: petTaps },
          daily: pruneDaily({ ...base.daily, [day]: taps }),
          log,
          seq
        };
      });

      setCombo((c) => {
        const next = c + 1;
        setComboBar(Math.min(100, (next % 20) * 5));
        setComboSubtext(next > 15 ? '心流巅峰' : '心流共振');
        return next;
      });

      if (effectsRef.current) spawnParticles();

      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(() => {
        setCombo(0);
        setComboBar(0);
        setComboSubtext('静候轻叩');
      }, COMBO_WINDOW_MS);
    },
    [setStored, spawnParticles]
  );

  const resetToday = useCallback(() => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    setCombo(0);
    setComboBar(0);
    setComboSubtext('静候轻叩');
    setParticles([]);
    setStored((prev) => ({
      ...prev,
      date: todayKey(),
      taps: 0,
      log: [],
      daily: { ...prev.daily, [todayKey()]: 0 }
    }));
  }, [setStored]);

  useEffect(() => {
    return () => {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    };
  }, []);

  return {
    merit: progress.taps,
    headerMerit: progress.totalTaps,
    stress: progress.taps * 6,
    combo,
    comboBar,
    comboSubtext,
    healing: Math.min(100, 96 + Math.floor(progress.taps / 12)),
    feed: progress.log,
    particles,
    totalTaps: progress.totalTaps,
    tapsByPet: progress.byPet,
    daily: progress.daily,
    registerInteraction,
    resetToday
  };
}
