/**
 * 灵宠飘字 / 粒子层：心愿文案胶囊（chip）+ 随机反应气泡（emoji）+ 金色火花（sparkle）。
 * 舞台与桌面灵宠卡共用 —— 两边飘出来的字必须一模一样（用户口径）。
 * 坐标是父容器的百分比，父容器需 relative。
 */
import type React from 'react';
import type { Particle } from './usePetEngine';

export function PetParticles({ particles }: { particles: Particle[] }) {
  return (
    <>
    {particles.map((p) => {
      if (p.type === 'chip') {
        return (
          <div
            key={p.id}
            className="absolute pointer-events-none text-xs font-pet-mono font-bold px-3.5 py-1.5 rounded-full bg-pet-surface text-pet-charcoal border border-pet-gold/40 shadow-[0_8px_24px_rgba(212,175,55,0.12)] flex items-center gap-1.5 select-none z-30 clay-badge-rise tracking-wider whitespace-nowrap"
            style={{ left: `${p.left}%`, top: `${p.top}%`, transform: 'translate(-50%, -50%)' }}
          >
            <span className="text-pet-accent-amber font-bold">✨</span>
            <span>{p.text}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          </div>
        );
      }
      if (p.type === 'emoji') {
        return (
          <div
            key={p.id}
            className="absolute pointer-events-none text-xs font-bold px-3 py-1 rounded-full bg-pet-surface/95 text-pet-charcoal border border-pet-line shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex items-center gap-1.5 select-none z-40 emoji-pop-bubble font-display backdrop-blur-xs whitespace-nowrap"
            style={
              {
                left: `${p.left}%`,
                top: `${p.top}%`,
                '--rot-start': p.rotStart,
                '--rot-mid': p.rotMid,
                '--rot-end': p.rotEnd
              } as React.CSSProperties
            }
          >
            <span className="text-pet-accent-amber text-[12px]">✨</span>
            <span>{p.text}</span>
          </div>
        );
      }
      return (
        <div
          key={p.id}
          className="absolute w-1.5 h-1.5 rounded-full bg-amber-400 pointer-events-none sparkle-particle"
          style={
            {
              left: `${p.left}%`,
              top: `${p.top}%`,
              '--tx': `${p.tx}px`,
              '--ty': `${p.ty}px`
            } as React.CSSProperties
          }
        />
      );
    })}
    </>
  );
}
