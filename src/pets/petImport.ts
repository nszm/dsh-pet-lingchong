/**
 * 导入灵宠 · 图像流水线
 * ---------------------------------------------------------------------------
 * 读图 → 抠图（AI / 原图自带透明底 / 柔边圆框兜底）→ 裁到主体、补成 1024 方图
 * → 从用户标的两只眼睛推算腮红、头顶锚点、睫毛色。
 *
 * （DSH 版无 AI 抠图，用户口径 2026-10-26：透明底直取 / 柔边圆框两档；
 * 从 CDN 下载**，之后走浏览器缓存。下载 / 推理失败一律回退柔边圆框，不让导入卡死。
 * 坐标系与内置灵宠一致：1024×1024，PetFace 叠加层直接用。
 */
import type { PetFace } from './petData';

/* 导入灵宠的「3D 效果」分层实现(2026-10-26):
 *  · 本地(已实现):抠图/柔边立绘 → 舞台 2.5D 呈现 —— 透视倾斜(PetStage ljp-tilt)、
 *    地面阴影(ljp-ground-shadow)、呼吸浮动,与内置灵宠同一套,导入即生效;
 *  · 真 3D 模型(单图 → glb):需要云端 AI(Tripo / Meshy 等)与 API Key、按量计费,
 *    且渲染要引 three.js —— 等确有需要再接,接口预留在这条流水线之后。 */
export const CANVAS = 1024;
/** 读入时最长边上限（太大的照片推理慢、内存高） */
const MAX_INPUT = 1600;

const canvasOf = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

const ctx2d = (c: HTMLCanvasElement): CanvasRenderingContext2D => {
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('canvas 2d 上下文创建失败');
  return g;
};

const toBlob = (c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas 导出失败'))), type, quality);
  });

/** 读图并按最长边缩到 MAX_INPUT */
export async function readImageFile(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, MAX_INPUT / Math.max(bitmap.width, bitmap.height));
  const c = canvasOf(Math.round(bitmap.width * k), Math.round(bitmap.height * k));
  ctx2d(c).drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  return c;
}

/** 原图是否自带透明底（透明像素占比超过 3% 就算，免得每张 PNG 都去跑模型） */
export function hasTransparency(c: HTMLCanvasElement): boolean {
  const { data } = ctx2d(c).getImageData(0, 0, c.width, c.height);
  let clear = 0;
  const step = 4 * 7; // 抽样即可
  for (let i = 3; i < data.length; i += step) if (data[i] < 200) clear++;
  return clear / (data.length / step) > 0.03;
}

/** 兜底：取中间的正方形，四周柔边渐隐成椭圆 —— 不抠图也像一张「灵宠立牌」 */
export function frameCutout(c: HTMLCanvasElement): HTMLCanvasElement {
  const side = Math.min(c.width, c.height);
  const out = canvasOf(side, side);
  const g = ctx2d(out);
  g.drawImage(c, (c.width - side) / 2, (c.height - side) / 2, side, side, 0, 0, side, side);
  g.globalCompositeOperation = 'destination-in';
  const grad = g.createRadialGradient(side / 2, side / 2, side * 0.3, side / 2, side / 2, side * 0.5);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.75, 'rgba(0,0,0,0.85)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, side, side);
  return out;
}

/** 主体包围盒（alpha > 24） */
function alphaBox(c: HTMLCanvasElement) {
  const { data, width, height } = ctx2d(c).getImageData(0, 0, c.width, c.height);
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: width, h: height };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * 裁到主体并补成 1024 方图：主体最长边占 88%，水平居中、略微靠下（和内置灵宠一样
 * 「坐」在舞台上），头顶留出表情符号的空间。
 */
export function normalize(c: HTMLCanvasElement): HTMLCanvasElement {
  const box = alphaBox(c);
  const k = (CANVAS * 0.88) / Math.max(box.w, box.h);
  const w = box.w * k;
  const h = box.h * k;
  const out = canvasOf(CANVAS, CANVAS);
  const g = ctx2d(out);
  g.imageSmoothingQuality = 'high';
  g.drawImage(c, box.x, box.y, box.w, box.h, (CANVAS - w) / 2, CANVAS - h - CANVAS * 0.05, w, h);
  return out;
}

/** 存档用的两份图：1024 透明底 webp（舞台）+ 160 缩略（选择胶囊 / 图鉴卡） */
export async function encodePet(c: HTMLCanvasElement): Promise<{ image: Blob; thumb: Blob }> {
  const image = await toBlob(c, 'image/webp', 0.9);
  const t = canvasOf(160, 160);
  const g = ctx2d(t);
  g.fillStyle = '#f6efe6';
  g.fillRect(0, 0, 160, 160);
  g.imageSmoothingQuality = 'high';
  g.drawImage(c, 0, 0, 160, 160);
  const thumb = await toBlob(t, 'image/webp', 0.85);
  return { image, thumb };
}

export interface EyePoint {
  x: number;
  y: number;
}

/** 两眼距离 → 默认眼睛半径（内置三只在 0.17~0.26 之间；宁大勿小，盖不全会露眼角） */
export const defaultEyeRadius = (a: EyePoint, b: EyePoint) =>
  Math.round(Math.max(10, Math.min(90, Math.hypot(a.x - b.x, a.y - b.y) * 0.25)));

/** 眼睛上方一圈毛色的平均值压暗，作睫毛 / 闭眼弧线色 —— 跟毛色同色系才自然 */
function lashColor(c: HTMLCanvasElement, eyes: EyePoint[], r: number): string {
  const g = ctx2d(c);
  let rr = 0;
  let gg = 0;
  let bb = 0;
  let n = 0;
  for (const e of eyes) {
    const x = Math.round(e.x - r);
    const y = Math.round(e.y - r * 2.4);
    const size = Math.max(4, Math.round(r * 2));
    const { data } = g.getImageData(Math.max(0, x), Math.max(0, y), size, Math.max(4, Math.round(r)));
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      rr += data[i];
      gg += data[i + 1];
      bb += data[i + 2];
      n++;
    }
  }
  if (n === 0) return '#4a2c1c';
  const k = 0.38;
  const hex = (v: number) => Math.round((v / n) * k).toString(16).padStart(2, '0');
  return `#${hex(rr)}${hex(gg)}${hex(bb)}`;
}

/** 主体在某一列的最高点（找头顶） */
function topAt(c: HTMLCanvasElement, x: number): number {
  const { data } = ctx2d(c).getImageData(Math.round(x), 0, 1, c.height);
  for (let y = 0; y < c.height; y++) if (data[y * 4 + 3] > 64) return y;
  return 0;
}

/**
 * 由两只眼睛推算整套五官坐标。eyes 为空 = 用户跳过了标定（只有身体动作，没有眼部表情）。
 */
export function buildFace(c: HTMLCanvasElement, eyes: EyePoint[], r: number): PetFace {
  if (eyes.length < 2) {
    const midX = CANVAS / 2;
    return { eyes: [], cheeks: [], head: { x: midX, y: Math.max(40, topAt(c, midX) + 30) }, lash: '#4a2c1c' };
  }
  const [l, rt] = [...eyes].sort((a, b) => a.x - b.x);
  const d = Math.hypot(rt.x - l.x, rt.y - l.y);
  const midX = (l.x + rt.x) / 2;
  const cheek = (e: EyePoint, side: -1 | 1) => ({
    x: Math.round(e.x + side * d * 0.18),
    y: Math.round(e.y + d * 0.5),
    rx: Math.round(d * 0.28),
    ry: Math.round(d * 0.17)
  });
  return {
    eyes: [
      { x: Math.round(l.x), y: Math.round(l.y), r },
      { x: Math.round(rt.x), y: Math.round(rt.y), r }
    ],
    cheeks: [cheek(l, -1), cheek(rt, 1)],
    head: { x: Math.round(midX), y: Math.max(40, topAt(c, midX) + 30) },
    lash: lashColor(c, [l, rt], r)
  };
}
