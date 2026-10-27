/**
 * 「照片 / 一句话 → 3D」站点清单（导入向导与设置面板共用）。
 * ---------------------------------------------------------------------------
 * ⚠ 要换成自己的推广 / 邀请链接**只改这里**：两处 UI 都从这个数组渲染，
 *   改完跑一次 `node scripts/build.mjs` 全站生效。
 *
 * 额度是 2026-10 查到的公开信息，官方随时会调；界面上写的是「约」，
 * 要精确以各站点为准 —— 更新这里即可，不用动组件。
 */
export interface ThreeDSite {
  label: string;
  href: string;
  /** 免费额度（一句话） */
  quota: string;
  /** 限制 / 特点（一句话） */
  note: string;
  /** true = 在导入向导里直接平铺成链接，其余只出现在设置页的完整清单里 */
  primary?: boolean;
}

export const THREE_D_SITES: ThreeDSite[] = [
  {
    label: '腾讯混元 3D',
    href: 'https://3d.hunyuan.tencent.com',
    quota: '每天 20 积分 = 20 个',
    note: '国内直连，自带智能拓扑（三角转四边）、自动 UV、自动绑骨',
    primary: true
  },
  {
    label: 'meshy.ai',
    // 邀请链接（2026-10-27 换成推广位；换成别人的只改这一行）
    href: 'https://www.meshy.ai/?utm_source=meshy&utm_medium=referral-program&utm_content=6RD3HF&share_type=invite-friends',
    quota: '每月 100 积分 ≈ 3~5 个',
    note: '免费版 CC BY 4.0：可商用，但必须署名',
    primary: true
  },
  {
    label: 'tripo3d.ai',
    href: 'https://www.tripo3d.ai',
    quota: '每月 200 积分 ≈ 8 个',
    note: '免费版不可商用，且生成的模型会公开',
    primary: true
  },
  {
    label: '3D AI Studio',
    href: 'https://www.3daistudio.com',
    quota: '每月 1000 credits ≈ 100 个资产',
    note: '下载的模型归你自己，额度最宽松'
  },
  {
    label: 'Hyper3D Rodin',
    href: 'https://hyper3d.ai',
    quota: '生成不限次、全部免费',
    note: '下载要付费 —— 适合先免费看效果、满意再换别家出'
  },
  {
    label: 'HuggingFace Space',
    href: 'https://hf-mirror.com/spaces',
    quota: '免注册，但要排队',
    note: 'Hunyuan3D-2 / TripoSR / TRELLIS / Stable Fast 3D，可直接下 GLB；国内走 hf-mirror'
  }
];

/** 导入向导里平铺的那三家（primary） */
export const PRIMARY_3D_SITES = THREE_D_SITES.filter((s) => s.primary);
