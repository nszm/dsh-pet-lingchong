/**
 * dsh-pet-lingchong —— 浏览器半边入口。
 * ---------------------------------------------------------------------------
 * 契约与 dsh-pet-indesktop 同款（见该插件 src/client/index.js 的长注释）：
 *   · 产物是**普通脚本**，包在 `window.__ModuleLoader__.load({ id, factory })` 里
 *     （这个壳在构建时由 scripts/build.mjs 的 banner/footer 拼上，源码里只有 apply）；
 *   · **没有静态 inject** —— 依赖一律走 `ctx.inject(deps, cb)` 动态注入，
 *     插件本身立刻 active，等不到服务的宿主只会让它安静闲置；
 *   · 两个座位：`shell.overlay`（悬浮灵宠本体）+ `sidebar.footer.action`
 *     （面板按钮，宿主右键菜单「打开它的面板」点它）；
 *   · 样式自备：apply 时往 <head> 插一个带 id 的 <style>，卸载时摘掉。
 */
import React from 'react';
import { LingPetOverlay, FooterToggle } from './overlay';
import { STYLE_ID, STYLE_TEXT } from './style';
import { registerStyleProperties } from './styleProperties';

/* 导出真实运行时样式文本:verify-bundle 直接对它做回归断言(端到端,不信源码文本)。 */
export { STYLE_ID, STYLE_TEXT };

const SERVICES = ['slots', 'uiSession'];

/** 最小宿主契约（完整版见主项目 src/dsh/types.ts） */
interface DshCtx {
  inject?: (deps: string[], cb: (ready: DshServices) => void) => void;
  effect?: (fn: () => void | (() => void), label?: string) => void;
  slots?: DshSlots;
  uiSession?: unknown;
}

interface DshServices {
  slots?: unknown;
  uiSession?: unknown;
  effect?: (fn: () => void | (() => void), label?: string) => void;
}

interface DshSlots {
  inject: (name: string, cb: () => void) => void;
  register: (
    meta: { name: string; id: string; order?: number; label?: () => string },
    render: () => unknown
  ) => () => void;
}

/* 样式全部进 ShadowScope(2026-10-26 双向隔离):不再向 document.head 注入。 */

/** 宿主给的 slots 服务得像个 slots（有 inject + register）才认 */
function slotsOf(ready: DshServices): DshSlots | null {
  const candidate = ready.slots as DshSlots | undefined | null;
  if (candidate == null) return null;
  return typeof candidate.inject === 'function' && typeof candidate.register === 'function'
    ? candidate
    : null;
}

export function apply(ctx: DshCtx): void {
  /* @property 文档级注册:shadow 样式表里的 @property 不被 Chromium 注册,
     tailwind 的 translate/scale/rotate 工具类会整链失效(设置面板开关旋钮
     卡在左侧的直接原因)。JS API 注册,零样式注入,不影响 DSH 页面。 */
  try {
    const n = registerStyleProperties(STYLE_TEXT);
    if (n > 0) console.info(`[dsh-pet-lingchong] @property x${n} registered (shadow workaround)`);
  } catch {
    /* 注册失败不阻断挂载 —— 退化为无位移动画,界面照常 */
  }
  const wire = (ready: DshServices): void => {
    const slots = slotsOf(ready);
    if (!slots) {
      // 宿主没有提供座位服务：插件加载了但无处落脚 —— 安静闲置（DSH 的失败姿势）
      console.warn('[dsh-pet-lingchong] idle: host offers no slots service')
      return;
    }

    const mount = (): (() => void) => {
      // 座位出现后再绑定；宿主已提供该座位时立即回调
      slots.inject('shell.overlay', () =>
        slots.register(
          {
            name: 'shell.overlay',
            id: 'lingchong',
            order: 700,
            label: () => '灵宠 · 桌宠'
          },
          () => React.createElement(LingPetOverlay, null)
        )
      );
      slots.inject('sidebar.footer.action', () =>
        slots.register(
          {
            name: 'sidebar.footer.action',
            id: 'lingchong-panel',
            order: 700,
            label: () => '灵宠'
          },
          () => React.createElement(FooterToggle, null)
        )
      );
      return () => {};
    };

    if (typeof ready.effect === 'function') ready.effect(mount, 'dsh-pet-lingchong: mounts');
    else mount();
  };

  if (typeof ctx.inject === 'function') {
    // cordis 动态注入：等待发生在子 fiber，本条目立刻 active
    ctx.inject(SERVICES, wire);
    return;
  }

  // 宿主没有动态注入但 ctx 上直接挂了 slots：同步 wire（鲸鱼插件的同款兜底）
  if (ctx.slots) {
    wire({
      slots: ctx.slots,
      uiSession: ctx.uiSession,
      effect: ctx.effect
    });
  } else {
    console.warn('[dsh-pet-lingchong] idle: host offers no dynamic injection and no slots')
  }
}
