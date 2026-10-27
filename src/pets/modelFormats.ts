/**
 * 3D 模型格式表（导入、落库、渲染三处共用一份口径）。
 * ---------------------------------------------------------------------------
 * 能直接吃的：GLB / VRM（glTF 二进制，带材质与动画）、STL / PLY（扫描、3D 打印、
 * 单色几何）、OBJ（无 MTL 时按中性材质渲染）。
 * 吃不了的：`.gltf`（JSON + 外部 .bin/贴图，单文件导入必缺资源）、FBX、3DS、DAE ——
 * 这些先用 Blender / 在线转换器导成 GLB 再来，README 里写明了原因。
 */

export interface ModelFormat {
  ext: string;
  /** 统一写进 Blob.type，渲染端靠它判断用哪个 loader */
  mime: string;
  label: string;
}

export const MODEL_FORMATS: ModelFormat[] = [
  { ext: 'glb', mime: 'model/gltf-binary', label: 'GLB' },
  { ext: 'vrm', mime: 'model/gltf-binary', label: 'VRM' },
  { ext: 'stl', mime: 'model/stl', label: 'STL' },
  { ext: 'obj', mime: 'model/obj', label: 'OBJ' },
  { ext: 'ply', mime: 'model/ply', label: 'PLY' }
];

/** 界面文案：GLB / VRM / STL / OBJ / PLY */
export const MODEL_LABEL = MODEL_FORMATS.map((f) => f.label).join(' / ');

/** `<input accept>` 用 */
export const MODEL_ACCEPT = `${MODEL_FORMATS.map((f) => `.${f.ext}`).join(',')},model/gltf-binary`;

const EXT_TO_MIME: Record<string, string> = Object.fromEntries(
  MODEL_FORMATS.map((f) => [f.ext, f.mime])
);

/** 从文件名 / MIME 猜格式；认不出返回 null */
export function modelExtOf(name?: string | null, mime?: string | null): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(name ?? '');
  const byExt = m ? m[1].toLowerCase() : '';
  if (byExt && EXT_TO_MIME[byExt]) return byExt;
  if (mime) {
    for (const [ext, type] of Object.entries(EXT_TO_MIME)) {
      if (type === mime && ext !== 'vrm') return ext;
    }
    if (mime === 'model/gltf-binary') return 'glb';
  }
  return null;
}

/** 这个文件能不能当 3D 模型导入（Windows 上这些扩展名常常没有 MIME，靠扩展名兜底） */
export function is3DModelFile(f: File | null | undefined): boolean {
  if (!f) return false;
  return modelExtOf(f.name, f.type) != null;
}

/**
 * 落库前统一 Blob 的 type：浏览器给的 MIME 五花八门（.stl 常常是空串），
 * 而渲染端只有 Blob 没有文件名，得靠 type 认格式。同时保留文件名给日志看。
 */
export function tagModelBlob(file: File): Blob {
  const ext = modelExtOf(file.name, file.type) ?? 'glb';
  const type = EXT_TO_MIME[ext] ?? 'model/gltf-binary';
  if (file.type === type) return file;
  try {
    return new File([file], file.name, { type });
  } catch {
    return new Blob([file], { type });
  }
}
