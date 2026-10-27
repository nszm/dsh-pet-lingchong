/**
 * 声学工具条（触感声学 / 飘字心愿 / 自动巡航）——
 * 从 222/project/src/components/SoundToolbar.tsx 复刻。
 * 适配：rounded-2xl 主程序默认值一致（v3/v4 均为 1rem），无需替换；
 *       font-mono → font-pet-mono。
 */
import { AudioLines, Sparkles, Radar } from 'lucide-react';
import { BLESSING_OPTIONS, SOUND_LABELS, SOUND_TYPES, type SoundType } from './petData';

interface PetSoundToolbarProps {
  sound: SoundType;
  onSoundChange: (s: SoundType) => void;
  blessing: string;
  onBlessingChange: (b: string) => void;
  autoActive: boolean;
  onToggleAuto: () => void;
}

export function PetSoundToolbar({
  sound,
  onSoundChange,
  blessing,
  onBlessingChange,
  autoActive,
  onToggleAuto
}: PetSoundToolbarProps) {
  return (
    <div className="bg-pet-surface/95 rounded-2xl p-3 border border-pet-line shadow-[0_2px_14px_rgba(0,0,0,0.02)] flex flex-wrap items-center justify-between gap-3">
      {/* Sound switch */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider text-pet-muted font-pet-mono">
          <AudioLines className="w-[16px] h-[16px] text-pet-charcoal" />
          <span>触感声学</span>
        </div>
        <div className="flex items-center gap-1 bg-pet-stone p-1 rounded-full">
          {SOUND_TYPES.map((s) => (
            <button
              key={s}
              onClick={() => onSoundChange(s)}
              className={`px-3.5 py-1 rounded-full text-xs transition-all ${
                sound === s
                  ? 'font-bold bg-pet-surface text-pet-charcoal shadow-xs'
                  : 'font-medium text-pet-muted hover:text-pet-charcoal'
              }`}
            >
              {SOUND_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Blessing selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-pet-muted hidden sm:inline-flex items-center gap-1 font-pet-mono">
          <Sparkles className="w-[16px] h-[16px] text-pet-accent-amber" />
          飘字心愿
        </span>
        <select
          value={blessing}
          onChange={(e) => onBlessingChange(e.target.value)}
          className="bg-pet-stone text-xs font-bold text-pet-charcoal py-1.5 px-3.5 rounded-full border border-pet-line outline-none cursor-pointer focus:ring-1 focus:ring-pet-faint"
        >
          {BLESSING_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {/* Auto tapper */}
      <button
        onClick={onToggleAuto}
        className={`flex items-center gap-2 px-5 py-2 rounded-full border text-xs font-bold transition-all active:scale-95 shadow-xs font-pet-mono ${
          autoActive
            ? 'bg-pet-charcoal border-pet-charcoal text-pet-on-solid'
            : 'bg-pet-stone hover:bg-pet-track border-pet-line text-pet-charcoal'
        }`}
      >
        <Radar className="w-[17px] h-[17px]" />
        <span>{autoActive ? '自动巡航中 · 点击停止' : '开启自动巡航'}</span>
      </button>
    </div>
  );
}
