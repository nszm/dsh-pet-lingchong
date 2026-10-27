/**
 * 插件本地的持久化 hook —— 从主项目 `src/utils/cardStore.ts` 的
 * `usePersistentState` 精简而来（DSH 插件拿不到宿主内部模块，自备一份）。
 * ---------------------------------------------------------------------------
 * · 读写一律 try/catch：隐私模式 / 配额满时静默降级，不因存不进而崩掉交互；
 * · 存档脏了由调用方的 `validate` 兜底，回落默认值；
 * · 跨窗口同步：`storage` 事件（别的窗口写的）+ 自定义事件（本窗口其它组件写的
 *   —— storage 事件不会在本窗口触发，而悬浮灵宠与侧栏面板是同页两个座位）。
 * 键名沿用主项目的 `lijing.pet.*`，同一台机器上与主项目的灵宠页共用一份存档。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** 本插件同窗口写通知（悬浮座位 ↔ 侧栏面板座位之间的桥） */
const BUS_EVENT = 'dsh-pet-lingchong:store';

export function notifyKey(key: string): void {
  try {
    window.dispatchEvent(new CustomEvent(BUS_EVENT, { detail: key }));
  } catch {
    /* 没有事件总线只影响同页即时同步，不当场报错 */
  }
}

export const readJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
};

export const writeJSON = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 隐私模式 / 配额满：静默降级，不阻断交互 */
  }
  notifyKey(key);
};

/**
 * 一个 key 一个 state：自动落盘 + 同窗口其它组件即时同步 + 跨窗口 storage 同步。
 * 与主项目宿主里同键名的存档共享（本插件不搬家、不改名）。
 */
export function usePersistentState<T>(
  key: string,
  fallback: T,
  validate?: (v: unknown) => v is T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const read = useCallback((): T => {
    const raw = readJSON<T>(key, fallback);
    return validate && !validate(raw) ? fallback : raw;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const [value, setValue] = useState<T>(read);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const sync = (changedKey: unknown) => {
      if (changedKey != null && changedKey !== key) return;
      const next = read();
      // 只有真变了才 setState：避免「写了读回来又 set 一遍」的重渲染循环
      if (JSON.stringify(next) !== JSON.stringify(valueRef.current)) setValue(next);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) sync(e.key);
    };
    const onBus = (e: Event) => sync((e as CustomEvent).detail);
    window.addEventListener('storage', onStorage);
    window.addEventListener(BUS_EVENT, onBus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(BUS_EVENT, onBus);
    };
  }, [key, read]);

  const set = useCallback<React.Dispatch<React.SetStateAction<T>>>((updater) => {
    setValue((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
      writeJSON(key, next);
      return next;
    });
  }, [key]);

  return [value, set];
}
