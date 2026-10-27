/**
 * 灵宠设计字体（Cinzel / Outfit / Space Grotesk）。
 * ---------------------------------------------------------------------------
 * 只有「完整页面」的标题、数字、按钮用到这三款字体；悬浮卡上的几个数字用系统
 * 等宽字体完全够看。所以**不在 apply() 时就注入**——那会给每个 DSH 页面都挂一个
 * 指向 fonts.googleapis.com 的 render-blocking 样式表，既违背「数据只存本机」的
 * 直觉（会连外网），在网络受限的环境里还会让首屏发白。
 *
 * 现在改成：打开完整页面时才注入；离线 / 被墙则静默回退系统字体，不比没有差。
 */
const FONT_LINK_ID = 'dsh-pet-lingchong-fonts';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Outfit:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;600&display=swap';

export function ensurePetFonts(): void {
  try {
    if (typeof document === 'undefined') return;
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    document.head.appendChild(link);
  } catch {
    /* 拿不到 head：回退系统字体，不阻断挂载 */
  }
}
