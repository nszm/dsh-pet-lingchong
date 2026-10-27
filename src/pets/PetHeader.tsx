/**
 * 灵宠页头 —— 品牌「灵宠」+ 两个可用页签 + 可用的设置 / 颂钵开关。
 * 旧版页头的「全球祈福榜」页签已移除；设置与铃铛不再是装饰：
 *   · 设置：打开灵宠设置抽屉（音效 / 模式 / 目标 / 数据）
 *   · 铃铛：开关「每 100 次轻叩一声颂钵」
 */
import { Bell, BellRing, PawPrint, Settings } from 'lucide-react';
import type { PetTab } from './petData';

interface PetHeaderProps {
  headerMerit: number;
  todayTaps: number;
  activeTab: PetTab;
  onTabChange: (tab: PetTab) => void;
  bellOn: boolean;
  onToggleBell: () => void;
  onOpenSettings: () => void;
}

const NAV_TABS: Array<{ id: PetTab; label: string }> = [
  { id: 'bless', label: '敲击蓄能' },
  { id: 'gallery', label: '灵宠图鉴' }
];

export function PetHeader({
  headerMerit,
  todayTaps,
  activeTab,
  onTabChange,
  bellOn,
  onToggleBell,
  onOpenSettings
}: PetHeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full bg-pet-surface/90 backdrop-blur-2xl border-b border-pet-line shadow-[0_2px_20px_rgba(0,0,0,0.02)]">
      <div className="h-20 max-w-7xl mx-auto px-6 md:px-10 flex items-center justify-between gap-4">
        {/* Brand */}
        <button
          onClick={() => onTabChange('bless')}
          className="flex items-center gap-3 shrink-0 text-left group"
          aria-label="回到敲击蓄能"
        >
          <span className="w-9 h-9 rounded-full bg-pet-solid text-pet-on-solid flex items-center justify-center shadow-sm transition-transform group-hover:-rotate-6">
            <PawPrint className="w-[18px] h-[18px]" />
          </span>
          <span className="flex flex-col">
            <span className="font-display font-extrabold text-lg text-pet-charcoal tracking-tight leading-tight">
              灵宠
            </span>
            <span className="text-xs text-pet-muted font-medium tracking-wide">
              3D 超写实灵宠 · 典藏萌宠心流展廊
            </span>
          </span>
        </button>

        {/* Metric pills (desktop) */}
        <div className="hidden lg:flex items-center gap-2 bg-pet-stone-subtle px-3 py-1.5 rounded-full border border-pet-line shadow-xs">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-pet-surface shadow-xs border border-pet-line-soft">
            <span className="w-2.5 h-2.5 rounded-full bg-pet-tint-rose0" />
            <span className="text-xs text-pet-muted font-medium">能量池</span>
            <span className="text-xs font-bold text-pet-charcoal tracking-tight font-pet-mono">
              {headerMerit.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-pet-surface shadow-xs border border-pet-line-soft">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
            <span className="text-xs text-pet-muted font-medium">今日轻叩</span>
            <span className="text-xs font-bold text-pet-accent-teal tracking-tight font-pet-mono">
              {todayTaps.toLocaleString()} 次
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-pet-surface shadow-xs border border-pet-line-soft">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-pet-charcoal font-semibold tracking-wide">
              灵宠陪伴中
            </span>
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-pet-stone-subtle p-1 rounded-full border border-pet-line">
          {NAV_TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                aria-pressed={active}
                className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                  active
                    ? 'font-bold bg-pet-surface text-pet-charcoal shadow-xs'
                    : 'font-medium text-pet-muted hover:text-pet-charcoal'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenSettings}
            aria-label="打开灵宠设置"
            title="灵宠设置"
            className="w-10 h-10 rounded-full bg-pet-surface border border-pet-line flex items-center justify-center text-pet-graphite hover:bg-pet-stone hover:border-pet-faint transition-all shadow-xs"
          >
            <Settings className="w-[19px] h-[19px]" />
          </button>
          <button
            onClick={onToggleBell}
            aria-label={bellOn ? '关闭颂钵提示' : '开启颂钵提示'}
            aria-pressed={bellOn}
            title={bellOn ? '颂钵提示已开 · 每 100 次轻叩一声' : '颂钵提示已关'}
            className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all shadow-xs relative ${
              bellOn
                ? 'bg-pet-surface border-pet-line text-pet-graphite hover:bg-pet-stone'
                : 'bg-pet-stone border-pet-line text-pet-faint hover:text-pet-muted'
            }`}
          >
            {bellOn ? <BellRing className="w-[19px] h-[19px]" /> : <Bell className="w-[19px] h-[19px]" />}
            {bellOn && <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-pet-tint-rose0" />}
          </button>
        </div>
      </div>
    </header>
  );
}
