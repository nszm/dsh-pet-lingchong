/** 灵宠全部自包含样式(shadow 版)。
 *  compiled.css 为工作区 Tailwind 全量编译(build 已剥 @layer);这里再适配
 *  Shadow DOM:`:root`→`:host`、`html.dark X`→`.lj-dark X`(主题类挂在
 *  ShadowScope 容器上)。pet.css 是主项目原版令牌+动画+液态玻璃。 */
import compiled from '../../core/css/compiled.css';
import cssTokens from '../css/pet.css';
import cssShell from '../css/overlay.css';

/** 工作区剥层脚本对 "@layer properties;"(tailwind v4 的层声明语句)有缺陷:
 *  它顺着找 '{' 会把紧随的 ":root, :host {…}" 整条规则误当层体 —— 选择器被吞,
 *  主题变量裸奔成无效 CSS,浏览器整段丢弃 ⇒ 令牌全部失效、页面样式散架
 *  (2026-10-26 灵宠设置页「样式都没有了」的根因)。这里在入包时自愈:
 *  检测到「纯 --var 声明的无选择器头部」就补一层 :root,:host;
 *  已带选择器(:root/:host)的产物原样放行,幂等。 */
const wrapThemeVars = (css: string): string => {
  if (/(^|[\s,])(:root|:host)\s*[,{]/.test(css)) return css;
  const firstBrace = css.indexOf('{');
  if (firstBrace < 0) return css;
  const cut = css.lastIndexOf(';', firstBrace);
  if (cut < 0) return css;
  const rel = css.slice(0, cut).search(/^\s*--[\w-]+\s*:/m);
  if (rel < 0) return css;
  const seg = css.slice(rel, cut + 1);
  const lines = seg.split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0 || !lines.every((l) => /^\s*--[\w-]+\s*:\s*[^;{}]+;\s*$/.test(l))) {
    return css;
  }
  console.warn(
    '[dsh-pet-lingchong] compiled.css 主题块缺选择器 —— 已自动包裹 :root,:host(工作区剥层脚本 bug)'
  );
  return `${css.slice(0, rel)}:root, :host {\n${seg}\n}\n${css.slice(cut + 1)}`;
};

const toShadow = (css: string): string =>
  css
    .replace(/(^|[\s,{};])html\.dark\s+/g, '$1.lj-dark ')
    .replace(/(^|[\s,{};])html\.light\s+/g, '$1.lj-light ')
    .replace(/:root/g, ':host');

const raw = `${wrapThemeVars(compiled)}\n${cssTokens}\n${cssShell}`;
export const STYLE_TEXT = toShadow(raw);
export const STYLE_ID = 'dsh-pet-lingchong-style';