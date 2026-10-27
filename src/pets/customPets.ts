/**
 * 自定义灵宠（用户导入）· 存档与读取
 * ---------------------------------------------------------------------------
 * 从主项目 `src/pets/customPets.ts` 复制。与原版的差别只有 import：
 * `usePersistentState` 换成本插件自备的精简版（键名不变）。
 * 在主项目里导入过的灵宠（IndexedDB `lijing-pets/images`）这里直接读得到 ——
 * 同源同库，悬浮灵宠自动带上用户的专属灵宠。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentState } from '../host/miniStore';
import { PETS, isCustomPetId, type CustomPetId, type Pet, type PetFace } from './petData';
import { loadPetModel } from './model3d';
import { renderModelThumb, shrinkImage } from './modelLoad';

export const PET_CUSTOM_KEY = 'lijing.pet.custom.v1';
/** 最多导入几只：每只约 100~300KB，留足余量也不至于把图鉴挤爆 */
export const MAX_CUSTOM_PETS = 12;

/** 抠图来源：AI 抠图 / 原图自带透明底 / 抠图不可用时的柔边圆框 */
export type CutoutKind = 'ai' | 'alpha' | 'frame' | 'glb';

export interface CustomPetMeta {
  id: CustomPetId;
  label: string;
  tagline: string;
  personality: string;
  face: PetFace;
  cutout: CutoutKind;
  /** 配色序号（CUSTOM_PALETTES） */
  palette: number;
  createdAt: number;
  /** 呈现模式:photo = 立绘;glb = 真 3D 模型(模型文件在 models IDB) */
  mode?: 'photo' | 'glb';
  /** 封面来源:photo = 用户挑的照片;model = 模型渲的;placeholder = 渐变占位(老数据) */
  cover?: 'photo' | 'model' | 'placeholder';
}

/** 导入灵宠的配色（Tailwind 静态类，勿拼字符串） */
export const CUSTOM_PALETTES = [
  {
    name: '暖杏',
    swatch: 'bg-orange-300',
    glow: 'from-orange-200/70 via-amber-100/60 to-rose-100/50',
    ring: 'ring-orange-300',
    rarityClass: 'bg-pet-tint-amber text-pet-accent-amber border-pet-tint-amber-line'
  },
  {
    name: '樱粉',
    swatch: 'bg-rose-300',
    glow: 'from-rose-200/70 via-pink-100/60 to-fuchsia-100/50',
    ring: 'ring-rose-300',
    rarityClass: 'bg-pet-tint-rose text-pet-accent-rose border-pet-tint-rose-line'
  },
  {
    name: '薄荷',
    swatch: 'bg-teal-300',
    glow: 'from-teal-200/70 via-emerald-100/60 to-sky-100/50',
    ring: 'ring-teal-300',
    rarityClass: 'bg-pet-tint-teal text-pet-accent-teal border-pet-tint-teal-line'
  },
  {
    name: '晴空',
    swatch: 'bg-sky-300',
    glow: 'from-sky-200/70 via-indigo-100/60 to-violet-100/50',
    ring: 'ring-sky-300',
    rarityClass: 'bg-pet-tint-teal text-pet-accent-teal border-pet-tint-teal-line'
  }
] as const;

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isFace(v: unknown): v is PetFace {
  if (v == null || typeof v !== 'object') return false;
  const f = v as Partial<PetFace>;
  return (
    Array.isArray(f.eyes) &&
    f.eyes.every((e) => e && isFiniteNum(e.x) && isFiniteNum(e.y) && isFiniteNum(e.r)) &&
    Array.isArray(f.cheeks) &&
    f.cheeks.every((c) => c && isFiniteNum(c.x) && isFiniteNum(c.y) && isFiniteNum(c.rx) && isFiniteNum(c.ry)) &&
    f.head != null &&
    isFiniteNum(f.head.x) &&
    isFiniteNum(f.head.y) &&
    typeof f.lash === 'string'
  );
}

export function isCustomPetList(v: unknown): v is CustomPetMeta[] {
  return (
    Array.isArray(v) &&
    v.every(
      (m) =>
        m != null &&
        typeof m === 'object' &&
        isCustomPetId((m as CustomPetMeta).id) &&
        typeof (m as CustomPetMeta).label === 'string' &&
        typeof (m as CustomPetMeta).tagline === 'string' &&
        typeof (m as CustomPetMeta).personality === 'string' &&
        isFace((m as CustomPetMeta).face) &&
        ['ai', 'alpha', 'frame', 'glb'].includes((m as CustomPetMeta).cutout) &&
        isFiniteNum((m as CustomPetMeta).palette) &&
        isFiniteNum((m as CustomPetMeta).createdAt) &&
        ((m as CustomPetMeta).mode == null ||
          (m as CustomPetMeta).mode === 'photo' ||
          (m as CustomPetMeta).mode === 'glb')
    )
  );
}

export const newCustomPetId = (): CustomPetId =>
  `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ------------------------------------------------------------------ */
/* IndexedDB                                                            */
/* ------------------------------------------------------------------ */

const DB_NAME = 'lijing-pets';
const STORE = 'images';

interface PetImages {
  image: Blob;
  thumb: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const putImages = (id: CustomPetId, images: PetImages) => tx('readwrite', (s) => s.put(images, id));
const getImages = (id: CustomPetId) => tx<PetImages | undefined>('readonly', (s) => s.get(id));
const deleteImages = (id: CustomPetId) => tx('readwrite', (s) => s.delete(id));

/* ------------------------------------------------------------------ */
/* object URL 缓存                                                      */
/* ------------------------------------------------------------------ */

interface PetUrls {
  image: string;
  thumb: string;
}

const urlCache = new Map<CustomPetId, PetUrls>();
const pending = new Map<CustomPetId, Promise<PetUrls | null>>();

function cacheUrls(id: CustomPetId, images: PetImages): PetUrls {
  const urls = { image: URL.createObjectURL(images.image), thumb: URL.createObjectURL(images.thumb) };
  urlCache.set(id, urls);
  return urls;
}

function loadUrls(id: CustomPetId): Promise<PetUrls | null> {
  const hit = urlCache.get(id);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(id);
  if (!p) {
    p = getImages(id)
      .then((images) => (images ? cacheUrls(id, images) : null))
      .catch(() => null)
      .finally(() => pending.delete(id));
    pending.set(id, p);
  }
  return p;
}

function dropUrls(id: CustomPetId) {
  const urls = urlCache.get(id);
  if (!urls) return;
  URL.revokeObjectURL(urls.image);
  URL.revokeObjectURL(urls.thumb);
  urlCache.delete(id);
}

/* ------------------------------------------------------------------ */
/* 元数据 → 完整灵宠档案                                                  */
/* ------------------------------------------------------------------ */

function toPet(meta: CustomPetMeta, urls: PetUrls, order: number): Pet {
  const palette = CUSTOM_PALETTES[meta.palette % CUSTOM_PALETTES.length];
  const serial = `MY.${String(order + 1).padStart(2, '0')}`;
  return {
    id: meta.id,
    serial,
    edition: 'MY PET',
    label: meta.label,
    image: urls.image,
    thumb: urls.thumb,
    rarity: '专属',
    rarityClass: palette.rarityClass,
    element: '羁绊',
    tagline: meta.tagline || `${meta.label}，是只属于你的灵宠。`,
    personality: meta.personality || '独一无二 · 只认你',
    traits:
      meta.mode === 'glb'
        ? ['真 3D 模型', '可拖拽旋转', '来自你的 GLB']
        : ['专属陪伴', '本机珍藏', '记得你的每一次轻叩'],
    attrs: { healing: 90, charm: 95, spirit: 90 },
    story: `${meta.label}是你亲手请进桌面的伙伴。它的样子来自你的照片，表情由你标定的那双眼睛驱动 —— 轻叩它，它会眨眼、会笑，久不理它就打盹。`,
    glow: palette.glow,
    ring: palette.ring,
    face: meta.face,
    mode: meta.mode ?? 'photo'
  };
}

/**
 * 全部灵宠 = 三只常驻 + 用户导入（图片已从 IndexedDB 读到的那些）。
 * 导入 / 移除都在这里，跨窗口自动同步。
 */
export function useAllPets() {
  const [customs, setCustoms] = usePersistentState<CustomPetMeta[]>(PET_CUSTOM_KEY, [], isCustomPetList);
  const [, bump] = useState(0);

  // 读不到图的 id 先不上列表；读到后触发一次重渲染
  useEffect(() => {
    let alive = true;
    for (const m of customs) {
      if (urlCache.has(m.id)) continue;
      void loadUrls(m.id).then((u) => {
        if (alive && u) bump((n) => n + 1);
      });
    }
    return () => {
      alive = false;
    };
  }, [customs]);

  /* 老 GLB 图鉴占位封面自愈：本次之前导入的 GLB 封面只有「3D」渐变块（png），
     这里拿模型离屏渲一张真封面换掉；用户挑过照片（webp）的不动。 */
  const healedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const todo = customs.filter((m) => m.mode === 'glb' && m.cover == null && !healedRef.current.has(m.id));
    if (!todo.length) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        for (const m of todo) {
          healedRef.current.add(m.id);
          const imgs = await getImages(m.id).catch(() => undefined);
          // 只在封面是「渐变占位」（canvas 出的 png）时动手
          if (!imgs || imgs.image.type !== 'image/png') continue;
          const model = await loadPetModel(m.id);
          if (!model) continue;
          const png = await renderModelThumb(model, 512);
          if (!png) continue;
          const small = (await shrinkImage(png, 256)) ?? png;
          await putImages(m.id, { image: png, thumb: small }).catch(() => undefined);
          dropUrls(m.id);
          setCustoms((prev) => prev.map((x) => (x.id === m.id ? { ...x, cover: 'model' } : x)));
        }
      })();
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [customs, setCustoms]);

  const pets = useMemo(() => {
    const extra: Pet[] = [];
    customs.forEach((m, i) => {
      const urls = urlCache.get(m.id);
      if (urls) extra.push(toPet(m, urls, i));
    });
    return [...PETS, ...extra];
    // urlCache 是模块级缓存，bump 负责触发重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customs, urlCache.size]);

  const addPet = useCallback(
    async (meta: CustomPetMeta, images: PetImages) => {
      await putImages(meta.id, images);
      cacheUrls(meta.id, images);
      setCustoms((prev) => [...prev.filter((m) => m.id !== meta.id), meta]);
    },
    [setCustoms]
  );

  const removePet = useCallback(
    async (id: CustomPetId) => {
      setCustoms((prev) => prev.filter((m) => m.id !== id));
      dropUrls(id);
      await deleteImages(id).catch(() => undefined);
    },
    [setCustoms]
  );

  return { pets, customs, addPet, removePet, full: customs.length >= MAX_CUSTOM_PETS };
}
