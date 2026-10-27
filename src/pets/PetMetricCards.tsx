/**
 * 指标卡组 —— 今日能量 / 光晕灵气 / 连击心流 / 灵宠段位。
 * 文案全中文（旧版的 Daily Merit / Aura Pool / STRICT LIGHT 等品牌词已去掉）；
 * 今日能量卡接「每日目标」，数值来自本机真实进度。
 */
import React from 'react';
import { Heart, Lightbulb, Zap, Diamond } from 'lucide-react';

interface PetMetricCardsProps {
  merit: number;
  stress: number;
  combo: number;
  comboBar: number;
  comboSubtext: string;
  rankLabel: string;
  goal: number;
  totalTaps: number;
}

export function PetMetricCards({
  merit,
  stress,
  combo,
  comboBar,
  comboSubtext,
  rankLabel,
  goal,
  totalTaps
}: PetMetricCardsProps) {
  const goalDone = goal > 0 && merit >= goal;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 今日能量 */}
      <MetricCard
        label="今日能量"
        icon={<Heart className="w-[17px] h-[17px]" />}
        iconWrap="bg-pet-tint-rose border-pet-tint-rose-line text-pet-accent-rose"
        value={merit.toLocaleString()}
        sub1="+1 / 次"
        sub1Class={goalDone ? 'text-pet-accent-teal' : 'text-pet-accent-rose'}
        sub2={goalDone ? '今日目标已达成' : `目标 ${goal} · 还差 ${goal - merit} 次`}
      />
      {/* 光晕灵气 */}
      <MetricCard
        label="光晕灵气"
        icon={<Lightbulb className="w-[17px] h-[17px]" />}
        iconWrap="bg-pet-tint-amber border-pet-tint-amber-line text-pet-accent-amber"
        value={stress.toLocaleString()}
        sub1="+6 / 次"
        sub1Class="text-pet-accent-amber"
        sub2="情绪净化灵气池"
      />
      {/* 连击心流 */}
      <div className="bg-pet-surface rounded-[1.75rem] p-4 border border-pet-line shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold tracking-widest text-pet-muted">
            连击心流
          </span>
          <span className="w-8 h-8 rounded-full bg-pet-tint-teal border border-pet-tint-teal-line flex items-center justify-center text-pet-accent-teal">
            <Zap className="w-[17px] h-[17px]" />
          </span>
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-pet-charcoal tracking-tight font-pet-mono">
              x{combo}
            </div>
            <span className="text-[11px] font-bold tracking-wider text-pet-accent-teal">
              {comboSubtext}
            </span>
          </div>
          <div className="w-full h-1.5 bg-pet-stone rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-pet-charcoal rounded-full transition-all duration-200"
              style={{ width: `${comboBar}%` }}
            />
          </div>
        </div>
      </div>
      {/* 灵宠段位 */}
      <MetricCard
        label="灵宠段位"
        icon={<Diamond className="w-[17px] h-[17px]" />}
        iconWrap="bg-pet-stone border-pet-line text-pet-charcoal"
        value={rankLabel}
        valueClass="text-2xl truncate"
        badge={
          <span className="px-2.5 py-0.5 rounded-full bg-pet-stone text-pet-charcoal font-bold text-[10px] tracking-wider">
            常驻陪伴
          </span>
        }
        sub2={`累计轻叩 ${totalTaps.toLocaleString()} 次`}
      />
    </div>
  );
}

interface MetricCardProps {
  label: string;
  icon: React.ReactNode;
  iconWrap: string;
  value: string;
  valueClass?: string;
  sub1?: string;
  sub1Class?: string;
  sub2?: string;
  badge?: React.ReactNode;
}

function MetricCard({
  label,
  icon,
  iconWrap,
  value,
  valueClass = 'text-3xl',
  sub1,
  sub1Class,
  sub2,
  badge
}: MetricCardProps) {
  return (
    <div className="bg-pet-surface rounded-[1.75rem] p-4 border border-pet-line shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] font-bold tracking-widest text-pet-muted">
          {label}
        </span>
        <span className={`w-8 h-8 rounded-full flex items-center justify-center border ${iconWrap}`}>
          {icon}
        </span>
      </div>
      <div>
        <div className={`font-extrabold text-pet-charcoal tracking-tight font-pet-mono ${valueClass}`}>
          {value}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-pet-muted font-medium">
          {sub1 && <span className={`font-semibold ${sub1Class}`}>{sub1}</span>}
          {badge}
          {sub2 && <span>{sub2}</span>}
        </div>
      </div>
    </div>
  );
}
