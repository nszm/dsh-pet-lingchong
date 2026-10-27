/**
 * 陪伴日记 —— 取代旧版的「全球祈福流」。
 * 只记录本机真实发生的轻叩（每 6 次一笔），不伪造城市与陌生人。
 */
import { BookOpen, PawPrint } from 'lucide-react';
import type { PetLogItem } from './petData';

interface PetCompanionLogProps {
  feed: PetLogItem[];
  tapsToday: number;
}

export function PetCompanionLog({ feed, tapsToday }: PetCompanionLogProps) {
  return (
    <div className="bg-pet-surface rounded-[1.75rem] p-5 border border-pet-line shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-[19px] h-[19px] text-pet-charcoal" />
          <h3 className="font-display font-extrabold text-base tracking-tight text-pet-charcoal">
            陪伴日记
          </h3>
        </div>
        <span className="text-[11px] font-bold text-pet-accent-teal font-pet-mono">
          今日 {tapsToday.toLocaleString()} 次
        </span>
      </div>
      <span className="text-[11px] font-medium tracking-wide text-pet-muted -mt-2">
        只记录本机 · 每 6 次轻叩留一笔
      </span>

      {feed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-pet-line bg-pet-stone/60 px-4 py-8 flex flex-col items-center gap-2 text-center">
          <PawPrint className="w-5 h-5 text-pet-faint" />
          <span className="text-xs font-medium text-pet-muted">
            {tapsToday === 0
              ? '还没有记录。轻叩灵宠，写下今天的第一笔。'
              : `再轻叩 ${6 - (tapsToday % 6)} 次，写下今天的第一笔。`}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 overflow-hidden">
          {feed.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-2xl bg-pet-stone border border-pet-line-soft flex flex-col gap-1 transition-all"
            >
              <div className="flex items-center justify-between text-[11px] text-pet-muted">
                <span className="font-bold text-pet-charcoal">{item.pet}</span>
                <span className="font-pet-mono">{item.time}</span>
              </div>
              <span className="text-xs font-medium text-pet-charcoal leading-snug">
                {item.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
