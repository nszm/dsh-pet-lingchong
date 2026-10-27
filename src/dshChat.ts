/**
 * 灵宠 × DSH 对话联动（浏览器半边，零宿主依赖）。
 * ---------------------------------------------------------------------------
 * 灵宠和 DSH 的对话界面跑在**同一个页面**里,对话流的座位
 * `conversation.chat.flow` / `conversation.chat.node` / `conversation.user.text.node`
 * 就在 DOM 树上(2026-10-25 CDP 实测)。轮询它们比监听宿主内部事件
 * (`llm/stream` 之类)更稳:不依赖事件名、不怕版本漂移。
 *
 * 规则:
 *   · 只在真 DSH(dsh-app:// 协议)启用 —— 主项目页面没有对话流;
 *   · 每秒读一次对话流:节点数 / 末节点归属 / 末节点文本长度 / 最近一条用户消息;
 *   · **回复完成**才触发 onReply —— 新的助手节点出现时进入 pending,其文本
 *     长度连续两拍不再增长(或用户发了新消息)才算说完。生成期间 onBusyChange(true),
 *     说完回落 false。自己发消息不触发回复,但会触发 onUserMessage(关键词事件用);
 *   · 切换会话(节点数重置)最多误报一次,无害。
 */
import { useEffect, useRef } from 'react';

const FLOW_SEL = '[data-slot="conversation.chat.flow"]';
const NODE_SEL = '[data-slot="conversation.chat.node"]';
const USER_SEL = '[data-slot="conversation.user.text.node"]';

interface ChatPulse {
  count: number | null;
  /** 最后一个节点是不是用户自己发的 */
  lastIsUser: boolean;
  /** 末节点文本长度(生成中会增长;-1 = 末节点是用户消息) */
  lastLen: number;
  /** 最近一条用户消息文本(截断,只做本机关键词匹配,不出页面) */
  lastUserText: string | null;
}

function readFlow(): ChatPulse {
  try {
    const flow = document.querySelector(FLOW_SEL);
    if (!flow) return { count: null, lastIsUser: false, lastLen: -1, lastUserText: null };
    const nodes = flow.querySelectorAll(NODE_SEL);
    const list = nodes.length > 0 ? nodes : (flow.children as HTMLCollection);
    const n = list.length;
    const last = n > 0 ? (list[n - 1] as Element) : null;
    const lastIsUser = !!(last && last.querySelector && last.querySelector(USER_SEL));
    // 最近一条用户消息:从尾向前找第一个含 user 座位的节点
    let lastUserText: string | null = null;
    for (let i = n - 1; i >= 0; i--) {
      const node = list[i] as Element;
      if (node.querySelector && node.querySelector(USER_SEL)) {
        const el = node.querySelector(USER_SEL);
        lastUserText = (el && el.textContent ? el.textContent : '').trim().slice(0, 400) || null;
        break;
      }
    }
    let lastLen = -1;
    if (last && !lastIsUser) {
      lastLen = (last.textContent || '').length;
    }
    return { count: n, lastIsUser, lastLen, lastUserText };
  } catch {
    return { count: null, lastIsUser: false, lastLen: -1, lastUserText: null };
  }
}

export interface DshChatHandlers {
  /** 一条 DSH 回复**说完**(流式结束) */
  onReply?: () => void;
  /** 用户发出一条新消息(文本仅本机使用) */
  onUserMessage?: (text: string) => void;
  /** 生成中状态翻转 */
  onBusyChange?: (busy: boolean) => void;
}

/** 兼容旧签名:直接传函数 = 只关心 onReply */
export function useDshChatReplies(handlers: DshChatHandlers | (() => void)): void {
  const ref = useRef<DshChatHandlers>(
    typeof handlers === 'function' ? { onReply: handlers } : handlers
  );
  ref.current = typeof handlers === 'function' ? { onReply: handlers } : handlers;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let inDsh = false;
    try {
      inDsh = window.location.protocol === 'dsh-app:';
    } catch {
      return;
    }
    if (!inDsh) return;

    let prev: { count: number; lastLen: number; lastIsUser: boolean } | null = null;
    let prevUserText: string | null = null;
    let pendingReply = false;
    let busy = false;

    const timer = window.setInterval(() => {
      const pulse = readFlow();
      if (pulse.count == null) {
        // 对话界面不在(切到别的页)——全部重置
        prev = null;
        pendingReply = false;
        if (busy) {
          busy = false;
          ref.current.onBusyChange && ref.current.onBusyChange(false);
        }
        return;
      }
      if (prev != null) {
        // ① 新助手节点出现 → 进入「生成中」,等它说完
        if (pulse.count > prev.count && !pulse.lastIsUser && !pendingReply) {
          pendingReply = true;
          if (!busy) {
            busy = true;
            ref.current.onBusyChange && ref.current.onBusyChange(true);
          }
        }
        // ② 说完的判定:pending 且文本长度一拍未增 → 完成
        if (pendingReply && !pulse.lastIsUser && pulse.lastLen === prev.lastLen) {
          pendingReply = false;
          if (busy) {
            busy = false;
            ref.current.onBusyChange && ref.current.onBusyChange(false);
          }
          ref.current.onReply && ref.current.onReply();
        }
        // ③ 还没说完用户就发了新消息 → 这条回复按完成算(用户已经在读/回)
        else if (pendingReply && pulse.lastIsUser) {
          pendingReply = false;
          if (busy) {
            busy = false;
            ref.current.onBusyChange && ref.current.onBusyChange(false);
          }
          ref.current.onReply && ref.current.onReply();
        }
        // ④ 用户新消息(关键词事件用;首拍不发,避免切页误报)
        if (pulse.lastUserText && pulse.lastUserText !== prevUserText) {
          prevUserText = pulse.lastUserText;
          ref.current.onUserMessage && ref.current.onUserMessage(pulse.lastUserText);
        } else if (!pulse.lastUserText) {
          prevUserText = null;
        }
      } else {
        // 首拍:只记基线,不触发
        prevUserText = pulse.lastUserText;
      }
      prev = { count: pulse.count, lastLen: pulse.lastLen, lastIsUser: pulse.lastIsUser };
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
}