/**
 * 灵宠舞台（液态玻璃主舞台 + 预抠图 + 粒子 + 敲击/抚慰模式 + 空格键交互）——
 * 从 222/project/src/components/PetStage.tsx 百分百复刻。
 * 适配：font-mono → font-pet-mono；导入路径改相对路径；其余逻辑原样。
 * 灵宠图为离线预抠的透明底 webp（public/pets，isnet 抠图 + 色度空间解混
 * 去背景光晕），运行时零推理零外网请求；原先运行时从海外 CDN 拉 176MB 模型
 * 再单线程推理，首屏要等很久。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Gavel, HandHeart, PawPrint, Heart, Loader2, Plus } from 'lucide-react';
import { clampPetScale, type InteractionMode, type Pet } from './petData';
import type { Particle } from './usePetEngine';
import { PetFace, useBodyMotion, usePetMood } from './PetFace';
import { PetParticles } from './PetParticles';
import { PetModel3D } from './PetModel3D';
import { loadPetModel, onModelsChanged } from './model3d';

interface PetStageProps {
  /** 三只常驻 + 用户导入 */
  pets: Pet[];
  petIndex: number;
  /** 打开「导入灵宠」；导入已满时不传 */
  onImport?: () => void;
  onSwitchPet: (i: number) => void;
  mode: InteractionMode;
  onModeChange: (m: InteractionMode) => void;
  onInteract: () => void;
  healing: number;
  blessing: string;
  particles: Particle[];
  /** 累计互动次数：每 +1 驱动一次表情反应 */
  pulse: number;
  combo: number;
  /** 灵宠大小(2.5D 与 3D 统一缩放,1 = 原大) */
  petScale?: number;
  /** 3D 自动转台（设置里的开关） */
  modelSpin?: boolean;
}

export function PetStage({
  pets,
  petIndex,
  onImport,
  onSwitchPet,
  mode,
  onModeChange,
  onInteract,
  healing,
  blessing,
  particles,
  pulse,
  combo,
  petScale = 1,
  modelSpin = true
}: PetStageProps) {
  const pet = pets[petIndex] ?? pets[0];
  /* 灵宠大小：30%–300% 无级，舞台 / 悬浮卡 / 小窗同一份设置 */
  const stageScale = clampPetScale(petScale);
  const { mood, blink, emotes } = usePetMood(pulse, combo, mode, pet.id);
  const bodyRef = useRef<HTMLDivElement>(null);
  useBodyMotion(bodyRef, mood);
  /* 舞台卡 3D 倾斜:指针跟踪 → 透视旋转(尊重 prefers-reduced-motion) */
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const tiltRaf = useRef(0);
  const tiltOK = useRef(true);
  useEffect(() => {
    try {
      tiltOK.current = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      tiltOK.current = true;
    }
    return () => cancelAnimationFrame(tiltRaf.current);
  }, []);
  const onTiltMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!tiltOK.current) return;
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(tiltRaf.current);
    tiltRaf.current = requestAnimationFrame(() => {
      el.style.setProperty('--rx', `${(-py * 4).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${(px * 6).toFixed(2)}deg`);
    });
  }, []);
  const onTiltLeave = useCallback(() => {
    const el = tiltRef.current;
    if (!el) return;
    cancelAnimationFrame(tiltRaf.current);
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }, []);
  const auraRef = useRef<HTMLDivElement>(null);

  /* 真 3D:只有导入的 GLB 灵宠(mode=glb)走 3D 渲染 —— 内置三只与照片导入
     的立绘不受影响(用户口径:不能影响现有的)。 */
  const isGlbPet = pet.mode === 'glb';
  const [modelBlob, setModelBlob] = useState<Blob | null>(null);
  useEffect(() => {
    if (!isGlbPet) {
      setModelBlob(null);
      return;
    }
    let alive = true;
    const check = () => {
      loadPetModel(pet.id).then((b) => {
        if (alive) setModelBlob(b);
      });
    };
    check();
    const off = onModelsChanged(check);
    return () => {
      alive = false;
      off();
    };
  }, [isGlbPet, pet.id]);
  const bounceRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});

  // 全部灵宠一次性预载，切换时直接命中缓存（导入新灵宠后补载）
  useEffect(() => {
    pets.forEach((p) => {
      const img = new Image();
      img.onload = () => setLoaded((m) => (m[p.image] ? m : { ...m, [p.image]: true }));
      img.src = p.image;
    });
  }, [pets]);

  const restartAnim = useCallback((el: HTMLElement | null, animClass: string) => {
    if (!el) return;
    el.classList.remove(animClass);
    void el.offsetWidth;
    el.classList.add(animClass);
  }, []);

  const handleInteract = useCallback(() => {
    restartAnim(bounceRef.current, 'muyu-pet-tap');
    restartAnim(auraRef.current, 'pet-aura-pulse');
    onInteract();
  }, [restartAnim, onInteract]);

  // 空格键监听只挂一次，但必须始终调用最新的交互回调（音效 / 颂钵 / 设置会变）
  const interactRef = useRef(handleInteract);
  interactRef.current = handleInteract;

  // Space key triggers interaction
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // 设置抽屉打开时不穿透
      if (target.closest('[role="dialog"]')) return;
      // 输入控件自己处理空格
      if (
        target.isContentEditable ||
        ['SELECT', 'INPUT', 'TEXTAREA'].includes(target.tagName)
      ) {
        return;
      }
      // 主按钮聚焦时交给原生 click（否则一次空格会敲两下）
      if (target.closest('[data-pet-tap]')) return;
      e.preventDefault();
      interactRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const btnLabel = mode === 'tap' ? '轻叩灵犀 · 能量 +1' : '轻抚治愈 · 心流微澜';
  const subHint = mode === 'tap' ? '轻点灵宠 · 或按空格键蓄能' : '轻点灵宠 · 慢慢呼吸';

  return (
    <div className="lg:col-span-6 flex flex-col gap-4 items-center">
      {/* Stage container — Liquid Glass (iOS 26 refraction) */}
      <div ref={tiltRef} onPointerMove={onTiltMove} onPointerLeave={onTiltLeave} className="liquid-glass liquid-glass-sheen liquid-glass-edge liquid-glass-sweep ljp-tilt w-[85%] max-w-[85%] mx-auto rounded-[2.25rem] will-change-transform p-6 sm:p-7 relative flex flex-col items-center justify-between overflow-hidden min-h-[540px] z-10">
        {/* Color blobs behind the glass give the refraction something to bend */}
        <div className="pet-aurora absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -left-12 w-64 h-64 rounded-full bg-gradient-to-br from-amber-400/70 via-orange-300/50 to-rose-300/40 blur-[60px]" />
          <div className="absolute top-24 -right-16 w-72 h-72 rounded-full bg-gradient-to-br from-teal-400/60 via-sky-400/45 to-indigo-400/30 blur-[70px]" />
          <div className="absolute bottom-[-10%] left-1/4 w-60 h-60 rounded-full bg-gradient-to-br from-fuchsia-400/45 via-rose-400/35 to-amber-300/30 blur-[65px]" />
        </div>

        {/* Top header details — mini glass pills */}
        <div className="w-full flex items-center justify-between relative z-20">
          <div className="liquid-glass flex items-center gap-2 px-3 py-1 rounded-full">
            <Heart className="w-[16px] h-[16px] text-pet-accent-rose" />
            <span className="text-xs font-bold text-pet-charcoal">{pet.label}</span>
          </div>
          <div className="liquid-glass flex items-center gap-1.5 px-3 py-1 rounded-full">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-pet-charcoal font-pet-mono">
              治愈舒缓 <span className="text-pet-accent-teal">{healing}%</span>
            </span>
          </div>
        </div>

        {/* Central stage */}
        <div
          className="relative w-full max-w-[430px] aspect-[4/3.4] flex flex-col items-center justify-center my-2 select-none"
        >
          {/* 地面阴影:立绘落地感(3D),与呼吸同节奏 */}
          <div className="ljp-ground-shadow absolute bottom-[7%] left-1/2 w-[44%] h-[6.5%] rounded-[50%] pointer-events-none" />

          {/* Aura */}
          <div
            ref={auraRef}
            className="absolute w-72 h-72 rounded-full bg-gradient-to-tr from-amber-200/35 via-orange-100/25 to-teal-100/20 blur-3xl pointer-events-none pet-aura-pulse"
          />

          {/* Pet — Liquid Glass panel with strong refraction */}
          <div
            ref={bounceRef}
            onClick={handleInteract}
            className="relative z-10 w-full flex items-center justify-center cursor-pointer muyu-pet-tap"
          >
            <div className="pet-breathing transition-transform duration-300 w-full flex items-center justify-center">
            {/* 缩放挂在这层：里面那层被 useBodyMotion 的 WAAPI 动画占着 transform，
                写在它身上会在眨眼/蹦跳时被动画覆盖回 100% */}
            <div
              className="relative flex items-center justify-center"
              style={{
                transform: `translateY(4%) scale(${stageScale})`,
                transformOrigin: 'bottom center'
              }}
            >
            <div
              ref={bodyRef}
              data-pet-mood={mood}
              className="relative w-60 h-60 sm:w-64 sm:h-64 flex items-center justify-center [container-type:inline-size]"
            >
              {!loaded[pet.image] && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <div className="liquid-glass flex items-center gap-2 px-4 py-2 rounded-full">
                    <Loader2 className="w-4 h-4 text-pet-charcoal animate-spin" />
                    <span className="text-xs font-bold text-pet-charcoal">灵宠降临中…</span>
                  </div>
                </div>
              )}
              {modelBlob ? (
                <PetModel3D blob={modelBlob} cssScale={stageScale} spin={modelSpin} />
              ) : (
                <>
                  <img
                    src={pet.image}
                    alt={`${pet.label}`}
                    decoding="async"
                    onLoad={() => setLoaded((m) => (m[pet.image] ? m : { ...m, [pet.image]: true }))}
                    className="relative w-full h-full object-contain select-none pointer-events-none drop-shadow-2xl z-10"
                  />
                  {loaded[pet.image] && <PetFace pet={pet} mood={mood} blink={blink} emotes={emotes} />}
                </>
              )}
            </div>
            </div>
            </div>
          </div>

          {/* Particles overlay（与桌面灵宠卡共用一套） */}
          <PetParticles particles={particles} />
        </div>

        {/* Mode selector — Liquid Glass capsule */}
        <div className="liquid-glass flex items-center gap-1.5 p-1.5 rounded-full z-20 mb-3 mt-1">
          <button
            onClick={() => onModeChange('tap')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold transition-all ${
              mode === 'tap'
                ? 'shadow-sm bg-pet-solid text-pet-on-solid'
                : 'text-pet-muted hover:text-pet-charcoal hover:bg-pet-stone/60'
            }`}
          >
            <Gavel className="w-[16px] h-[16px]" />
            <span>灵犀敲磬</span>
          </button>
          <button
            onClick={() => onModeChange('pet')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold transition-all ${
              mode === 'pet'
                ? 'shadow-sm bg-pet-solid text-pet-on-solid'
                : 'text-pet-muted hover:text-pet-charcoal hover:bg-pet-stone/60'
            }`}
          >
            <HandHeart className="w-[16px] h-[16px] text-pet-accent-amber" />
            <span>抚慰身心</span>
          </button>
        </div>

        {/* Primary action button */}
        <button
          onClick={handleInteract}
          data-pet-tap
          className="w-full max-w-sm py-3.5 px-6 rounded-full bg-pet-solid text-pet-on-solid font-pet-mono font-bold text-sm tracking-wide shadow-[0_8px_24px_rgba(0,0,0,0.16)] border border-pet-on-solid/15 hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2.5 z-20 cursor-pointer"
        >
          {mode === 'tap' ? (
            <PawPrint className="w-[18px] h-[18px] text-pet-on-solid-accent" />
          ) : (
            <HandHeart className="w-[18px] h-[18px] text-pet-on-solid-accent" />
          )}
          <span>{btnLabel}</span>
        </button>
        <span className="text-[10px] text-pet-muted font-pet-mono tracking-widest uppercase mt-2 z-20">
          {subHint}
        </span>
      </div>

      {/* Pet shelf — compact glass selector pills */}
      <div className="w-full flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 z-10">
        {pets.map((p, i) => (
          <button
            key={p.id}
            onClick={() => onSwitchPet(i)}
            className={`group relative flex items-center gap-2.5 pl-2 pr-3.5 py-1.5 rounded-full border transition-all duration-300 cursor-pointer backdrop-blur-md ${
              i === petIndex
                ? 'bg-pet-solid border-pet-solid text-pet-on-solid shadow-[0_6px_20px_rgba(0,0,0,0.18)] scale-[1.03]'
                : 'liquid-glass border-pet-rim text-pet-charcoal hover:border-amber-300/70 hover:shadow-[0_4px_14px_rgba(212,175,55,0.15)]'
            }`}
          >
            <span
              className={`relative w-8 h-8 rounded-full overflow-hidden shrink-0 border transition-colors ${
                i === petIndex ? 'border-pet-rim-soft' : 'border-pet-rim'
              }`}
            >
              <img className="w-full h-full object-cover" src={p.thumb} alt={p.label} />
            </span>
            <span className="flex flex-col items-start leading-none">
              <span className="text-[11px] font-bold tracking-wide">{p.label}</span>
              <span
                className={`text-[8px] font-pet-mono mt-0.5 tracking-widest ${
                  i === petIndex ? 'text-pet-on-solid-accent' : 'text-pet-muted'
                }`}
              >
                {p.edition}
              </span>
            </span>
            {i === petIndex && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-pet-surface shadow-sm" />
            )}
          </button>
        ))}
        {onImport && (
          <button
            onClick={onImport}
            data-pet-import
            aria-label="导入灵宠"
            className="liquid-glass w-11 h-11 rounded-full grid place-items-center border border-dashed border-pet-rim text-pet-charcoal hover:border-amber-300/70 hover:shadow-[0_4px_14px_rgba(212,175,55,0.15)] transition-all cursor-pointer"
            title="导入灵宠:图片=2.5D 立绘,GLB=真 3D · 最多 5 只"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
