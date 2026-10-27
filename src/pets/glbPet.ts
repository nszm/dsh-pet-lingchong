/**
 * GLB 灵宠 · 导入共用件
 * ---------------------------------------------------------------------------
 * 真 3D 灵宠不是「一张图」：模型本体存 IndexedDB `dsh-pet-lingchong-models`
 * （见 model3d.ts），而图鉴 / 换宠胶囊 / 桌面占位仍需要一张小头像。
 *
 * 这里放两处导入入口（设置面板 PetImportSection 与「我的灵宠 → 导入灵宠」向导）
 * 共用的两样东西：
 *   ① GLB_DEFAULT_FACE —— 合法但不会被渲染的表情数据（glb 舞台不叠 PetFace）；
 *   ② glbTiles —— 头像来源：用户选的照片（裁成透明底方图），没选就渐变「3D」占位。
 */

import { encodePet, frameCutout, hasTransparency, normalize, readImageFile } from './petImport';
import { renderModelThumb, shrinkImage } from './modelLoad';

/** GLB 灵宠默认表情(校验器要求 face 合法;glb 舞台不叠加 PetFace) */
export const GLB_DEFAULT_FACE = {
  eyes: [
    { x: 440, y: 400, r: 40 },
    { x: 584, y: 400, r: 40 }
  ],
  cheeks: [] as { x: number; y: number; rx: number; ry: number }[],
  head: { x: 512, y: 140 },
  lash: '#6b3b26'
};

/** GLB 灵宠占位头像:暖渐变 + 「3D」标识(图鉴/胶囊用;舞台是渲染的 3D 模型) */
export function makeGlbTiles(label: string): Promise<{ image: Blob; thumb: Blob }> {
  const make = (size: number): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    if (!g) throw new Error('canvas 2d 上下文创建失败');
    const grad = g.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#f7e8c8');
    grad.addColorStop(1, '#cfe3f2');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    g.fillStyle = 'rgba(27, 28, 28, 0.82)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `bold ${Math.round(size * 0.3)}px 'Space Grotesk', system-ui, sans-serif`;
    g.fillText('3D', size / 2, size * 0.42);
    g.font = `bold ${Math.round(size * 0.085)}px system-ui, sans-serif`;
    g.fillText(label.slice(0, 8), size / 2, size * 0.66);
    return c;
  };
  const toBlob = (c: HTMLCanvasElement): Promise<Blob> =>
    new Promise((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error('canvas 导出失败'))), 'image/png')
    );
  return Promise.all([toBlob(make(512)), toBlob(make(256))]).then(([image, thumb]) => ({
    image,
    thumb
  }));
}

/**
 * 头像：优先用用户挑的照片（透明底直接用，否则柔边圆框）；
 * 没有照片就把模型本身离屏渲一张当封面（以前这里只有「3D」渐变占位块，
 * 图鉴里根本看不出导入的是哪只）；渲染失败才回退渐变占位。
 */
export type CoverKind = 'photo' | 'model' | 'placeholder';

export async function glbTiles(
  label: string,
  photo?: File | null,
  model?: Blob | null
): Promise<{ image: Blob; thumb: Blob; cover: CoverKind }> {
  if (!photo && model) {
    const png = await renderModelThumb(model, 512);
    if (png) {
      const small = (await shrinkImage(png, 256)) ?? png;
      return { image: png, thumb: small, cover: 'model' };
    }
  }
  if (!photo) {
    const tiles = await makeGlbTiles(label);
    return { ...tiles, cover: 'placeholder' };
  }
  try {
    const c = await readImageFile(photo);
    const cut = hasTransparency(c) ? c : frameCutout(c);
    const photoTiles = await encodePet(normalize(cut));
    return { ...photoTiles, cover: 'photo' };
  } catch {
    const tiles = await makeGlbTiles(label);
    return { ...tiles, cover: 'placeholder' };
  }
}
