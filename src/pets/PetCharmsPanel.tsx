/**
 * 灵宠护符 + 颂钵提示 —— 护符解锁进度接真实累计轻叩；颂钵卡片本身可开关。
 */
import React from 'react';
import { Flower, BellRing, Lock, BellOff } from 'lucide-react';

interface PetCharmsPanelProps {
  totalTaps: number;
  bellOn: boolean;
  soundOn: boolean;
  onToggleBell: () => void;
}

const UNLOCK_TAPS = 1000;

export function PetCharmsPanel({
  totalTaps,
  bellOn,
  soundOn,
  onToggleBell
}: PetCharmsPanelProps) {
  const unlocked = totalTaps >= UNLOCK_TAPS;
  const unlockProgress = Math.min(100, Math.round((totalTaps / UNLOCK_TAPS) * 100));

  return (
    <div className="flex flex-col gap-6">
      {/* Lucky charms deck */}
      <div className="bg-pet-surface rounded-[1.75rem] p-5 border border-pet-line shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col gap-3">
        <div className="flex items-center justify-between pb-1">
          <h4 className="text-xs font-bold tracking-wider text-pet-charcoal">
            灵宠护符
          </h4>
          <span className="text-[11px] font-bold text-pet-accent-rose font-pet-mono">
            {unlocked ? 3 : 2} / 3 生效
          </span>
        </div>

        <Charm
          wrap="bg-pet-tint-amber/70 border-pet-tint-amber-line"
          iconWrap="bg-pet-surface border-pet-tint-amber-line text-pet-accent-amber"
          icon={<Flower className="w-[19px] h-[19px]" />}
          title="灵宠微光结界"
          desc="灵宠相伴治愈感 +45%"
        />
        <Charm
          wrap="bg-pet-tint-rose/70 border-pet-tint-rose-line"
          iconWrap="bg-pet-surface border-pet-tint-rose-line text-pet-accent-rose"
          icon={<BellRing className="w-[19px] h-[19px]" />}
          title="空灵微澜磬音"
          desc="触发纯净空灵磬音 +40%"
          statusClass="text-pet-accent-rose"
        />
        {/* 第三枚护符：累计轻叩解锁 */}
        {unlocked ? (
          <Charm
            wrap="bg-pet-tint-teal/70 border-pet-tint-teal-line"
            iconWrap="bg-pet-surface border-pet-tint-teal-line text-pet-accent-teal"
            icon={<Flower className="w-[19px] h-[19px]" />}
            title="澄心如镜护盾"
            desc="已解锁 · 心流连击更稳"
            statusClass="text-pet-accent-teal"
          />
        ) : (
          <div className="p-3 rounded-2xl bg-pet-stone/60 border border-dashed border-pet-line flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-pet-surface border border-pet-line flex items-center justify-center text-pet-faint shadow-xs">
                  <Lock className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <div className="text-xs font-medium text-pet-muted">澄心如镜护盾</div>
                  <div className="text-[10px] text-pet-faint">
                    累计轻叩 {totalTaps.toLocaleString()} / {UNLOCK_TAPS.toLocaleString()} 解锁
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-bold font-pet-mono text-pet-faint">
                {unlockProgress}%
              </span>
            </div>
            <div className="w-full h-1 bg-pet-track rounded-full overflow-hidden">
              <div
                className="h-full bg-pet-faint rounded-full transition-all duration-300"
                style={{ width: `${unlockProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bell rhythm reminder — 可点击开关 */}
      <button
        onClick={onToggleBell}
        aria-pressed={bellOn}
        className="bg-pet-surface rounded-2xl p-3.5 border border-pet-line shadow-[0_2px_14px_rgba(0,0,0,0.02)] flex items-center justify-between text-left transition-all hover:border-pet-faint active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              bellOn ? 'bg-pet-stone text-pet-charcoal' : 'bg-pet-stone text-pet-faint'
            }`}
          >
            {bellOn ? <BellRing className="w-[17px] h-[17px]" /> : <BellOff className="w-[17px] h-[17px]" />}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-pet-charcoal">清越颂钵提示</span>
            <span className="text-[11px] text-pet-muted">
              {!soundOn
                ? '互动音效已关闭'
                : bellOn
                  ? '每轻叩 100 次触发轻鸣'
                  : '已关闭 · 点击开启'}
            </span>
          </div>
        </div>
        <div className={`w-2 h-2 rounded-full ${bellOn && soundOn ? 'bg-emerald-500' : 'bg-pet-faint'}`} />
      </button>
    </div>
  );
}

interface CharmProps {
  wrap: string;
  iconWrap: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  statusClass?: string;
}

function Charm({ wrap, iconWrap, icon, title, desc, statusClass = 'text-pet-accent-amber' }: CharmProps) {
  return (
    <div className={`p-3 rounded-2xl border flex items-center justify-between transition-transform hover:-translate-y-0.5 ${wrap}`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-xs ${iconWrap}`}>
          {icon}
        </div>
        <div>
          <div className="text-xs font-bold text-pet-charcoal">{title}</div>
          <div className="text-[11px] text-pet-muted">{desc}</div>
        </div>
      </div>
      <span className={`text-[10px] font-bold tracking-wider ${statusClass}`}>生效中</span>
    </div>
  );
}
