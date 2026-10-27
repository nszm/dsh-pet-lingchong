/**
 * 灵宠 · 桌宠壳（本插件新增的代码）
 * ---------------------------------------------------------------------------
 * 从主项目「灵宠」页 + 桌面灵宠卡（src/components/cards/PetCard.tsx）提炼的
 * 悬浮形态：整只灵宠浮在 `shell.overlay` 座位上，可拖、可叩、可换宠；
 * `sidebar.footer.action` 座位放一枚面板按钮（宿主右键菜单「打开它的面板」
 * 点的就是它，见主项目 src/dsh/float.ts#openPluginPanel 的契约）。
 *
 * 与主项目宿主的分工：
 *   · 数据共用：进度 / 当前宠 / 设置 / 导入灵宠全走 `lijing.pet.*` 与
 *     IndexedDB `lijing-pets`，和主项目灵宠页是同一份存档；
 *   · 摆位私有：位置与显隐存 `dsh-pet-lingchong.*`（百分比坐标，换窗口尺寸不丢）；
 *   · 样式自带：令牌 / 动画 / 工具类全在插件自己的 CSS 里（apply 时注入），
 *     不依赖宿主样式表 —— 桌面透明窗里按材质契约自画高不透明底。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PetFace, useBodyMotion, usePetMood } from './pets/PetFace';
import { PetParticles } from './pets/PetParticles';
import { PetModel3D } from './pets/PetModel3D';
import { loadPetModel, onModelsChanged } from './pets/model3d';
import { usePetEngine } from './pets/usePetEngine';
import { usePetAudio } from './pets/usePetAudio';
import { useAllPets } from './pets/customPets';
import {
  BLESSING_OPTIONS,
  DEFAULT_PET_SETTINGS,
  PET_CURRENT_KEY,
  PET_SCALE_MAX,
  PET_SCALE_MIN,
  PET_SETTINGS_KEY,
  clampPetScale,
  closenessOf,
  isPetId,
  isPetSettings,
  type PetId,
  type PetMood,
  type PetSettings
} from './pets/petData';
import { usePersistentState } from './host/miniStore';
import { dateKey } from './host/dateKey';
import {
  callKeywords,
  linesFor,
  matchChatEvent,
  nextGreeting,
  pickLine,
  type GreetState
} from './pets/persona';
import { useDshChatReplies } from './dshChat';
import { ShadowScope } from '@lj/core';
import { STYLE_ID, STYLE_TEXT } from './style';
import { PetSettingsPage } from './PetSettingsPage';
import { createPortal } from 'react-dom';
import { pipReady, togglePetPip } from './pip';

/* ------------------------------------------------------------------ */
/* 插件私有的摆位存档                                                    */
/* ------------------------------------------------------------------ */

/** 悬浮位置：窗口百分比（左上角基准）。与主项目的画布坐标无关，插件自己一套。 */
interface FloatPos {
  x: number;
  y: number;
}

const POS_KEY = 'dsh-pet-lingchong.pos.v1';
const VIS_KEY = 'dsh-pet-lingchong.visible.v1';
const DEFAULT_POS: FloatPos = { x: 74, y: 38 };

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

const isFloatPos = (v: unknown): v is FloatPos =>
  v != null &&
  typeof v === 'object' &&
  typeof (v as FloatPos).x === 'number' &&
  Number.isFinite((v as FloatPos).x) &&
  typeof (v as FloatPos).y === 'number' &&
  Number.isFinite((v as FloatPos).y);

const clampPct = (v: number) => Math.max(0, Math.min(100, v));

/** 共用的存档状态（悬浮卡与侧栏面板两处用，miniStore 总线保证互相即时可见） */
export function usePetSharedState() {
  const [petId, setPetId] = usePersistentState<PetId>(PET_CURRENT_KEY, 'cat', isPetId);
  const [settings, setSettings] = usePersistentState<PetSettings>(
    PET_SETTINGS_KEY,
    DEFAULT_PET_SETTINGS,
    isPetSettings
  );
  return { petId, setPetId, settings, setSettings };
}

/** 共用的换宠胶囊行（悬浮卡 HUD 与侧栏面板同一套）；compact = 只露头像不露名字 */
export function PetPills({
  petId,
  onPick,
  compact = false
}: {
  petId: PetId;
  onPick: (id: PetId) => void;
  compact?: boolean;
}) {
  const { pets } = useAllPets();
  return (
    <div className="ljp-pills">
      {pets.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`ljp-pill${p.id === petId ? ' is-on' : ''}`}
          onClick={() => onPick(p.id)}
          title={p.tagline}
        >
          <img className="ljp-pill-img" src={p.thumb} alt="" draggable={false} />
          {!compact && <span className="ljp-pill-label">{p.label}</span>}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 悬浮灵宠卡（shell.overlay 座位）                                       */
/* ------------------------------------------------------------------ */

const PET_SIZE = 216; // 卡面宽度 = 灵宠方块边长（px），HUD 跟随卡宽

export function LingPetOverlay() {
  const { petId, setPetId, settings, setSettings } = usePetSharedState();
  const { pets } = useAllPets();
  const pet = pets.find((p) => p.id === petId) ?? pets[0];
  const blessing = BLESSING_OPTIONS.includes(settings.blessing)
    ? settings.blessing
    : BLESSING_OPTIONS[0];
  const engine = usePetEngine({ effects: settings.effects, blessing });
  const { play } = usePetAudio(settings.sound);
  const { mood, blink, emotes } = usePetMood(engine.totalTaps, engine.combo, 'tap', pet.id);

  /* --------------------------------------------- 性格气泡(大肥鱼同款骨架) */
  const [bubble, setBubble] = useState<{ id: number; text: string; prio: number } | null>(null);
  const bubbleRef = useRef(bubble);
  bubbleRef.current = bubble;
  const bubbleIdRef = useRef(0);
  const bubbleHideRef = useRef<number | null>(null);
  const bubbleShownAtRef = useRef(0);
  const showBubble = useCallback((text: string, prio: number) => {
    if (!text) return;
    const now = Date.now();
    const cur = bubbleRef.current;
    if (cur && prio < cur.prio) return; // 不打断更高优先级的话
    if (!cur && prio <= 0 && now - bubbleShownAtRef.current < 3500) return; // 低优先级限流
    const next = { id: ++bubbleIdRef.current, text, prio };
    bubbleShownAtRef.current = now;
    bubbleRef.current = next;
    setBubble(next);
    if (bubbleHideRef.current) window.clearTimeout(bubbleHideRef.current);
    bubbleHideRef.current = window.setTimeout(() => {
      bubbleRef.current = null;
      setBubble(null);
    }, 4600);
  }, []);
  useEffect(
    () => () => {
      if (bubbleHideRef.current) window.clearTimeout(bubbleHideRef.current);
    },
    []
  );

  /* 对话事件的情绪强制(被叫 → 开心,生成中 → 安静陪伴) */
  const [forcedMood, setForcedMood] = useState<PetMood | null>(null);
  const busyRef = useRef(false);
  useEffect(() => {
    if (!forcedMood) return;
    const t = window.setTimeout(() => {
      if (forcedMood === 'content' && busyRef.current) return; // 生成中保持陪伴姿势
      setForcedMood(null);
    }, 5000);
    return () => window.clearTimeout(t);
  }, [forcedMood]);
  const effMood = forcedMood ?? mood;

  /* DSH 对话联动(真 DSH 页生效;主项目空操作):
     回复说完 → 能量 +1 + 面板脉冲 + 陪伴一句;
     被叫名字 / 被夸 → 开心应一句;生成中 → 安静陪伴姿势。 */
  const chatKeywordsRef = useRef<string[]>([]);
  chatKeywordsRef.current = callKeywords(pets.map((p) => p.label));
  /* 交互设置:对话陪伴/见面问候可关(设置面板 + 侧栏面板同源 settings) */
  const chatOn = settings.chatCompanion ?? true;
  const chatOnRef = useRef(chatOn);
  chatOnRef.current = chatOn;
  useDshChatReplies({
    onReply: () => {
      engine.registerInteraction(pet);
      emitChatPulse();
      if (chatOnRef.current) {
        showBubble(pickLine('chat-reply', linesFor(pet.id)['chat-reply']), 1);
      }
    },
    onUserMessage: (text) => {
      if (!chatOnRef.current) return;
      const ev = matchChatEvent(text, chatKeywordsRef.current);
      if (ev === 'called') {
        setForcedMood('joy');
        showBubble(pickLine('chat-called', linesFor(pet.id)['chat-called']), 3);
      } else if (ev === 'praise') {
        setForcedMood('happy');
        showBubble(pickLine('chat-praise', linesFor(pet.id)['chat-praise']), 2);
      }
    },
    onBusyChange: (b) => {
      busyRef.current = b;
      if (!chatOnRef.current) {
        if (!b) setForcedMood(null);
        return;
      }
      if (b) {
        setForcedMood('content');
        showBubble(pickLine('chat-busy', linesFor(pet.id)['chat-busy']), 2);
      } else {
        setForcedMood(null);
      }
    }
  });
  const [visible, setVisible] = usePersistentState<boolean>(VIS_KEY, true, isBool);
  const [savedPos, setSavedPos] = usePersistentState<FloatPos>(POS_KEY, DEFAULT_POS, isFloatPos);

  /* 见面问候:纯函数决策(初次/怕生/重逢/日常),一次挂载只招呼一次(大肥鱼口径) */
  const [greetState, setGreetState] = usePersistentState<GreetState>(
    GREET_KEY,
    { day: '', lastSeenAt: 0 },
    isGreetState
  );
  const greetedRef = useRef(false);
  useEffect(() => {
    if (greetedRef.current || !visible || !pet) return;
    greetedRef.current = true;
    const now = Date.now();
    const { bucket, next } = nextGreeting(greetState, now, engine.totalTaps, dateKey);
    setGreetState(next);
    if (settings.greetBubble ?? true) {
      showBubble(pickLine(bucket, linesFor(pet.id)[bucket]), 3);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, pet]);

  const [dragPos, setDragPos] = useState<FloatPos | null>(null);
  const pos = dragPos ?? savedPos;

  /* 桌面窗形态(宿主把插件单独投到 Windows 桌面 → 独立透明窗)。
   * ⚠ 这是**宿主能力**：只有支持该约定的宿主才会挂 `lj-dsh-desktop-html`
   * (主项目那套 WebView2 壳有；DSH 桌面端 Electron 目前没有,此分支不生效)。
   * 生效时:窗口只有几百 px,按百分比摆位会把 216px 的卡裁掉半只 ⇒ 居中;
   * 挪窗口交给宿主抓手,卡自己不再吃拖拽。 */
  const [deskWin, setDeskWin] = useState(false);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const read = () => setDeskWin(document.documentElement.classList.contains('lj-dsh-desktop-html'));
    read();
    // 宿主在父级 effect 里加类,首帧可能还没加上:盯 class 变化补一次
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  // 拖拽中的最新坐标走 ref：pointerup 的回调永远拿到最后一次 move 的结果
  const dragPosRef = useRef<FloatPos | null>(null);
  dragPosRef.current = dragPos;

  const bodyRef = useRef<HTMLDivElement>(null);
  useBodyMotion(bodyRef, effMood);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const cardRef = useRef<HTMLDivElement>(null);

  const closeness = closenessOf(engine.totalTaps);

  /* 真 3D(2026-10-27):导入的 GLB 灵宠在悬浮卡上也要出真 3D —— 之前这里只有
     <img> 立绘,GLB 只存了占位图,所以「设置页舞台能看见、挂到桌面就没了」。
     与 PetStage 同源同档:model3d 的 glb Blob + 变更广播,换模型即时生效。 */
  const isGlbPet = pet?.mode === 'glb';
  const [modelBlob, setModelBlob] = useState<Blob | null>(null);
  useEffect(() => {
    if (!isGlbPet || !pet) {
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
  }, [isGlbPet, pet?.id]);

  const handleTap = useCallback(() => {
    if (settings.soundOn) play(settings.sound);
    engine.registerInteraction(pet);
    // 打盹时轻叩被吸收(大肥鱼口径:躺平不弹气泡);醒着时每三叩说一句
    if (effMood === 'sleepy' || forcedMood) return;
    tapCounterRef.current += 1;
    if (tapCounterRef.current % 3 === 0) {
      showBubble(pickLine('tap', linesFor(pet.id).tap), 0);
    }
  }, [settings.soundOn, play, engine, pet, effMood, forcedMood, showBubble]);

  /* 连击心流台词:每次连击只说一次 */
  const comboLineShownRef = useRef(false);
  useEffect(() => {
    if (engine.combo >= 10 && !comboLineShownRef.current) {
      comboLineShownRef.current = true;
      showBubble(pickLine('combo', linesFor(pet.id).combo), 1);
    }
    if (engine.combo === 0) comboLineShownRef.current = false;
  }, [engine.combo, pet, showBubble]);

  /* ------------------------------------------------ 拖拽（window 监听 + 6px 阈值）
   * 不用 setPointerCapture：捕获会把后续 click 重定向到 stage，
   * 灵宠按钮的 onClick 永远不触发。改为全程 window 监听：
   * 没挪过 = 原生 click 落在按钮上（轻叩）；挪过 ≥6px = 拖拽，
   * 结束后把紧跟着的那次 click 吞掉（一次拖拽不多算一叩）。
   * 三个 handler 全走 ref（回调恒定），add/remove 才配得上对。 */
  const drag = useRef<{
    id: number;
    startClientX: number;
    startClientY: number;
    startPos: FloatPos;
    moved: boolean;
  } | null>(null);
  const justDraggedRef = useRef(false);
  const tapCounterRef = useRef(0);
  /** 当前缩放倍数（拖拽边界要按「视觉尺寸」算，不能按未缩放的 offsetWidth） */
  const cardScaleRef = useRef(1);

  const onWindowMove = useCallback((e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startClientX;
    const dy = e.clientY - d.startClientY;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    const W = window.innerWidth || 1;
    const H = window.innerHeight || 1;
    const cardEl = cardRef.current;
    const k = cardScaleRef.current || 1;
    const cardW = (cardEl?.offsetWidth ?? PET_SIZE) * k;
    const isDesktopWin = document.documentElement.classList.contains('lj-dsh-desktop-html');
    const cardH = (cardEl?.offsetHeight ?? PET_SIZE + (isDesktopWin ? 0 : 96)) * k;
    const maxX = Math.max(0, ((W - cardW) / W) * 100);
    const maxY = Math.max(0, ((H - cardH) / H) * 100);
    setDragPos({
      x: clampPct(Math.min(maxX, d.startPos.x + (dx / W) * 100)),
      y: clampPct(Math.min(maxY, d.startPos.y + (dy / H) * 100))
    });
  }, []);

  const onWindowUp = useCallback(
    (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      drag.current = null;
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowUp);
      if (d.moved) {
        justDraggedRef.current = true;
        const next = dragPosRef.current;
        if (next) setSavedPos(next);
        setDragPos(null);
        // click 在本次宏任务里派发，之后解除抑制
        window.setTimeout(() => {
          justDraggedRef.current = false;
        }, 0);
      }
    },
    [onWindowMove, setSavedPos]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // 只吃主键；HUD 一带（data-no-drag）不吃拖拽，
      // 灵宠本体（按钮）既是轻叩目标也是拖拽把手
      if (e.button !== 0) return;
      // 桌面窗里不自己挪:卡片居中,挪窗是宿主抓手的事,两边抢指针只会打架
      if (deskWin) return;
      if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
      drag.current = {
        id: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPos: pos,
        moved: false
      };
      window.addEventListener('pointermove', onWindowMove);
      window.addEventListener('pointerup', onWindowUp);
      window.addEventListener('pointercancel', onWindowUp);
    },
    [pos, deskWin, onWindowMove, onWindowUp]
  );

  // 卸载兜底：拖到一半组件没了也要把 window 监听摘干净
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowUp);
    };
  }, [onWindowMove, onWindowUp]);

  /* 敲击：刚拖完的那次 click 不算（不然一次拖拽会多算一叩） */
  const onClickPet = useCallback(() => {
    if (justDraggedRef.current) return;
    handleTap();
  }, [handleTap]);

  /* ------------------------------------------------ 大小（无级 30%–300%）
   * 三处入口共用 settings.petScale，缩放落在「卡根」而不是呼吸/表情那层
   * （那层被 WAAPI 动画占着 transform，写上去会被覆盖）：
   *   ① 悬浮卡上 Ctrl/⌘ + 滚轮 —— 卡面零控件，手势隐形；
   *   ② 侧栏面板滑杆；
   *   ③ 灵宠 → 设置 → 灵宠大小。 */
  const petScale = clampPetScale(settings.petScale);
  const [scaleHint, setScaleHint] = useState(0);
  const scaleHintTimer = useRef<number | null>(null);
  const bumpScale = useCallback(
    (next: number) => {
      const v = clampPetScale(Math.round(next * 100) / 100);
      setSettings((s) => ({ ...s, petScale: v }));
      setScaleHint(v);
      if (scaleHintTimer.current) window.clearTimeout(scaleHintTimer.current);
      scaleHintTimer.current = window.setTimeout(() => setScaleHint(0), 900);
    },
    [setSettings]
  );
  useEffect(
    () => () => {
      if (scaleHintTimer.current) window.clearTimeout(scaleHintTimer.current);
    },
    []
  );
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      // 拦掉宿主/浏览器的整页缩放：这里只缩放灵宠（要非 passive 才拦得住）
      e.preventDefault();
      e.stopPropagation();
      bumpScale(clampPetScale(settings.petScale) - Math.sign(e.deltaY) * 0.05);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // visible：隐藏时组件 return null，cardRef 变空；不加它就会把监听挂在已卸载的节点上
  }, [bumpScale, settings.petScale, visible]);

  /* 桌面窗只有几百 px：按窗口短边给个软上限，免得缩放到 300% 直接糊出画面 */
  const [viewSide, setViewSide] = useState(0);
  useEffect(() => {
    const read = () => setViewSide(Math.min(window.innerWidth || 0, window.innerHeight || 0));
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  const cardScale = deskWin
    ? Math.min(petScale, PET_SCALE_MAX, Math.max(PET_SCALE_MIN, viewSide / PET_SIZE))
    : petScale;
  // 拖拽边界与占位都按视觉尺寸算（offsetWidth 不含 transform）
  cardScaleRef.current = cardScale;

  /* 缩放后把位置夹回可视区：缩小别留白、放大别跑出屏幕 */
  const savedPosRef = useRef(savedPos);
  savedPosRef.current = savedPos;
  useEffect(() => {
    if (deskWin) return;
    const el = cardRef.current;
    if (!el) return;
    const W = window.innerWidth || 1;
    const H = window.innerHeight || 1;
    const maxX = Math.max(0, ((W - el.offsetWidth * cardScale) / W) * 100);
    const maxY = Math.max(0, ((H - el.offsetHeight * cardScale) / H) * 100);
    const p = savedPosRef.current;
    if (p.x > maxX || p.y > maxY) {
      setSavedPos({ x: Math.min(p.x, maxX), y: Math.min(p.y, maxY) });
    }
  }, [cardScale, deskWin, setSavedPos]);

  if (!visible || !pet) return null;

  const isLoaded = loaded[pet.image];

  const themeCls: string = 'lj-light';
  return (
    <ShadowScope
      css={STYLE_TEXT}
      styleId={STYLE_ID}
      themeClass={themeCls}
      hostStyle={{
        /* ⚠ 宿主在 light DOM:shadow 内样式管不到它,定位必须内联(ljp-card 的
           absolute/z-index 曾挂在这里,样式在 shadow 里 ⇒ 全部失效,卡片掉到
           左上角堆叠 —— 2026-10-26 用户实测「更乱」的直接原因)。
           **缩放挂在宿主机上(不是内层卡片)**: transform 会连命中区一起缩,
           卡片的「外框」就等于视觉尺寸 —— 缩到 50% 才能真正贴到屏幕边。
           桌面窗(独立小窗)里居中:窗口比卡还窄一点时,百分比摆位会把灵宠裁掉。 */
        position: 'absolute',
        ...(deskWin ? { left: '50%', top: '50%' } : { left: `${pos.x}%`, top: `${pos.y}%` }),
        width: PET_SIZE,
        transform: deskWin
          ? `translate(-50%, -50%) scale(${cardScale})`
          : `scale(${cardScale})`,
        transformOrigin: deskWin ? 'center center' : 'top left',
        zIndex: 2147481000,
        pointerEvents: 'auto'
      }}
      hostDataset={{ 'ljp-pet': '1' }}
    >
    <div
      ref={cardRef}
      className="ljp-card"
      style={{
        position: 'relative',
        width: '100%'
      }}
    >
      {/* 性格气泡:只说话不挡手(pointer-events 全关,拖拽/轻叩照常穿透) */}
      {bubble && (
        <div key={bubble.id} className="ljp-bubble">
          {bubble.text}
        </div>
      )}


      {/* 灵宠本体 + 粒子层：整块是拖拽把手（window 监听），叩击落在图片按钮上 */}
      <div className="ljp-stage" onPointerDown={onPointerDown}>
        <button
          type="button"
          className="ljp-pet-btn"
          onClick={onClickPet}
          title={`轻叩${pet.label} · 能量 +1`}
        >
          <div className="pet-breathing ljp-breath">
            <div ref={bodyRef} data-pet-mood={effMood} className="ljp-petbox">
              {!modelBlob && !isLoaded && (
                <div className="ljp-loading">
                  <span>灵宠降临中…</span>
                </div>
              )}
              {modelBlob ? (
                /* 悬浮卡的 3D 只做自动转台(interactive=false):整块是拖拽把手,
                   指针留给挪窝/轻叩;要拖拽旋转去舞台页。 */
                <PetModel3D
                  blob={modelBlob}
                  cssScale={cardScale}
                  spin={settings.modelSpin !== false}
                  interactive={false}
                />
              ) : (
                <>
                  <img
                    src={pet.image}
                    alt={pet.label}
                    draggable={false}
                    decoding="async"
                    onLoad={() =>
                      setLoaded((m) => (m[pet.image] ? m : { ...m, [pet.image]: true }))
                    }
                    className="ljp-img"
                  />
                  {isLoaded && <PetFace pet={pet} mood={effMood} blink={blink} emotes={emotes} />}
                </>
              )}
            </div>
          </div>
        </button>
        <PetParticles particles={engine.particles} />
      </div>

      {/* Ctrl + 滚轮调大小时闪一下当前倍率（只读提示，不挡手；桌面窗里显示的是软上限后的实际值） */}
      {scaleHint > 0 && <div className="ljp-scale-hint">{Math.round(cardScale * 100)}%</div>}

      {/* 卡面零控件(用户口径 2026-10-26):换宠/设置/统计都在侧栏「灵宠」完整界面里,
          悬浮态只有灵宠本体 + 悬停显形的收起钮。 */}
    </div>
    </ShadowScope>
  );
}

/* ------------------------------------------------------------------ */
/* 侧栏面板（sidebar.footer.action 座位）                                 */
/* ------------------------------------------------------------------ */

/* 设置页开关:模块级订阅(面板按钮 / 悬浮灵宠都可以打开它) */
const settingsListeners = new Set<() => void>();
let settingsOpenFlag = false;
function setSettingsOpen(v: boolean): void {
  settingsOpenFlag = v;
  settingsListeners.forEach((fn) => fn());
}

/* 见面问候存档(本插件私有;lastSeenAt=0 表示从没见过) */
const GREET_KEY = 'dsh-pet-lingchong.greet.v1';
const isGreetState = (v: unknown): v is GreetState =>
  v != null &&
  typeof v === 'object' &&
  typeof (v as GreetState).day === 'string' &&
  typeof (v as GreetState).lastSeenAt === 'number' &&
  Number.isFinite((v as GreetState).lastSeenAt);

/* 对话陪伴脉冲:一条回复说完,向同页其它座位(侧栏面板)广播一次 */
const chatPulseListeners = new Set<() => void>();
function emitChatPulse(): void {
  chatPulseListeners.forEach((fn) => fn());
}

export function FooterToggle({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  const [open, setOpen] = useState(defaultOpen);
  const [settingsOpen, setLocalSettingsOpen] = useState(settingsOpenFlag);
  useEffect(() => {
    const fn = () => setLocalSettingsOpen(settingsOpenFlag);
    settingsListeners.add(fn);
    return () => {
      settingsListeners.delete(fn);
    };
  }, []);
  const [visible, setVisible] = usePersistentState<boolean>(VIS_KEY, true, isBool);
  const { petId, setPetId, settings, setSettings } = usePetSharedState();
  const engine = usePetEngine({ effects: false });
    /* 对话陪伴仅在真 DSH 页生效(dshChat 同口径) */
  const inDshPage =
    typeof location !== 'undefined' && location.protocol === 'dsh-app:';
  /* 对话陪伴脉冲:一条回复说完,亮 2.5 秒 */
  const [chatPulse, setChatPulse] = useState(false);
  useEffect(() => {
    const fn = () => {
      setChatPulse(true);
      window.setTimeout(() => setChatPulse(false), 2500);
    };
    chatPulseListeners.add(fn);
    return () => {
      chatPulseListeners.delete(fn);
    };
  }, []);

  /* 侧栏面板同进 ShadowScope(2026-10-26):样式只存在于 shadow,light DOM 的
     ljp-* 类早就不挂样式了 —— 面板按钮/弹层全裸的「样式都没有了」即此。 */
  return (
    <ShadowScope
      css={STYLE_TEXT}
      styleId={STYLE_ID}
      themeClass="lj-light"
      hostStyle={{ minWidth: 0, width: '100%' }}
      hostDataset={{ 'ljp-footer': '1' }}
    >
    <div className="ljp-footer">
      <button
        type="button"
        className="ljp-footer-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="灵宠 · 悬浮桌宠面板"
      >
        <span className="ljp-footer-ico" aria-hidden>
          🐾
        </span>
        <span className="ljp-footer-label">灵宠</span>
        <span className={`ljp-footer-dot${visible ? ' is-on' : ''}`} aria-hidden />
      </button>

      {open && (
        <div className="ljp-panel pet-drawer-in" role="dialog" aria-label="灵宠面板">
          <div className="ljp-panel-row">
            <span className="ljp-panel-title">悬浮灵宠</span>
            <button
              type="button"
              className={`ljp-switch${visible ? ' is-on' : ''}`}
              role="switch"
              aria-checked={visible}
              onClick={() => setVisible((v) => !v)}
            >
              {visible ? '在屏' : '隐藏'}
            </button>
          </div>

          <div className="ljp-panel-cap">换一只</div>
          <PetPills petId={petId} onPick={setPetId} />

          {/* 大小：无级 30%–300%。滑杆在面板里，卡面仍然零控件 */}
          <div className="ljp-panel-row">
            <span className="ljp-panel-cap-inline">大小</span>
            <span className="ljp-scale-box">
              <input
                type="range"
                min={Math.round(PET_SCALE_MIN * 100)}
                max={Math.round(PET_SCALE_MAX * 100)}
                step={5}
                value={Math.round(clampPetScale(settings.petScale) * 100)}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, petScale: Number(e.target.value) / 100 }))
                }
                className="ljp-scale-range"
                title="拖动调整灵宠大小（也可以把鼠标放在灵宠上按 Ctrl + 滚轮）"
                aria-label="灵宠大小"
              />
              <span className="ljp-scale-val">{Math.round(clampPetScale(settings.petScale) * 100)}%</span>
            </span>
          </div>

          <div className="ljp-panel-row">
            <span className="ljp-panel-cap-inline">音效</span>
            <button
              type="button"
              className={`ljp-switch${settings.soundOn ? ' is-on' : ''}`}
              role="switch"
              aria-checked={settings.soundOn}
              onClick={() => setSettings((s) => ({ ...s, soundOn: !s.soundOn }))}
            >
              {settings.soundOn ? '开' : '关'}
            </button>
          </div>
          <div className="ljp-panel-row">
            <span className="ljp-panel-cap-inline">飘字特效</span>
            <button
              type="button"
              className={`ljp-switch${settings.effects ? ' is-on' : ''}`}
              role="switch"
              aria-checked={settings.effects}
              onClick={() => setSettings((s) => ({ ...s, effects: !s.effects }))}
            >
              {settings.effects ? '开' : '关'}
            </button>
          </div>

          <div className="ljp-panel-row">
            <span className="ljp-panel-cap-inline">灵宠</span>
            <button
              type="button"
              className="ljp-switch"
              onClick={() => setSettingsOpen(true)}
              title="打开灵宠完整界面(舞台 / 图鉴 / 音效 / 心愿 / 目标 / 进度)"
            >
              打开
            </button>
          </div>
          <div className="ljp-panel-row">
            <span className="ljp-panel-cap-inline">对话陪伴</span>
            <span className="ljp-chat-chip-box">
              <span
                className={`ljp-chat-dot${chatPulse ? ' is-on' : ''}`}
                title={inDshPage ? '回复说完会亮一下' : '仅真 DSH 页生效'}
              />
              <button
                type="button"
                className={`ljp-switch${settings.chatCompanion ?? true ? ' is-on' : ''}`}
                role="switch"
                aria-checked={settings.chatCompanion ?? true}
                onClick={() =>
                  setSettings((s) => ({ ...s, chatCompanion: !(s.chatCompanion ?? true) }))
                }
                title="DSH 每次回复完,灵宠都会应一句(仅真 DSH 页生效)"
              >
                {(settings.chatCompanion ?? true) ? '开' : '关'}
              </button>
            </span>
          </div>
          {pipReady() && (
            <>
              <div className="ljp-panel-row">
                <span className="ljp-panel-cap-inline">弹出小窗</span>
                <button
                  type="button"
                  className="ljp-switch"
                  onClick={() => void togglePetPip()}
                  title="把灵宠弹成一个置顶小窗（视频小窗同款层级，脱离本界面）"
                >
                  弹出
                </button>
              </div>
              <div className="ljp-panel-hint">
                小窗压在所有程序之上，可拖到任何地方；关掉本页面它就收回。
              </div>
            </>
          )}

          <div className="ljp-panel-foot">
            今日 {engine.merit} 叩 · 累计 {engine.totalTaps} · 亲密度 Lv.
            {closenessOf(engine.totalTaps).level}
          </div>
          <div className="ljp-panel-hint">叩它蓄能；拖它挪窝；停上去按 Ctrl + 滚轮调大小。</div>
        </div>
      )}
      {/* 灵宠全屏页挂 body(own ShadowScope + fixed):不进本 shadow,
          免得被侧栏里任何 transform 祖先捕获,把 fixed 当出口到局部坐标系。 */}
      {settingsOpen &&
        (typeof document === 'undefined'
          ? null
          : createPortal(<PetSettingsPage onClose={() => setSettingsOpen(false)} />, document.body))}
    </div>
    </ShadowScope>
  );
}
