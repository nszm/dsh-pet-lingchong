/**
 * 「照片 / 一句话 → 3D」站点的两种展示：
 *   · ThreeDSiteLinks —— 一行平铺（只放 primary 三家），给导入向导用；
 *   · ThreeDSitesGuide —— 完整清单（含额度与注意事项），给设置页用。
 * 文案与链接都在 threeD.ts —— 换推广链接只改那一个文件。
 */
import type React from 'react';
import { PRIMARY_3D_SITES, THREE_D_SITES } from './threeD';

export function ThreeDSiteLinks(): React.ReactElement {
  return (
    <>
      {PRIMARY_3D_SITES.map((site, i) => {
        const last = i === PRIMARY_3D_SITES.length - 1;
        return (
          <span key={site.label}>
            {i > 0 && (last ? ' 或 ' : '、')}
            <a
              href={site.href}
              target="_blank"
              rel="noreferrer"
              className="text-pet-accent-teal underline"
            >
              {site.label}
            </a>
          </span>
        );
      })}
    </>
  );
}

/** 六家的完整清单：名称（可点）+ 免费额度 + 限制 */
export function ThreeDSitesGuide(): React.ReactElement {
  return (
    <ul className="space-y-1.5">
      {THREE_D_SITES.map((site) => (
        <li key={site.label} className="text-[10px] leading-relaxed">
          <a
            href={site.href}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-pet-accent-teal underline"
          >
            {site.label}
          </a>
          <span className="ml-1.5 text-pet-charcoal">{site.quota}</span>
          <span className="ml-1 text-pet-muted">· {site.note}</span>
        </li>
      ))}
    </ul>
  );
}
