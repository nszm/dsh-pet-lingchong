/**
 * 灵宠 · Document Picture-in-Picture 小窗逃生门
 * ---------------------------------------------------------------------------
 * 把灵宠弹成一个**置顶的系统小窗**（视频小窗同款层级）：压在所有程序之上、
 * 浏览器最小化它还在、可以拖到屏幕任何地方 —— DSH 跑在纯浏览器里时，
 * 这是挂件「离开 DSH 界面」的唯一合规通道（Chromium 116+ 的
 * `documentPictureInPicture`，主项目的 WebView2 里同样可用）。
 *
 * 三条实现要点：
 *  ① **portal 跨 document 收不到合成事件** —— React 17+ 把事件监听挂在根容器上，
 *     PiP 文档里的事件冒泡不过来。所以小窗里不是 portal，而是用
 *     `require('react-dom/client')` 的 createRoot 在 PiP 文档里起**独立 React 根**；
 *     宿主没给这个模块（旧版本 / 真 DSH）时 `pipReady()` 返回 false，按钮整个隐藏。
 *  ② **样式自灌**：PiP 是独立 document，把 STYLE_TEXT 再插一份，并把宿主
 *     `html` 的 class（暗夜 `dark` 等）抄过去，亮暗跟着走。
 *  ③ **生命周期绑在宿主页面**：用户关标签页 / 导航走，PiP 窗随之关闭（浏览器
 *     安全模型，绕不开）——`pagehide` 时卸载 React 根、清引用，再开就是新的。
 */
import React, { useCallback, useRef, useState } from 'react';
import { PetFace, useBodyMotion, usePetMood } from './pets/PetFace';
import { PetParticles } from './pets/PetParticles';
import { usePetEngine } from './pets/usePetEngine';
import { usePetAudio } from './pets/usePetAudio';
import { useAllPets } from './pets/customPets';
import { BLESSING_OPTIONS, clampPetScale, closenessOf } from './pets/petData';
import { usePetSharedState, PetPills } from './overlay';
import { STYLE_ID, STYLE_TEXT } from './style';

/* ------------------------------------------------------------------ */
/* 能力检测                                                              */
/* ------------------------------------------------------------------ */

interface PipApi {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}

type PipWindow = Window & { documentPictureInPicture?: PipApi };

/**
 * 是否 Electron 宿主（DSH 桌面端 / WebView2 壳都算）。
 * Electron 里 `documentPictureInPicture` 这个对象**存在**，但 `requestWindow()`
 * 永远不会真的开窗（Chromium 的 add-new-contents / disposition:'other' 路径
 * Electron 没实现，electron/electron#39633 自 2023-08 起一直开着）。
 * 不提前挡住的话，按钮会显示出来、点了没反应 —— 比没有按钮更糟。
 */
export function isElectronHost(): boolean {
  try {
    return /\bElectron\/\d/.test(navigator.userAgent);
  } catch {
    return false;
  }
}

/** 浏览器给没给 Document PiP API（Chromium 116+；Firefox/Safari 没有）。 */
export function pipSupported(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      !isElectronHost() &&
      'documentPictureInPicture' in window
    );
  } catch {
    return false;
  }
}

/**
 * PiP 可用 = API 在 + 宿主给的是**真** createRoot。
 * 宿主缺 `react-dom/client` 时兼容层会给「返回 null 的兜底桩」——那种 createRoot
 * 一调就空，必须在开窗**之前**识破（开了窗渲染不出来，用户只看到一片空白）。
 */
export function pipReady(): boolean {
  if (!pipSupported()) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const m = require('react-dom/client') as { createRoot?: unknown } | undefined;
    return !!m && typeof m?.createRoot === 'function';
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* 开窗 / 关窗                                                           */
/* ------------------------------------------------------------------ */

let pipWin: Window | null = null;
// react-dom/client 的返回类型随版本漂移，这里只用到 unmount
let pipRoot: { unmount: () => void } | null = null;

/** 宿主 html 上的主题类（dark 等）抄给 PiP 文档，亮暗跟随宿主。 */
function syncThemeClasses(pipDoc: Document): void {
  try {
    pipDoc.documentElement.className = document.documentElement.className;
  } catch {
    /* 拿不到 class 就用亮色默认 */
  }
}

/** 把插件自包含样式 + 宿主样式表克隆进 PiP 文档（MDN 的标准做法）。 */
function copyStyles(pipDoc: Document): void {
  try {
    for (const node of Array.from(document.head.children)) {
      if (node.tagName === 'STYLE') {
        const el = pipDoc.createElement('style');
        el.textContent = node.textContent ?? '';
        pipDoc.head.appendChild(el);
      } else if (node.tagName === 'LINK' && (node as HTMLLinkElement).rel === 'stylesheet') {
        // 跨域样式表读不到 cssRules，原样克隆 <link>（同源地址在 PiP 文档里照样解析）
        pipDoc.head.appendChild(node.cloneNode(true));
      }
    }
  } catch {
    /* 宿主样式拷不动就只靠我们自己的 STYLE_TEXT —— 它是自包含的 */
  }
  const own = pipDoc.createElement('style');
  own.id = STYLE_ID;
  own.textContent = STYLE_TEXT;
  pipDoc.head.appendChild(own);
}

/** 开小窗（已开着就先关掉）。返回开窗后的最终状态：true = 开着，false = 关着。 */
export async function togglePetPip(): Promise<boolean> {
  if (pipWin && !pipWin.closed) {
    try {
      pipWin.close();
    } catch {
      /* 关不掉就等 pagehide 清理 */
    }
    return false;
  }
  if (!pipSupported()) return false;
  const api = (window as PipWindow).documentPictureInPicture;
  if (!api) return false;

  /* Electron 上这个 Promise 可能永不 resolve（electron#39633）：超时兜底，
     免得「点了没反应还一直挂着」。正常浏览器里 requestWindow 是即时的。 */
  let win: Window;
  try {
    win = await Promise.race([
      api.requestWindow({ width: 248, height: 332 }),
      new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error('pip-timeout')), 5000)
      )
    ]);
  } catch {
    return false;
  }
  pipWin = win;
  const pipDoc = win.document;
  pipDoc.body.style.margin = '0';
  pipDoc.body.style.overflow = 'hidden';
  syncThemeClasses(pipDoc);
  copyStyles(pipDoc);

  const container = pipDoc.createElement('div');
  container.id = 'ljp-pip-root';
  pipDoc.body.appendChild(container);

  // 跨 document 必须 createRoot（见文件头 ①）；宿主已通过 pipReady() 验过
  const { createRoot } = require('react-dom/client') as {
    createRoot: (c: Element) => { render(n: React.ReactNode): void; unmount(): void };
  };
  const root = createRoot(container);
  pipRoot = root;
  root.render(<PipPetApp onClose={() => win.close()} />);

  // 用户点了小窗自己的 ✕ / 关掉标签页：把 React 根卸了、引用清了
  win.addEventListener('pagehide', () => {
    try {
      pipRoot?.unmount();
    } catch {
      /* 页面都在卸了，尽力而为 */
    }
    pipRoot = null;
    pipWin = null;
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* 小窗里的灵宠                                                          */
/* ------------------------------------------------------------------ */

function PipPetApp({ onClose }: { onClose: () => void }) {
  const { petId, setPetId, settings, setSettings } = usePetSharedState();
  const { pets } = useAllPets();
  const pet = pets.find((p) => p.id === petId) ?? pets[0];
  const blessing = BLESSING_OPTIONS.includes(settings.blessing)
    ? settings.blessing
    : BLESSING_OPTIONS[0];
  const engine = usePetEngine({ effects: settings.effects, blessing });
  const { play } = usePetAudio(settings.sound);
  const { mood, blink, emotes } = usePetMood(engine.totalTaps, engine.combo, 'tap', pet.id);
  const bodyRef = useRef<HTMLDivElement>(null);
  useBodyMotion(bodyRef, mood);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const closeness = closenessOf(engine.totalTaps);

  const handleTap = useCallback(() => {
    if (settings.soundOn) play(settings.sound);
    engine.registerInteraction(pet);
  }, [settings.soundOn, play, engine, pet]);

  const isLoaded = loaded[pet.image];

  return (
    <div className="ljp-pip">
      <div className="ljp-pip-head">
        <span className="ljp-pip-title">{pet.label}</span>
        <button
          type="button"
          className="ljp-pip-close"
          onClick={onClose}
          title="收起小窗"
          aria-label="收起小窗"
        >
          ×
        </button>
      </div>

      <div className="ljp-pip-stage">
        <button
          type="button"
          className="ljp-pip-pet"
          onClick={handleTap}
          title={`轻叩${pet.label} · 能量 +1`}
          style={{ transform: `scale(${clampPetScale(settings.petScale)})` }}
        >
          <div className="pet-breathing ljp-breath">
            <div ref={bodyRef} data-pet-mood={mood} className="ljp-petbox">
              {!isLoaded && (
                <div className="ljp-loading">
                  <span>灵宠降临中…</span>
                </div>
              )}
              <img
                src={pet.image}
                alt={pet.label}
                draggable={false}
                decoding="async"
                onLoad={() => setLoaded((m) => (m[pet.image] ? m : { ...m, [pet.image]: true }))}
                className="ljp-img"
              />
              {isLoaded && <PetFace pet={pet} mood={mood} blink={blink} emotes={emotes} />}
            </div>
          </div>
        </button>
        <PetParticles particles={engine.particles} />
      </div>

      <div className="ljp-pip-foot">
        <span className="ljp-stat" title={`累计 ${engine.totalTaps} 叩 · 亲密度 Lv.${closeness.level}`}>
          今日 {engine.merit} · Lv.{closeness.level}
        </span>
        <PetPills petId={pet.id} onPick={setPetId} compact />
        <button
          type="button"
          className="ljp-ico"
          title={settings.soundOn ? '静音' : '开启音效'}
          aria-label={settings.soundOn ? '静音' : '开启音效'}
          onClick={() => setSettings((s) => ({ ...s, soundOn: !s.soundOn }))}
        >
          {settings.soundOn ? '🔊' : '🔇'}
        </button>
      </div>
    </div>
  );
}
