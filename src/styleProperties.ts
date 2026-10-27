/**
 * @property 注册桥 —— Shadow DOM 里的 @property 规则不被 Chromium 注册
 * (只认 document 级样式表),于是 tailwind 的 translate、scale、rotate 等
 * 依赖 --tw 注册属性的工具类全部哑火:var(--tw-translate-y) 解析成空串,
 * 整条 translate 声明在 computed 阶段作废(实测开关旋钮 dx=4 而非 18,
 * computed translate = none)。设置面板的开关"按钮样式不完整"即此。
 *
 * 修法:把样式表里的 @property 规则用 CSS.registerProperty()(JS API)注册到
 * document 级 —— 纯元数据,零样式注入,不触碰宿主页面;这些变量只被本插件
 * 的 shadow 元素引用,对 DSH 自身零影响。幂等:已注册的同名属性跳过。
 */

const PROP_RE = /@property\s+([-\w]+)\s*\{([^}]*)\}/g;

function attr(body: string, name: string): string | undefined {
  const m = body.match(new RegExp(`${name}\\s*:\\s*([^;]+)`));
  return m ? m[1].trim() : undefined;
}

export function registerStyleProperties(css: string): number {
  if (typeof CSS === 'undefined' || typeof CSS.registerProperty !== 'function') return 0;
  let registered = 0;
  const re = new RegExp(PROP_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const name = m[1];
    const body = m[2];
    const syntax = attr(body, 'syntax')?.replace(/^["']|["']$/g, '') ?? '*';
    const inherits = (attr(body, 'inherits') ?? 'false') === 'true';
    const initialValue = attr(body, 'initial-value');
    try {
      /* ⚠ 没有 initial-value 的属性(如 --tw-leading)必须【不传】initialValue:
         注册成 guaranteed-invalid,var(--tw-leading, 回退) 的回退才生效。
         兜底 '0' 会把全页行高打成 0 —— 文本盒子全部塌陷、互相叠字
         (2026-10-26 设置面板「重影」的直接原因,踩过一次,勿改回)。 */
      const desc = {
        name,
        syntax,
        inherits,
        ...(initialValue && initialValue.length > 0 ? { initialValue } : {})
      };
      CSS.registerProperty(desc);
      registered += 1;
    } catch {
      /* 同名已注册(宿主/别的插件先注册了):跳过 —— 语义一致,无需覆盖 */
    }
  }
  return registered;
}