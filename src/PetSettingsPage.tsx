/**
 * 灵宠 · 完整界面入口（DSH 全屏版）。
 * ---------------------------------------------------------------------------
 * 内容 = 主项目 `src/pets/PetStudio.tsx` **原封不动**（页面/舞台/图鉴/设置面板/
 * 指标卡/七日心流/陪伴日志/导入灵宠全套），只在 外面包一层全屏容器。
 * 数据同键（lijing.pet.*），与悬浮灵宠 / DSH 对话联动同源 —— 页里改、悬浮态
 * 即时跟着变，反之亦然。
 */
import React, { useEffect, useState } from 'react';
import PetStudio from './pets/PetStudio';
import { ShadowScope } from '@lj/core';
import { STYLE_ID, STYLE_TEXT } from './style';
import { ensurePetFonts } from './pets/fonts';

export function PetSettingsPage({ onClose }: { onClose: () => void }): React.ReactElement {
  /* 设计字体只在打开完整页面时才拉（apply 时拉会给每个 DSH 页面挂外链样式表） */
  useEffect(() => {
    ensurePetFonts();
  }, []);

  /* 顶部避让:DSH 窗口自己的标题栏(最小化/关闭控件在右上角)不能被本页盖住。
     运行时探测右上角窗口控件的最深底缘,全屏页从它下方开始;找不到 = 0。 */
  const [topPx, setTopPx] = useState(0);
  useEffect(() => {
    const measure = () => {
      try {
        let max = 0;
        for (const el of Array.from(document.querySelectorAll('button, [class*="stripChrome"], [class*="titlebar"]'))) {
          const r = el.getBoundingClientRect();
          if (r.height > 0 && r.height < 60 && r.top >= 0 && r.top < 100 && r.right > window.innerWidth - 380) {
            max = Math.max(max, r.bottom);
          }
        }
        setTopPx(Math.min(Math.ceil(max) + 4, 120));
      } catch {
        setTopPx(0);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    /* 全屏页打开期间锁定底层滚动:DSH 页自己的滚动条会探出到窗口右缘,
       压住本页右上角的关闭/设置按钮(2026-10-26 用户实测「顶部被遮挡」) */
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [onClose]);

  return (
    <ShadowScope
      css={STYLE_TEXT}
      styleId={STYLE_ID}
      themeClass="lj-light"
      hostStyle={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        top: topPx,
        zIndex: 2147482700
      }}
      hostDataset={{ 'ljp-studio': '1' }}
    >
      {/* 关闭钮挂在滚动容器之外(遮罩的兄弟):绝对定位以宿主为基准,
          不随页面滚动,永远悬在标题栏呼吸带正中 */}
      <button
        type="button"
        className="ljpful-close"
        style={{ position: 'absolute', top: 6, right: 24 }}
        onClick={onClose}
        title="关闭（Esc）"
      >
        ✕
      </button>
      <div
        className="ljpful-mask"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="ljpful-petstudio" role="dialog" aria-label="灵宠">
          <PetStudio />
        </div>
      </div>
    </ShadowScope>
  );
}
