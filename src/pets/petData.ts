/**
 * 灵宠 · 静态数据与存档契约
 * ---------------------------------------------------------------------------
 * 从主项目 `src/pets/petData.ts` 复制。与原版的差别只有一处：
 * 三只常驻灵宠的图片改为**构建期内联**（esbuild dataurl loader）—— DSH 插件
 * 的资源走 `/<id>/assets/…` 需要宿主服务端半边或资源桥改写，内联成 data:
 * URI 之后两边（主项目兼容层 / 真 DSH）都零依赖可用，也免去预载竞态。
 * 品牌口径：本页只叫「灵宠」，不出现任何旧品牌词。
 */
import catImg from '../assets/pets/cat.webp';
import dogImg from '../assets/pets/dog.webp';
import capybaraImg from '../assets/pets/capybara.webp';
import catThumb from '../assets/pets/cat-thumb.jpg';
import dogThumb from '../assets/pets/dog-thumb.jpg';
import capybaraThumb from '../assets/pets/capybara-thumb.jpg';

export type BuiltinPetId = 'cat' | 'dog' | 'capybara';
/** 用户导入的灵宠（见 customPets.ts）：id 一律 custom- 前缀 */
export type CustomPetId = `custom-${string}`;
export type PetId = BuiltinPetId | CustomPetId;
export type InteractionMode = 'tap' | 'pet';
/** 页面两个真实页签：敲击舞台 / 灵宠图鉴 */
export type PetTab = 'bless' | 'gallery';

/**
 * 灵宠表情：
 *   idle 平静（随机眨眼） · happy 眯眼笑 · joy 眯眼 + 腮红 + 爱心 ·
 *   ecstatic 连击狂喜（星星眼 + 蹦跳） · content 抚慰时闭眼享受 ·
 *   sleepy 久未互动打盹 · surprised 被叫醒
 */
export type PetMood = 'idle' | 'happy' | 'joy' | 'ecstatic' | 'content' | 'sleepy' | 'surprised';

/** 五官坐标，单位为原图像素（1024×1024 方图），由叠加层换算成百分比 */
export interface PetFace {
  eyes: {
    x: number;
    y: number;
    r: number;
    /** 竖向半径（透视里竖长的眼睛），缺省 = r */
    ry?: number;
    /** 眼睑借毛的来源偏移（相对眼心），缺省取正上方 (0, -2.2r)；眼睛贴着轮廓时改向内借 */
    lid?: { dx: number; dy: number };
  }[];
  cheeks: { x: number; y: number; rx: number; ry: number }[];
  /** 头顶表情符号的锚点 */
  head: { x: number; y: number };
  /** 眯眼 / 闭眼弧线颜色 */
  lash: string;
}

export interface Pet {
  id: PetId;
  /** 图鉴编号 */
  serial: string;
  edition: string;
  label: string;
  /** 预抠图（透明底 webp），主舞台直接使用 */
  image: string;
  /** 原图缩略（选择胶囊 / 图鉴用） */
  thumb: string;
  rarity: string;
  rarityClass: string;
  element: string;
  /** 图鉴题签：一句话记住这只灵宠 */
  tagline: string;
  personality: string;
  traits: string[];
  /** 图鉴三维：治愈 / 萌力 / 灵性 */
  attrs: { healing: number; charm: number; spirit: number };
  story: string;
  /** 图鉴主视觉的底色（Tailwind 静态类，勿拼字符串） */
  glow: string;
  /** 选中态的描边色 */
  ring: string;
  face: PetFace;
  /**
   * AI 表情差分图（同机位、透明底，与 image 同尺寸）。有则该表情直接换图，
   * 没有就用叠加层画表情；放进 public/pets/ 后在这里登记即可。
   */
  expressions?: Partial<Record<PetMood, string>>;
  /**
   * 呈现模式:photo = 2.5D 立绘(内置三只 + 照片导入);glb = 真 3D 模型
   * (用户导入 GLB 的灵宠,舞台走 PetModel3D)。缺省按 photo 处理。
   */
  mode?: 'photo' | 'glb';
}

export const PETS: Pet[] = [
  {
    id: 'cat',
    serial: 'NO.01',
    edition: 'EDITION NO.01',
    label: '奶桃布偶猫',
    image: catImg,
    thumb: catThumb,
    rarity: '典藏',
    rarityClass: 'bg-pet-tint-rose text-pet-accent-rose border-pet-tint-rose-line',
    element: '柔光',
    tagline: '把一整天的疲惫，窝成一颗奶桃。',
    personality: '慢热 · 黏人 · 午后必睡',
    traits: ['呼噜共振', '软垫踩奶', '暖光陪睡'],
    attrs: { healing: 96, charm: 93, spirit: 88 },
    story:
      '从云端绒毯上走下来的第一只灵宠。它不擅长讲道理，只擅长在你坐下的时候，恰好把脑袋搁在你手边。轻叩三下，它会用尾巴绕住你的手腕，像在说：可以慢一点。',
    glow: 'from-rose-200/70 via-orange-100/60 to-amber-100/50',
    ring: 'ring-rose-300',
    face: {
      eyes: [
        { x: 429, y: 380, r: 46 },
        { x: 603, y: 380, r: 46 }
      ],
      cheeks: [
        { x: 392, y: 470, rx: 50, ry: 30 },
        { x: 636, y: 470, rx: 50, ry: 30 }
      ],
      head: { x: 516, y: 150 },
      lash: '#6b3b26'
    }
  },
  {
    id: 'dog',
    serial: 'NO.02',
    edition: 'EDITION NO.02',
    label: '阳光小金毛',
    image: dogImg,
    thumb: dogThumb,
    rarity: '珍稀',
    rarityClass: 'bg-pet-tint-amber text-pet-accent-amber border-pet-tint-amber-line',
    element: '暖阳',
    tagline: '你一回头，它就把尾巴摇成一小片太阳。',
    personality: '热烈 · 直球 · 永远在等你',
    traits: ['阳光追随', '叼球返场', '情绪补给'],
    attrs: { healing: 91, charm: 98, spirit: 84 },
    story:
      '如果你今天过得很糟，它会假装什么都没发生，只是把球放在你脚边，然后退后两步，眼睛亮亮地看着你。它相信所有坏情绪，都能被一次散步解决。',
    glow: 'from-amber-200/70 via-yellow-100/60 to-orange-100/50',
    ring: 'ring-amber-300',
    face: {
      eyes: [
        { x: 436, y: 263, r: 27 },
        { x: 591, y: 267, r: 27 }
      ],
      cheeks: [
        { x: 398, y: 392, rx: 40, ry: 24 },
        { x: 626, y: 392, rx: 40, ry: 24 }
      ],
      head: { x: 513, y: 105 },
      lash: '#4f2a16'
    }
  },
  {
    id: 'capybara',
    serial: 'NO.03',
    edition: 'EDITION NO.03',
    label: '水豚卡皮巴拉',
    image: capybaraImg,
    thumb: capybaraThumb,
    rarity: '稀有',
    rarityClass: 'bg-pet-tint-teal text-pet-accent-teal border-pet-tint-teal-line',
    element: '静水',
    tagline: '世界很吵，它把心放平。',
    personality: '松弛 · 稳定 · 万物皆可搭',
    traits: ['水面发呆', '情绪稳定', '温泉常驻'],
    attrs: { healing: 99, charm: 86, spirit: 95 },
    story:
      '它从一条很慢的河里来。无论你敲得多急，它都只是眨一下眼，再把下巴放回水面。看着它，呼吸会自己慢下来 —— 这是它唯一擅长、也做得最好的事。',
    glow: 'from-teal-200/70 via-emerald-100/60 to-lime-100/50',
    ring: 'ring-teal-300',
    face: {
      eyes: [
        { x: 371, y: 372, r: 21, ry: 28, lid: { dx: 30, dy: -62 } },
        { x: 578, y: 377, r: 30 }
      ],
      cheeks: [
        { x: 382, y: 468, rx: 38, ry: 22 },
        { x: 612, y: 430, rx: 40, ry: 24 }
      ],
      head: { x: 560, y: 140 },
      lash: '#43261a'
    }
  }
];

export const BLESSING_OPTIONS = [
  '能量 +1 · 心念澄明',
  '澄心静气 · 万籁俱寂',
  '心流微澜 · 灵光乍现',
  '焦虑消散 · 轻盈自在',
  '萌力爆棚 · 元气满格',
  '治愈 +99 · 温柔相伴',
  '福泽绵长 · 灵宠相守'
];

export const DYNAMIC_REACTIONS = [
  '能量 +1 · 心神宁静',
  '澄心静气 · 灵台清朗',
  '心流微澜 · 灵光乍现',
  '焦虑消散 · 萌力满格',
  '万籁澄净 · 福气连绵'
];

export const SOUND_TYPES = ['wood', 'crystal', 'pop', 'meow'] as const;
export type SoundType = (typeof SOUND_TYPES)[number];

export const SOUND_LABELS: Record<SoundType, string> = {
  wood: '温润玉木',
  crystal: '水晶磬音',
  pop: '黏土啵啵',
  meow: '纯净灵呢'
};

export const SOUND_HINTS: Record<SoundType, string> = {
  wood: '低回的木质感，适合长时间轻叩',
  crystal: '清亮的磬声，尾音会慢慢散开',
  pop: '轻软的啵啵声，像捏了一下云',
  meow: '一声短短的灵宠回应'
};

/* ------------------------------------------------------------------ */
/* 设置                                                                */
/* ------------------------------------------------------------------ */

export interface PetSettings {
  sound: SoundType;
  /** 互动音效总开关 */
  soundOn: boolean;
  mode: InteractionMode;
  blessing: string;
  /** 自动巡航间隔（毫秒） */
  autoSpeed: number;
  /** 粒子与浮字特效 */
  effects: boolean;
  /** 每 100 次轻叩的颂钵轻鸣 */
  bell: boolean;
  /** 今日能量目标 */
  goal: number;
  /** 对话陪伴:DSH 回复完成时灵宠应一句(缺省开,旧存档无此字段) */
  chatCompanion?: boolean;
  /** 见面问候气泡(缺省开,旧存档无此字段) */
  greetBubble?: boolean;
  /** 灵宠大小(悬浮卡 / 舞台 / 小窗统一缩放,1 = 原大;0.3~3) */
  petScale?: number;
  /** 3D 模型自动转台(缺省开,旧存档无此字段) */
  modelSpin?: boolean;
}

/** 灵宠大小可调范围(悬浮卡 Ctrl+滚轮、侧栏面板与设置页共用同一口径) */
export const PET_SCALE_MIN = 0.3;
export const PET_SCALE_MAX = 3;

/** 把任意来源的倍率夹到合法区间;非法值回落到 1(原大) */
export function clampPetScale(v?: number | null): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 1;
  return Math.min(PET_SCALE_MAX, Math.max(PET_SCALE_MIN, n));
}

export const PET_SETTINGS_KEY = 'lijing.pet.settings.v1';
/** 当前上舞台的灵宠（跨刷新保留） */
export const PET_CURRENT_KEY = 'lijing.pet.pet.v1';

export const isCustomPetId = (v: unknown): v is CustomPetId =>
  typeof v === 'string' && /^custom-[a-z0-9]{4,24}$/.test(v);

export const isPetId = (v: unknown): v is PetId =>
  v === 'cat' || v === 'dog' || v === 'capybara' || isCustomPetId(v);

export const DEFAULT_PET_SETTINGS: PetSettings = {
  sound: 'wood',
  soundOn: true,
  mode: 'tap',
  blessing: BLESSING_OPTIONS[0],
  autoSpeed: 1000,
  effects: true,
  bell: true,
  goal: 108,
  chatCompanion: true,
  greetBubble: true,
  petScale: 1,
  modelSpin: true
};

export const GOAL_OPTIONS = [108, 300, 500, 1000];
export const AUTO_SPEED_OPTIONS = [
  { value: 2000, label: '慢 · 2 秒' },
  { value: 1500, label: '标准 · 1.5 秒' },
  { value: 1000, label: '快 · 1 秒' }
];

export function isPetSettings(v: unknown): v is PetSettings {
  if (v == null || typeof v !== 'object') return false;
  const s = v as Partial<PetSettings>;
  return (
    typeof s.sound === 'string' &&
    SOUND_TYPES.includes(s.sound as SoundType) &&
    typeof s.soundOn === 'boolean' &&
    (s.mode === 'tap' || s.mode === 'pet') &&
    typeof s.blessing === 'string' &&
    typeof s.autoSpeed === 'number' &&
    Number.isFinite(s.autoSpeed) &&
    typeof s.effects === 'boolean' &&
    typeof s.bell === 'boolean' &&
    typeof s.goal === 'number' &&
    GOAL_OPTIONS.includes(s.goal) &&
    (s.modelSpin == null || typeof s.modelSpin === 'boolean') &&
    (s.petScale == null ||
      (typeof s.petScale === 'number' &&
        Number.isFinite(s.petScale) &&
        s.petScale >= PET_SCALE_MIN &&
        s.petScale <= PET_SCALE_MAX))
  );
}

/* ------------------------------------------------------------------ */
/* 本机进度                                                            */
/* ------------------------------------------------------------------ */

export interface PetLogItem {
  id: number;
  time: string;
  pet: string;
  count: number;
  text: string;
}

export interface PetProgress {
  /** 进度所属日期（YYYY-MM-DD），跨天自动归零今日计数 */
  date: string;
  /** 今日轻叩次数 = 今日能量 */
  taps: number;
  /** 累计轻叩次数 = 能量池 */
  totalTaps: number;
  /** 每只灵宠的累计陪伴次数（不随日期归零） */
  byPet: Record<string, number>;
  /** 按日归档的轻叩次数（七日心流图） */
  daily: Record<string, number>;
  /** 今日陪伴日记（最多 6 条） */
  log: PetLogItem[];
  /** 日记自增序号 */
  seq: number;
}

export const PET_PROGRESS_KEY = 'lijing.pet.progress.v1';

export function isPetProgress(v: unknown): v is PetProgress {
  if (v == null || typeof v !== 'object') return false;
  const p = v as Partial<PetProgress>;
  return (
    typeof p.date === 'string' &&
    typeof p.taps === 'number' &&
    typeof p.totalTaps === 'number' &&
    typeof p.byPet === 'object' &&
    p.byPet != null &&
    typeof p.daily === 'object' &&
    p.daily != null &&
    Array.isArray(p.log) &&
    typeof p.seq === 'number'
  );
}

/* ------------------------------------------------------------------ */
/* 段位 / 亲密度                                                        */
/* ------------------------------------------------------------------ */

const RANKS = [
  { min: 0, label: 'Lv.1 初遇' },
  { min: 60, label: 'Lv.2 相伴' },
  { min: 200, label: 'Lv.3 灵犀' },
  { min: 600, label: 'Lv.4 琉光' },
  { min: 1500, label: 'Lv.5 澄明' }
];

export function rankLabel(totalTaps: number): string {
  let label = RANKS[0].label;
  for (const r of RANKS) if (totalTaps >= r.min) label = r.label;
  return label;
}

/** 亲密度阈值：Lv.1~Lv.5 */
export const CLOSENESS_LEVELS = [0, 30, 100, 250, 500];

export function closenessOf(taps: number): {
  level: number;
  progress: number;
  next: number | null;
  remain: number;
} {
  let level = 1;
  for (let i = 0; i < CLOSENESS_LEVELS.length; i++) {
    if (taps >= CLOSENESS_LEVELS[i]) level = i + 1;
  }
  const currentMin = CLOSENESS_LEVELS[level - 1] ?? 0;
  const nextMin = CLOSENESS_LEVELS[level] ?? null;
  const progress =
    nextMin == null ? 100 : Math.round(((taps - currentMin) / (nextMin - currentMin)) * 100);
  return {
    level,
    progress: Math.max(0, Math.min(100, progress)),
    next: nextMin,
    remain: nextMin == null ? 0 : Math.max(0, nextMin - taps)
  };
}

export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
