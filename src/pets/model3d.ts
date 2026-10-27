/**
 * 导入灵宠 · 3D 模型存储
 * ---------------------------------------------------------------------------
 * 职责只有一件事:管理每只灵宠的 glb 模型文件(独立 IndexedDB
 * `dsh-pet-lingchong-models`,键 = 灵宠 id,值 = glb Blob)。
 *
 * 3D 模型从哪来:**用户自己在云端生成**——
 *   meshy.ai / tripo3d.ai 网页版上传宠物照片 → 下载 GLB →
 *   设置面板「3D 模型」里导入到指定灵宠(见 PetSettingsPanel.Model3DSection)。
 * 插件不做任何云端 API 调用(无 Key、无费用、无 CORS 问题)。
 * 舞台渲染:有模型走 `PetModel3D`(three.js 转台),没有回退 2.5D 立绘。
 */
import type { PetFace } from './petData';

const MODEL_DB = 'dsh-pet-lingchong-models';
const MODEL_STORE = 'glb';

function openModelDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MODEL_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(MODEL_STORE)) {
        req.result.createObjectStore(MODEL_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDB 打开失败'));
  });
}

async function modelTx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openModelDb();
  try {
    const req = run(db.transaction(MODEL_STORE, mode).objectStore(MODEL_STORE));
    return await new Promise<T>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IDB 操作失败'));
    });
  } finally {
    db.close();
  }
}

export async function savePetModel(petId: string, blob: Blob): Promise<void> {
  await modelTx('readwrite', (s) => s.put(blob, petId) as unknown as IDBRequest<void>);
  emitModelsChanged();
}

export async function loadPetModel(petId: string): Promise<Blob | null> {
  try {
    const blob = await modelTx<Blob | undefined>('readonly', (s) => s.get(petId) as IDBRequest<Blob | undefined>);
    return blob ?? null;
  } catch {
    return null;
  }
}

export async function deletePetModel(petId: string): Promise<void> {
  await modelTx('readwrite', (s) => s.delete(petId) as unknown as IDBRequest<void>);
  emitModelsChanged();
}

/* ------------------------------------------------------------------ */
/* 变更广播:导入/删除模型后,舞台即时切换                                */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();

export function onModelsChanged(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function emitModelsChanged(): void {
  listeners.forEach((fn) => fn());
}