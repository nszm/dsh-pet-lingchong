/**
 * 灵宠表情层 —— 叠在预抠图上的 SVG（坐标系 = 原图 1024×1024）。
 * ---------------------------------------------------------------------------
 * · 闭眼 / 眯眼：从眼睛正上方「借」一块灵宠自己的毛（同一张图下移后用柔边椭圆
 *   遮罩裁出来）盖住眼睛，再画一道弧线，毛色和纹理天然一致，不会出现色块；
 * · 眼睑是上下两条逐帧插值的边缘曲线（上眼睑落下 / 下眼睑上推），不是整块淡入；
 * · 腮红、星星眼、头顶表情符号、身体动作（蹦跳 / 歪头 / 打盹 / 惊醒）全部是
 *   叠加层，三只灵宠共用，只依赖 petData 里的五官坐标；
 * · 若该灵宠登记了 AI 表情差分图（Pet.expressions），对应表情直接淡入整张图，
 *   叠加层的五官部分让位。
 */
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import type { InteractionMode, Pet, PetFace as PetFaceData, PetMood } from './petData';
/** 桌面卡片窗标记（主项目宿主专用）：插件场景恒为 false —— 悬浮灵宠在桌面打盹是
 *  桌宠的本分（久不理就睡，一叩就醒），不需要豁免。 */
const IS_DESKTOP_CARD_WINDOW = false;

const SLEEP_AFTER_MS = 30_000;
const EMOTE_GAP_MS = 420;

/** 每种表情停留多久后回到平静 */
const HOLD_MS: Record<PetMood, number> = {
  idle: 0,
  happy: 500,
  joy: 800,
  ecstatic: 1500,
  content: 1400,
  sleepy: 0,
  surprised: 850
};

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

interface Emote {
  id: number;
  glyph: string;
  /** 相对头顶锚点的水平偏移（原图像素） */
  dx: number;
  /** 相对头顶锚点的垂直偏移（原图像素，向下为正） */
  dy: number;
}

let emoteSeq = 0;

/**
 * 表情状态机：pulse 每变一次 = 一次真实互动（含空格、主按钮、自动巡航）。
 * combo 来自引擎的 3 秒连击窗口，决定开心的程度。
 */
export function usePetMood(pulse: number, combo: number, mode: InteractionMode, petId: string) {
  const [mood, setMood] = useState<PetMood>('idle');
  const [blink, setBlink] = useState(false);
  const [emotes, setEmotes] = useState<Emote[]>([]);
  const moodRef = useRef<PetMood>('idle');
  moodRef.current = mood;
  const holdTimer = useRef<number | undefined>(undefined);
  const sleepTimer = useRef<number | undefined>(undefined);
  const lastEmoteAt = useRef(0);
  const firstPulse = useRef(true);

  const emit = (glyph: string, force = false) => {
    const now = Date.now();
    if (!force && now - lastEmoteAt.current < EMOTE_GAP_MS) return;
    lastEmoteAt.current = now;
    // 漫画式耳侧冒泡：落在头部左上，能量气泡从中线往右铺开，两边互不遮挡
    const e: Emote = {
      id: ++emoteSeq,
      glyph,
      dx: -(250 + Math.random() * 110),
      dy: Math.random() * 90
    };
    setEmotes((list) => [...list.slice(-4), e]);
    window.setTimeout(() => setEmotes((list) => list.filter((x) => x.id !== e.id)), 1500);
  };

  const armSleep = () => {
    window.clearTimeout(sleepTimer.current);
    // 桌面卡片窗不打盹：那里几乎收不到互动，30 秒后必然睡着、还没人叫醒，
    // 表现为「桌面上的灵宠眼睛一直睁不开」（2026-10-18 修复）。眨眼照常。
    if (IS_DESKTOP_CARD_WINDOW) return;
    sleepTimer.current = window.setTimeout(() => {
      if (moodRef.current === 'idle') setMood('sleepy');
    }, SLEEP_AFTER_MS);
  };

  const show = (next: PetMood) => {
    setMood(next);
    setBlink(false);
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => setMood('idle'), HOLD_MS[next]);
  };

  // 换宠物：表情归位，重新计时打盹
  useEffect(() => {
    window.clearTimeout(holdTimer.current);
    setMood('idle');
    setEmotes([]);
    armSleep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId]);

  useEffect(() => {
    if (firstPulse.current) {
      firstPulse.current = false;
      return;
    }
    armSleep();
    if (moodRef.current === 'sleepy') {
      show('surprised');
      emit('❗', true);
      return;
    }
    if (mode === 'pet') {
      show('content');
      emit(pick(['💕', '☺️', '🌸', '💗']));
    } else if (combo >= 8) {
      show('ecstatic');
      emit(pick(['🤩', '✨', '🎉', '💫']));
    } else if (combo >= 4) {
      show('joy');
      emit(pick(['💖', '😆', '💕']));
    } else {
      show('happy');
      emit(pick(['🎵', '😊', '✨']));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulse]);

  // 平静时随机眨眼，偶尔连眨两下
  useEffect(() => {
    if (mood !== 'idle') return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        const twice = Math.random() < 0.25;
        setBlink(true);
        window.setTimeout(() => setBlink(false), 140);
        if (twice) {
          window.setTimeout(() => setBlink(true), 300);
          window.setTimeout(() => setBlink(false), 440);
        }
        schedule();
      }, 2600 + Math.random() * 2900);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [mood]);

  useEffect(
    () => () => {
      window.clearTimeout(holdTimer.current);
      window.clearTimeout(sleepTimer.current);
    },
    []
  );

  return { mood, blink, emotes };
}

/* ---------------------------------------------------------------------------
 * 身体动作（作用在图片 + 表情层的共同外壳上）。用 Web Animations 而不是切类名：
 * 每次换表情都从「当前姿态」接着做下一个动作，结束后缓回原位，不会一帧跳回去。
 * ------------------------------------------------------------------------- */
interface Motion {
  origin: string;
  /** 不含起始帧（起始帧 = 当前姿态） */
  frames: Keyframe[];
  duration: number;
  easing?: string;
  /** 循环段（打盹）：先接到起点再无限循环 */
  loop?: boolean;
}

const MOTION: Partial<Record<PetMood, Motion>> = {
  joy: {
    origin: '50% 90%',
    frames: [
      { offset: 0.25, transform: 'rotate(-4deg)' },
      { offset: 0.5, transform: 'rotate(3.5deg)' },
      { offset: 0.75, transform: 'rotate(-2deg)' },
      { offset: 1, transform: 'rotate(0deg)' }
    ],
    duration: 620,
    easing: 'ease-in-out'
  },
  ecstatic: {
    origin: '50% 100%',
    frames: [
      { offset: 0.09, transform: 'translateY(2px) scale(1.06, 0.94)' },
      { offset: 0.21, transform: 'translateY(-18px) scale(0.97, 1.04)' },
      { offset: 0.32, transform: 'translateY(0) scale(1.04, 0.96)' },
      { offset: 0.42, transform: 'translateY(-6px) scale(1, 1)' },
      { offset: 0.5, transform: 'translateY(0) scale(1, 1)' },
      { offset: 0.59, transform: 'translateY(2px) scale(1.06, 0.94)' },
      { offset: 0.71, transform: 'translateY(-18px) scale(0.97, 1.04)' },
      { offset: 0.82, transform: 'translateY(0) scale(1.04, 0.96)' },
      { offset: 0.92, transform: 'translateY(-5px) scale(1, 1)' },
      { offset: 1, transform: 'translateY(0) scale(1, 1)' }
    ],
    duration: 1400,
    easing: 'cubic-bezier(0.37, 0, 0.63, 1)'
  },
  content: {
    origin: '50% 85%',
    frames: [
      { offset: 0.3, transform: 'rotate(-6deg) translateY(2px)' },
      { offset: 0.75, transform: 'rotate(-6deg) translateY(2px)' },
      { offset: 1, transform: 'rotate(0deg) translateY(0)' }
    ],
    duration: 1700,
    easing: 'ease-in-out'
  },
  sleepy: {
    origin: '50% 90%',
    frames: [
      { offset: 0.5, transform: 'rotate(2.5deg) translateY(4px)' },
      { offset: 1, transform: 'rotate(0deg) translateY(0)' }
    ],
    duration: 3600,
    easing: 'ease-in-out',
    loop: true
  },
  surprised: {
    origin: '50% 100%',
    frames: [
      { offset: 0.25, transform: 'translate(0, -14px) scale(1.05, 0.95)' },
      { offset: 0.5, transform: 'translate(0, 0) scale(0.98, 1.02)' },
      { offset: 0.7, transform: 'translate(-4px, 0) scale(1, 1)' },
      { offset: 0.85, transform: 'translate(3px, 0) scale(1, 1)' },
      { offset: 1, transform: 'translate(0, 0) scale(1, 1)' }
    ],
    duration: 600,
    easing: 'ease-out'
  }
};

export function useBodyMotion(ref: RefObject<HTMLElement | null>, mood: PetMood) {
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const from = getComputedStyle(el).transform;
    const start = from === 'none' ? 'matrix(1, 0, 0, 1, 0, 0)' : from;
    el.getAnimations().forEach((a) => a.cancel());
    const m = MOTION[mood];
    if (!m) {
      // 回到平静：从当前姿态缓回原位
      if (from !== 'none') {
        el.animate([{ transform: start }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
      }
      return;
    }
    el.style.transformOrigin = m.origin;
    if (m.loop) {
      const settle = el.animate([{ transform: start }, { transform: 'none' }], {
        duration: from === 'none' ? 1 : 280,
        easing: 'ease-out'
      });
      settle.onfinish = () => {
        el.animate([{ transform: 'none', offset: 0 }, ...m.frames], {
          duration: m.duration,
          easing: m.easing,
          iterations: Infinity
        });
      };
      return () => {
        settle.onfinish = null;
      };
    }
    el.animate([{ transform: start, offset: 0 }, ...m.frames], {
      duration: m.duration,
      easing: m.easing
    });
  }, [ref, mood]);
}

type EyeShape = 'open' | 'blink' | 'smile' | 'relaxed';

const eyeShapeFor = (mood: PetMood, blink: boolean): EyeShape => {
  if (mood === 'happy' || mood === 'joy') return 'smile';
  if (mood === 'content' || mood === 'sleepy') return 'relaxed';
  if (mood === 'idle' && blink) return 'blink';
  return 'open';
};

const BLUSH: Record<PetMood, number> = {
  idle: 0,
  happy: 0.35,
  joy: 0.6,
  ecstatic: 0.6,
  content: 0.55,
  sleepy: 0.2,
  surprised: 0.15
};

/* ---------------------------------------------------------------------------
 * 眼睑：上下两条边缘曲线（二次贝塞尔，端点高度 end + 控制点高度 ctrl，
 * 单位 = 竖向半径，相对眼心）。睁眼时两条线分别躲在眼眶外；闭眼时都收到
 * 同一条「闭合线」上 —— 眯眼笑主要是下眼睑往上推，眨眼 / 打盹主要是上眼睑落下。
 * ------------------------------------------------------------------------- */
interface Lid {
  end: number;
  ctrl: number;
}
interface Lids {
  up: Lid;
  low: Lid;
}

const OPEN_LIDS: Lids = { up: { end: -1.35, ctrl: -1.35 }, low: { end: 1.35, ctrl: 1.35 } };

const SEAM: Record<Exclude<EyeShape, 'open'>, Lid> = {
  smile: { end: 0.28, ctrl: -0.72 }, // ^
  relaxed: { end: -0.08, ctrl: 0.62 }, // ‿
  blink: { end: 0.12, ctrl: 0.38 } // 一道微弯的线
};

const lidsFor = (shape: EyeShape): Lids =>
  shape === 'open' ? OPEN_LIDS : { up: SEAM[shape], low: SEAM[shape] };

/** 合眼时长：眨眼要利落，表情闭眼稍缓；睁眼一律更快 */
const CLOSE_MS: Record<EyeShape, number> = { open: 0, blink: 80, smile: 150, relaxed: 190 };
const OPEN_MS = 65;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixLid = (a: Lid, b: Lid, t: number): Lid => ({
  end: mix(a.end, b.end, t),
  ctrl: mix(a.ctrl, b.ctrl, t)
});

/** 逐帧推进眼睑：任何时刻换目标都从当前位置出发，眨眼中途被打断也不会跳 */
function useLids(shape: EyeShape): Lids {
  const [lids, setLids] = useState<Lids>(OPEN_LIDS);
  const cur = useRef(lids);
  cur.current = lids;

  useEffect(() => {
    const from = cur.current;
    const to = lidsFor(shape);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLids(to);
      return;
    }
    const opening = shape === 'open';
    const dur = opening ? OPEN_MS : CLOSE_MS[shape];
    const ease = opening ? easeOut : easeInOut;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = ease(Math.min(1, (now - t0) / dur));
      setLids({ up: mixLid(from.up, to.up, k), low: mixLid(from.low, to.low, k) });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [shape]);

  return lids;
}

/** 二次曲线中点高度 = (端点 + 控制点) / 2 */
const midOf = (l: Lid) => (l.end + l.ctrl) / 2;

const OPEN_GAP = midOf(OPEN_LIDS.low) - midOf(OPEN_LIDS.up);

/** 闭合程度 0（睁）~ 1（合），由上下眼睑中点的间距换算 */
const closureOf = (l: Lids) => Math.min(1, Math.max(0, 1 - (midOf(l.low) - midOf(l.up)) / OPEN_GAP));

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type Eye = PetFaceData['eyes'][number];

/** 边缘所在高度的眼眶半弦长：越靠近眼顶 / 眼底越短，睑缘不会伸出眼眶 */
const halfChord = (e: Eye, l: Lid) => {
  const h = Math.min(1, Math.abs(midOf(l)));
  return e.r * 0.88 * Math.max(0.3, Math.sqrt(1 - h * h));
};

/** 眼睑遮挡区：上眼睑边缘以上 / 下眼睑边缘以下，两侧水平延伸出眼眶 */
const lidRegion = (e: Eye, l: Lid, side: 'up' | 'low') => {
  const ry = e.ry ?? e.r;
  const w = halfChord(e, l);
  const W = e.r * 1.8;
  const ye = e.y + l.end * ry;
  const yc = e.y + l.ctrl * ry;
  const far = e.y + (side === 'up' ? -2.2 : 2.2) * ry;
  return `M ${e.x - W} ${far} L ${e.x + W} ${far} L ${e.x + W} ${ye} L ${e.x + w} ${ye} Q ${e.x} ${yc} ${e.x - w} ${ye} L ${e.x - W} ${ye} Z`;
};

/** 锥形睫毛线：中间粗、两头尖（上下两条控制点错开 t 得到月牙形） */
const lashPath = (e: Eye, l: Lid, t: number) => {
  const ry = e.ry ?? e.r;
  const w = halfChord(e, l);
  const ye = e.y + l.end * ry;
  const yc = e.y + l.ctrl * ry;
  return `M ${e.x - w} ${ye} Q ${e.x} ${yc - t} ${e.x + w} ${ye} Q ${e.x} ${yc + t} ${e.x - w} ${ye} Z`;
};

const pct = (v: number) => `${(v / 1024) * 100}%`;

interface PetFaceProps {
  pet: Pet;
  mood: PetMood;
  blink: boolean;
  emotes: Emote[];
}

export function PetFace({ pet, mood, blink, emotes }: PetFaceProps) {
  const uid = useId().replace(/:/g, '');
  const { face } = pet;
  const variant = pet.expressions?.[mood];
  const lids = useLids(eyeShapeFor(mood, blink));
  const closure = closureOf(lids);
  // 睑缘按「眼睑压到眼睛上多少」显形：真实睑缘本来就是深色，半合时不会像一刀切的色带；
  // 睁眼位置（眼眶外）则完全隐身，不会浮成一道眉毛
  const upRim = smoothstep(-1.12, -0.7, midOf(lids.up));
  const lowRim = 1 - smoothstep(0.7, 1.12, midOf(lids.low));
  const rimOpacity = Math.max(upRim, lowRim);
  const blush = BLUSH[mood];
  const maxEyeR = Math.max(...face.eyes.map((e) => e.r));

  return (
    <>
      {/* AI 表情差分图：淡入覆盖整只灵宠 */}
      {pet.expressions &&
        Object.entries(pet.expressions).map(([m, src]) => (
          <img
            key={m}
            src={src}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-[11] transition-opacity duration-200"
            style={{ opacity: m === mood ? 1 : 0 }}
          />
        ))}

      <svg
        viewBox="0 0 1024 1024"
        className="absolute inset-0 w-full h-full pointer-events-none z-[12]"
        aria-hidden
      >
        <defs>
          <filter id={`soft-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id={`edge-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          <filter id={`crease-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
          <radialGradient id={`blush-${uid}`}>
            <stop offset="0%" stopColor="#ff6f91" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#ff8fa8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffb3c4" stopOpacity="0" />
          </radialGradient>
          {face.eyes.map((e, i) => (
            <mask id={`wide-${uid}-${i}`} key={`w${i}`}>
              <ellipse
                cx={e.x}
                cy={e.y}
                rx={e.r * 1.5}
                ry={(e.ry ?? e.r) * 1.4}
                fill="#fff"
                filter={`url(#soft-${uid})`}
              />
            </mask>
          ))}
          {face.eyes.map((e, i) => (
            <mask id={`orbit-${uid}-${i}`} key={`o${i}`}>
              <ellipse
                cx={e.x}
                cy={e.y}
                rx={e.r * 1.32}
                ry={(e.ry ?? e.r) * 1.2}
                fill="#fff"
                filter={`url(#soft-${uid})`}
              />
            </mask>
          ))}
          {/* 眼睑遮罩 = 眼眶柔边椭圆 ∩（上眼睑以上 ∪ 下眼睑以下） */}
          {face.eyes.map((e, i) => (
            <mask id={`lid-${uid}-${i}`} key={i}>
              <g mask={`url(#orbit-${uid}-${i})`}>
                <g filter={`url(#edge-${uid})`} fill="#fff">
                  <path d={lidRegion(e, lids.up, 'up')} />
                  <path d={lidRegion(e, lids.low, 'low')} />
                </g>
              </g>
            </mask>
          ))}
        </defs>

        {/* 腮红 */}
        <g style={{ opacity: blush, transition: 'opacity 320ms ease' }}>
          {face.cheeks.map((c, i) => (
            <ellipse key={i} cx={c.x} cy={c.y} rx={c.rx} ry={c.ry} fill={`url(#blush-${uid})`} />
          ))}
        </g>

        {!variant && (
          <>
            {/* 瞪圆眼（被叫醒）：把灵宠自己的眼睛放大，柔边遮罩融进毛里；
                常驻渲染，1 倍时与原图重合不可见，放大 / 回缩都走过渡 */}
            {face.eyes.map((e, i) => (
              <g key={i} mask={`url(#wide-${uid}-${i})`}>
                <image
                  href={pet.image}
                  width={1024}
                  height={1024}
                  preserveAspectRatio="none"
                  className="pet-eye-pop"
                  style={{
                    transformOrigin: `${e.x}px ${e.y}px`,
                    transform: `scale(${mood === 'surprised' ? 1.2 : 1})`
                  }}
                />
              </g>
            ))}

            {/* 眼睑：借眼睛附近的毛盖住眼睛，边缘随上下眼睑逐帧移动 */}
            {closure > 0.002 &&
              face.eyes.map((e, i) => (
                <g key={i} mask={`url(#lid-${uid}-${i})`}>
                  <image
                    href={pet.image}
                    x={-(e.lid?.dx ?? 0)}
                    y={-(e.lid?.dy ?? -e.r * 2.2)}
                    width={1024}
                    height={1024}
                    preserveAspectRatio="none"
                  />
                </g>
              ))}

            {/* 睑缘：上眼睑 = 锥形睫毛线 + 上方一道柔和褶皱阴影；下眼睑 = 一道柔影。
                合拢后两条落在同一条闭合线上 */}
            {rimOpacity > 0.01 && (
              <g>
                {face.eyes.map((e, i) => {
                  const t = Math.max(4.5, e.r * 0.19);
                  const ry = e.ry ?? e.r;
                  const lift = (-t * 1.4) / ry;
                  const crease = { end: lids.up.end + lift, ctrl: lids.up.ctrl + lift };
                  return (
                    <g key={i}>
                      <path
                        d={lashPath(e, crease, t * 0.9)}
                        fill={face.lash}
                        opacity={0.2 * closure}
                        filter={`url(#crease-${uid})`}
                      />
                      <path
                        d={lashPath(e, lids.low, t * 0.45)}
                        fill={face.lash}
                        opacity={0.35 * lowRim}
                        filter={`url(#edge-${uid})`}
                      />
                      <path
                        d={lashPath(e, lids.up, t / 2)}
                        opacity={upRim}
                        fill={face.lash}
                        stroke={face.lash}
                        strokeWidth={t * 0.38}
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                })}
              </g>
            )}

            {/* 星星眼（连击狂喜）：常驻，进出走缩放 + 旋转过渡 */}
            {face.eyes.map((e, i) => {
              // 透视里偏小的那只眼睛也要看得清：星星尺寸取双眼较大者的 90% 兜底
              const r = Math.max(e.r, maxEyeR * 0.9) * 0.78;
              const k = r * 0.26;
              const on = mood === 'ecstatic';
              return (
                <g
                  key={i}
                  className="pet-star-eye"
                  style={{
                    transformOrigin: `${e.x}px ${e.y}px`,
                    transform: on ? 'scale(1) rotate(0deg)' : 'scale(0) rotate(-40deg)',
                    opacity: on ? 1 : 0
                  }}
                >
                  <path
                    d={`M ${e.x} ${e.y - r} L ${e.x + k} ${e.y - k} L ${e.x + r} ${e.y} L ${e.x + k} ${e.y + k} L ${e.x} ${e.y + r} L ${e.x - k} ${e.y + k} L ${e.x - r} ${e.y} L ${e.x - k} ${e.y - k} Z`}
                    fill="#fff8d6"
                    stroke="#ffc81f"
                    strokeWidth={Math.max(2.5, r * 0.08)}
                    strokeLinejoin="round"
                  />
                  <circle cx={e.x + r * 0.62} cy={e.y - r * 0.62} r={Math.max(3, r * 0.14)} fill="#fff" />
                </g>
              );
            })}
          </>
        )}
      </svg>

      {/* 头顶表情符号 */}
      <div
        className="absolute pointer-events-none z-30"
        style={{ left: pct(face.head.x), top: pct(face.head.y) }}
      >
        {emotes.map((e) => (
          <span
            key={e.id}
            className="pet-emote absolute text-2xl leading-none select-none"
            style={{ left: `${(e.dx / 1024) * 100}cqw`, top: `${(e.dy / 1024) * 100}cqw` }}
          >
            {e.glyph}
          </span>
        ))}
        {mood === 'sleepy' && (
          <span className="pet-zzz absolute left-6 -top-2 text-lg font-bold text-sky-500/80 select-none">
            z<span className="text-sm">z</span>
            <span className="text-xs">z</span>
          </span>
        )}
      </div>
    </>
  );
}
