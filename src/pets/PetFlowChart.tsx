/**
 * 七日心流 —— 从演示数据改为本机真实轻叩记录（近 7 天，含今天）。
 */
import { dateKey } from '../host/dateKey';
import { WEEKDAY_LABELS } from './petData';

interface PetFlowChartProps {
  daily: Record<string, number>;
  tapsToday: number;
  goal: number;
}

export function PetFlowChart({ daily, tapsToday, goal }: PetFlowChartProps) {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const key = dateKey(d);
    return {
      key,
      label: WEEKDAY_LABELS[d.getDay()],
      value: daily[key] ?? 0,
      today: i === 6
    };
  });

  const max = Math.max(1, ...days.map((d) => d.value));
  const weekTotal = days.reduce((sum, d) => sum + d.value, 0);
  const weekGoal = goal > 0 ? goal * 7 : 0;
  const weekHit = weekGoal > 0 ? Math.min(100, Math.round((weekTotal / weekGoal) * 100)) : 0;

  return (
    <div className="bg-pet-surface rounded-[1.75rem] p-5 border border-pet-line shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold tracking-wider text-pet-charcoal">
          七日心流
        </h4>
        <span className="text-[11px] font-bold text-pet-accent-teal font-pet-mono">
          周目标 {weekHit}%
        </span>
      </div>
      <div className="flex items-end justify-between h-20 pt-3 px-2">
        {days.map((d) => (
          <div
            key={d.key}
            className="flex flex-col items-center gap-1.5"
            title={`${d.key} · ${d.value} 次`}
          >
            <div
              className={`w-3 rounded-full transition-all duration-300 ${
                d.today ? 'bg-pet-charcoal' : d.value > 0 ? 'bg-pet-faint' : 'bg-pet-faint/40'
              }`}
              style={{ height: `${Math.max(6, Math.round((d.value / max) * 64))}px` }}
            />
            <span
              className={`text-[10px] font-pet-mono ${
                d.today ? 'font-bold text-pet-charcoal' : 'text-pet-muted'
              }`}
            >
              {d.label}
            </span>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-pet-muted text-center pt-2 border-t border-pet-line-soft font-pet-mono">
        {weekTotal > 0 ? `本周 ${weekTotal} 次 · 今日 ${tapsToday} 次` : '还没有心流记录 · 轻叩开始'}
      </div>
    </div>
  );
}
