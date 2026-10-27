/**
 * 灵宠性格系统 —— 台词表 + 纯函数决策（骨架参照 dsh-pet-indesktop 0.5.0）。
 * ---------------------------------------------------------------------------
 * 大肥鱼的铁律：**这些东西一行都不写在组件里。**
 *   · 文案是一张表（按事件分桶），逐字写定；
 *   · 「现在该说哪句 / 该不该弹气泡」是纯函数，同样的输入永远给同样的输出；
 *   · 未知灵宠 / 未知事件一律退回兜底桶，装饰品不许抛异常。
 *
 * 与大肥鱼的差异：它没有接 DSH 对话（文档自述 uiSession 只判了存在性）；
 * 本插件的对话流轮询（dshChat.ts）是真信号，所以这里多出 chat-* 桶。
 * 三条语气红线照抄：不自指 AI、不刻薄、不撒娇过量。
 */

/* ------------------------------------------------------------------ */
/* 台词桶                                                              */
/* ------------------------------------------------------------------ */

export type PersonaBucket =
  | 'greet-first' // 初次见面（totalTaps === 0）
  | 'greet-shy' // 还很怕生（totalTaps < SHY_UNTIL）
  | 'greet-reunion' // 久别重逢（> REUNION_MS）
  | 'greet-daily' // 平常打招呼（今天第一次见 / 日常）
  | 'tap' // 轻叩
  | 'combo' // 连击心流
  | 'chat-reply' // DSH 回复完成 → 陪伴语
  | 'chat-busy' // DSH 正在生成 → 安静陪伴
  | 'chat-called' // 消息里叫了它 → 开心
  | 'chat-praise'; // 消息里夸它 → 害羞开心

type LineTable = Record<PersonaBucket, string[]>;

/** 怕生阈值：累计轻叩少于这个数，见面仍是怕生语气 */
export const SHY_UNTIL = 5;
/** 久别阈值：超过这么久没见，算「回来啦」 */
export const REUNION_MS = 30 * 60 * 1000;

const CAT: LineTable = {
  'greet-first': ['初次见面…我是奶桃。可以、可以轻轻敲我一下吗？', '（从软垫里探出头）这里是你的桌面吗…那我就住下了。'],
  'greet-shy': ['那、那个…今天也拜托你了。', '（小声）我还不太熟你，但…可以慢慢来。'],
  'greet-reunion': ['你回来啦！呼噜呼噜——我一直在老位置等你。', '（伸懒腰）你不在的时候我也睡得很香，但现在是陪你时间。'],
  'greet-daily': ['今天也一起慢慢来。', '（把尾巴绕成一圈）我蹲好啦，你忙你的。'],
  tap: ['呼噜呼噜~', '能量 +1，呼噜共振。', '（眯眼）再敲一下嘛。', '软软的，敲不坏。'],
  combo: ['心流共振…尾巴停不下来了！', '连击中！呼噜马力全开！'],
  'chat-reply': ['这一段写完啦，歇口气，我陪你看。', '（竖起耳朵）回复来了，我帮你盯着。', '它答完了。你慢慢读，我在这里。'],
  'chat-busy': ['（安静趴下）你在忙，我不出声。', '生成中…我把呼噜调到静音档。'],
  'chat-called': ['叫我？我在！尾巴已经在摇了。', '（耳朵竖起来）是喊我吗？'],
  'chat-praise': ['（用爪子捂脸）被夸奖了…呼噜声更大了。', '嘿嘿，谢谢你。尾巴出卖了我。']
};

const DOG: LineTable = {
  'greet-first': ['汪！初次见面，我是阳光小金毛！以后我们一起摇尾巴！', '（叼来一个球）见面礼！先放你桌上啦！'],
  'greet-shy': ['（歪头）你是新朋友吗？那…先敲我一下认识一下吧！'],
  'greet-reunion': ['汪汪！你回来啦！我一秒都没忘记你！', '（原地转圈）终于等到你！我们继续吧！'],
  'greet-daily': ['早上好呀！今天也元气满满！', '（坐好）我 ready 了，你随时开始！'],
  tap: ['汪！能量 +1！', '（摇尾巴）再来再来！', '开心！尾巴要摇出风扇了！', '敲敲更健康！'],
  combo: ['连击心流！！我已经跑起来了！', '汪汪汪！这就是心流吗！'],
  'chat-reply': ['回复完成！好棒！我去叼个球庆祝！', '（趴在你手边）写完了就休息一下，我看着呢。', '它答完啦！我帮你确认过尾巴了！'],
  'chat-busy': ['（安静坐好）你在忙，我陪你，不出声。', '生成中…我帮你盯着进度条！'],
  'chat-called': ['汪！叫我吗？！我在这里！', '（耳朵立正）有什么吩咐！'],
  'chat-praise': ['（害羞转圈）嘿嘿，被夸了！尾巴停不下来！', '谢谢！今晚加餐吗！']
};

const CAPYBARA: LineTable = {
  'greet-first': ['……（慢悠悠抬头）初次见面。我是水豚。不着急，慢慢来。', '（泡在想象的热泉里）你好。这里水温刚好。'],
  'greet-shy': ['（淡定看你）……嗯。可以敲一下试试。'],
  'greet-reunion': ['（缓缓睁眼）你回来了。温泉一直温着。', '好久不见。哦，其实对我来说，刚眨了下眼。'],
  'greet-daily': ['今天也淡定地陪你。', '（半睁眼）嗯，开始吧。我守着。'],
  tap: ['……嗯。', '（耳朵动了动）+1。', '淡定。继续。', '（挪了 3 厘米）很开心。'],
  combo: ['（依旧淡定）心流……嗯，不错。', '连击。水豚式鼓掌。'],
  'chat-reply': ['（睁开一只眼）回复好了。不急，慢慢看。', '它说完了。嗯，都挺好的。', '写完了。深呼吸，我陪你泡一会儿。'],
  'chat-busy': ['（闭目养神）你在忙。世界很安静。', '生成中……我帮你把水温保持住。'],
  'chat-called': ['（缓缓转头）嗯。我在。', '（挪过来一点）叫我做什么都可以。'],
  'chat-praise': ['（微微红了脸）……谢谢。水豚也会开心的。']
};

const GENERIC: LineTable = {
  'greet-first': ['初次见面，我是你的灵宠。轻轻敲我一下，我们就认识了。'],
  'greet-shy': ['（小小的期待）今天也拜托你了。'],
  'greet-reunion': ['你回来啦！我一直在这里等你。'],
  'greet-daily': ['今天也一起加油呀。', '（凑近了一点）我蹲好啦。'],
  tap: ['能量 +1！', '（开心）再敲一下嘛。', '呼噜呼噜~'],
  combo: ['连击心流，好厉害！'],
  'chat-reply': ['回复来啦，我陪你看。', '（竖起耳朵）它答完了。慢慢读。'],
  'chat-busy': ['（安静陪着）你在忙，我不打扰。'],
  'chat-called': ['叫我？我在！'],
  'chat-praise': ['（害羞）谢谢夸奖。']
};

const TABLES: Record<string, LineTable> = {
  cat: CAT,
  dog: DOG,
  capybara: CAPYBARA
};

/** 任意灵宠（含用户导入的 custom-*）都有台词；未知 id 走通用兜底。 */
export function linesFor(petId: string): LineTable {
  return TABLES[petId] ?? GENERIC;
}

/* ------------------------------------------------------------------ */
/* 纯函数：选台词（避免连续重复）                                        */
/* ------------------------------------------------------------------ */

const lastPicked = new Map<string, string>();

export function pickLine(bucket: PersonaBucket, lines: string[]): string {
  if (lines.length === 0) return '';
  if (lines.length === 1) return lines[0];
  const key = `${bucket}`;
  const prev = lastPicked.get(key);
  const pool = lines.filter((l) => l !== prev);
  const picked = pool[Math.floor(Math.random() * pool.length)] ?? lines[0];
  lastPicked.set(key, picked);
  return picked;
}

/* ------------------------------------------------------------------ */
/* 纯函数：见面问候（大肥鱼 nextGreeting 的灵宠版）                       */
/* ------------------------------------------------------------------ */

export type GreetBucket = Extract<
  PersonaBucket,
  'greet-first' | 'greet-shy' | 'greet-reunion' | 'greet-daily'
>;

export interface GreetState {
  /** 这组状态属于哪一天（本地时间，YYYY-MM-DD） */
  day: string;
  /** 上次见面 epoch ms；0 = 从没见过 */
  lastSeenAt: number;
}

export interface GreetResult {
  bucket: GreetBucket;
  /** 跨天翻篇 */
  rolledOver: boolean;
  /** 处理后的下一份状态（lastSeenAt = now） */
  next: GreetState;
}

/**
 * 优先级（写死，也写进 e2e）：
 *   1. totalTaps === 0            → greet-first（初次见面）
 *   2. 见过面且离 now > REUNION_MS → greet-reunion（久别重逢；比跨天优先，
 *      隔了一夜的「回来啦」比「今天也加油」更真）
 *   3. 跨天翻篇                   → greet-daily
 *   4. totalTaps < SHY_UNTIL      → greet-shy
 *   5. 其余                       → greet-daily
 * lastSeenAt 为 0 不算久别（「从没见过」不是「等你很久」）。
 */
export function nextGreeting(
  state: GreetState,
  now: number,
  totalTaps: number,
  dayOf: (d: Date) => string
): GreetResult {
  const day = dayOf(new Date(now));
  const rolledOver = state.day !== day;
  let bucket: GreetBucket;
  if (totalTaps === 0) bucket = 'greet-first';
  else if (state.lastSeenAt > 0 && now - state.lastSeenAt > REUNION_MS) bucket = 'greet-reunion';
  else if (rolledOver) bucket = 'greet-daily';
  else if (totalTaps < SHY_UNTIL) bucket = 'greet-shy';
  else bucket = 'greet-daily';
  return { bucket, rolledOver, next: { day, lastSeenAt: now } };
}

/* ------------------------------------------------------------------ */
/* 纯函数：对话消息 → 事件（叫名字 / 夸它）                              */
/* ------------------------------------------------------------------ */

export type ChatEvent = 'called' | 'praise';

const PRAISE_RE = /(谢谢|辛苦|真棒|好棒|太棒|厉害|真乖|好乖|可爱|喜欢你|做得好|完美)/;

/** 从灵宠 label 里提取叫名关键词：≥2 个字的标签本体 + 通用词「灵宠」 */
export function callKeywords(labels: string[]): string[] {
  const kws = new Set<string>(['灵宠']);
  for (const label of labels) {
    const clean = label.replace(/^EDITION\s*NO\.\d+$/i, '').trim();
    if (clean.length >= 2) {
      kws.add(clean);
      // 「阳光小金毛」这类：去掉前两字的修饰也认（小金毛 / 金毛）
      if (clean.length >= 4) kws.add(clean.slice(2));
    }
  }
  return [...kws];
}

/** 消息文本 → 事件。没有命中就是 null（大多数消息都走这里）。 */
export function matchChatEvent(text: string, keywords: string[]): ChatEvent | null {
  const t = (text || '').slice(0, 400);
  if (!t) return null;
  if (PRAISE_RE.test(t)) return 'praise';
  for (const kw of keywords) {
    if (kw && t.includes(kw)) return 'called';
  }
  return null;
}