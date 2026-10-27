/**
 * 灵宠图鉴 —— 三只常驻灵宠 + 用户导入灵宠的完整档案。
 * 每只灵宠展示：图鉴编号 / 稀有度 / 属性 / 性格 / 特长 / 题签 / 小传 /
 * 亲密度（按累计轻叩升级）与「带到舞台」。数据全部来自本机进度。
 */
import { useEffect, useState } from 'react';
import { ChevronRight, Heart, PawPrint, Plus, Sparkles, Trash2 } from 'lucide-react';
import { closenessOf, isCustomPetId, type CustomPetId, type Pet } from './petData';

interface PetGalleryProps {
  pets: Pet[];
  currentIndex: number;
  /** 打开「导入灵宠」；导入已满时不传 */
  onImport?: () => void;
  /** 移除一只导入的灵宠（常驻灵宠不可移除） */
  onRemove: (id: CustomPetId) => void;
  tapsByPet: Record<string, number>;
  totalTaps: number;
  onBringToStage: (index: number) => void;
}

const ATTRS = [
  { key: 'healing', label: '治愈力', bar: 'bg-rose-400' },
  { key: 'charm', label: '萌力', bar: 'bg-amber-400' },
  { key: 'spirit', label: '灵性', bar: 'bg-pet-tint-teal0' }
] as const;

export function PetGallery({
  pets,
  currentIndex,
  onImport,
  onRemove,
  tapsByPet,
  totalTaps,
  onBringToStage
}: PetGalleryProps) {
  const [active, setActive] = useState(currentIndex);

  useEffect(() => {
    setActive(currentIndex);
  }, [currentIndex]);

  // 二次确认：第一下变成「确认移除」，3 秒内再点才真删
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => {
    if (!confirmRemove) return;
    const t = window.setTimeout(() => setConfirmRemove(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirmRemove]);
  useEffect(() => setConfirmRemove(false), [active]);
  // 列表变短（移除了一只）时选中项不越界
  useEffect(() => {
    if (active >= pets.length) setActive(Math.max(0, pets.length - 1));
  }, [active, pets.length]);

  const pet = pets[Math.min(active, pets.length - 1)];
  const isCustom = isCustomPetId(pet.id);
  const taps = tapsByPet[pet.id] ?? 0;
  const closeness = closenessOf(taps);
  const isCurrent = active === currentIndex;

  return (
    <div className="w-full pt-8 pb-16 bg-pet-bg">
      <div className="max-w-7xl mx-auto px-6 md:px-10 flex flex-col gap-8">
        {/* Page title */}
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-pet-mono tracking-[0.2em] text-pet-muted">
              <span className="w-6 h-px bg-pet-faint" />
              典藏展廊
            </div>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-pet-charcoal">
              灵宠图鉴
            </h1>
            <p className="mt-1.5 text-sm text-pet-muted">
              每一次轻叩都会被记住。三只灵宠常驻，也可以用你自己宠物的照片导入专属灵宠。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-pet-surface rounded-2xl px-4 py-2.5 border border-pet-line shadow-[0_2px_14px_rgba(0,0,0,0.02)]">
              <div className="text-[10px] font-bold tracking-wider text-pet-muted">已收录</div>
              <div className="font-pet-mono text-lg font-bold text-pet-charcoal leading-tight">
                {pets.length}
              </div>
            </div>
            <div className="bg-pet-surface rounded-2xl px-4 py-2.5 border border-pet-line shadow-[0_2px_14px_rgba(0,0,0,0.02)]">
              <div className="text-[10px] font-bold tracking-wider text-pet-muted">累计轻叩</div>
              <div className="font-pet-mono text-lg font-bold text-pet-charcoal leading-tight">
                {totalTaps.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Hero + dossier */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Portrait */}
          <div
            className={`lg:col-span-5 relative overflow-hidden rounded-[2.25rem] border border-pet-rim p-6 sm:p-8 min-h-[520px] flex flex-col justify-between shadow-[0_12px_40px_rgba(31,38,135,0.06)]`}
          >
            {/* 灵宠主视觉底色：单独一层，暗色模式下只压暗这层，不牵连上面的文字 */}
            <div className={`pet-glow absolute inset-0 bg-gradient-to-br ${pet.glow} pointer-events-none`} />
            <div className="pet-glow-orb absolute -top-16 -right-10 w-56 h-56 rounded-full bg-pet-surface/45 blur-3xl pointer-events-none" />
            <div className="pet-glow-orb absolute bottom-8 -left-10 w-48 h-48 rounded-full bg-pet-surface/30 blur-3xl pointer-events-none" />

            <div className="relative flex items-center justify-between">
              <span className="font-pet-mono text-[11px] tracking-[0.25em] text-pet-charcoal/55">
                {pet.serial}
              </span>
              <span
                className={`px-2.5 py-1 rounded-full border text-[10px] font-bold ${pet.rarityClass}`}
              >
                {pet.rarity}
              </span>
            </div>

            <div className="relative flex-1 flex items-center justify-center py-4">
              <div className="pet-glow-orb absolute w-60 h-60 rounded-full bg-pet-surface/35 blur-2xl" />
              <img
                src={pet.image}
                alt={pet.label}
                decoding="async"
                className="relative w-60 h-60 sm:w-72 sm:h-72 object-contain drop-shadow-2xl pet-breathing select-none pointer-events-none"
              />
            </div>

            <div className="relative">
              <div className="font-pet-mono text-[10px] tracking-[0.2em] text-pet-charcoal/50">
                {pet.edition} · {pet.element}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="font-display text-2xl font-extrabold tracking-tight text-pet-charcoal">
                  {pet.label}
                </h2>
                {isCurrent && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pet-surface/70 border border-pet-rim text-[10px] font-bold text-pet-accent-emerald">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    正在舞台
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-pet-charcoal/55">
                累计轻叩 {taps.toLocaleString()} 次 · 亲密度 Lv.{closeness.level}
              </div>
            </div>
          </div>

          {/* Dossier */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-pet-surface rounded-[1.75rem] p-6 sm:p-8 border border-pet-line shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col gap-6">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-pet-muted">
                  <Sparkles className="w-3.5 h-3.5 text-pet-accent-amber" />
                  图鉴题签
                </div>
                <p className="mt-2 font-display text-[22px] sm:text-2xl font-bold leading-snug text-pet-charcoal">
                  {pet.tagline}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-pet-muted">{pet.story}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pet-stone text-xs font-bold text-pet-charcoal">
                  <Heart className="w-3.5 h-3.5 text-pet-accent-rose" />
                  {pet.personality}
                </span>
                {pet.traits.map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1 rounded-full bg-pet-stone text-xs font-medium text-pet-muted"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                {ATTRS.map((attr) => {
                  const value = pet.attrs[attr.key];
                  return (
                    <div key={attr.key} className="flex items-center gap-3">
                      <span className="w-14 shrink-0 text-[11px] font-bold text-pet-muted">
                        {attr.label}
                      </span>
                      <div className="flex-1 h-2 bg-pet-stone rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${attr.bar}`}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                      <span className="w-7 text-right font-pet-mono text-[11px] font-bold text-pet-charcoal">
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Closeness */}
              <div className="rounded-2xl bg-pet-stone border border-pet-line-soft p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-pet-charcoal">
                    亲密度 Lv.{closeness.level}
                  </span>
                  <span className="font-pet-mono text-[11px] text-pet-muted">
                    {taps.toLocaleString()} / {closeness.next?.toLocaleString() ?? '满'}
                  </span>
                </div>
                <div className="mt-2.5 w-full h-1.5 bg-pet-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pet-charcoal rounded-full transition-all duration-300"
                    style={{ width: `${closeness.progress}%` }}
                  />
                </div>
                <div className="mt-2 text-[11px] text-pet-muted">
                  {closeness.next == null
                    ? '亲密度已满 · 它会一直在这里。'
                    : `再轻叩 ${closeness.remain} 次，升到 Lv.${closeness.level + 1}`}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => onBringToStage(active)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-pet-solid text-pet-on-solid text-sm font-bold shadow-[0_8px_24px_rgba(0,0,0,0.16)] border border-pet-on-solid/15 hover:opacity-95 active:scale-95 transition-all"
                >
                  <PawPrint className="w-[18px] h-[18px] text-pet-on-solid-accent" />
                  {isCurrent ? '回到敲击舞台' : `带${pet.label}上舞台`}
                </button>
                {isCustom ? (
                  <button
                    onClick={() => {
                      if (!confirmRemove) {
                        setConfirmRemove(true);
                        return;
                      }
                      setConfirmRemove(false);
                      onRemove(pet.id as CustomPetId);
                    }}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs font-bold transition-colors ${
                      confirmRemove
                        ? 'border-rose-400 bg-pet-tint-rose text-pet-accent-rose'
                        : 'border-pet-line text-pet-muted hover:text-pet-accent-rose hover:border-rose-300'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {confirmRemove ? '再点一次确认移除' : '移除这只灵宠'}
                  </button>
                ) : (
                  <span className="text-[11px] text-pet-muted">
                    换伙伴不会清空任何一只的累计轻叩
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Collection strip */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-wider text-pet-charcoal">全部灵宠</h3>
            <span className="text-[11px] text-pet-muted">点击切换档案</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {pets.map((p, i) => {
              const petTaps = tapsByPet[p.id] ?? 0;
              const c = closenessOf(petTaps);
              const selected = i === active;
              return (
                <button
                  key={p.id}
                  onClick={() => setActive(i)}
                  aria-pressed={selected}
                  className={`group text-left rounded-[1.75rem] border p-4 flex items-center gap-4 transition-all ${
                    selected
                      ? 'bg-pet-surface border-pet-solid/70 shadow-[0_8px_26px_rgba(0,0,0,0.06)]'
                      : 'bg-pet-surface/70 border-pet-line hover:bg-pet-surface hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.04)]'
                  }`}
                >
                  <span
                    className={`pet-glow w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br ${p.glow} shrink-0 border border-pet-rim`}
                  >
                    <img src={p.thumb} alt={p.label} className="w-full h-full object-cover" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-bold text-pet-charcoal truncate">
                        {p.label}
                      </span>
                      {i === currentIndex && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </span>
                    <span className="block font-pet-mono text-[10px] text-pet-muted mt-0.5">
                      {p.serial} · {p.element}
                    </span>
                    <span className="block text-[11px] text-pet-muted mt-1">
                      亲密度 Lv.{c.level} · 轻叩 {petTaps.toLocaleString()} 次
                    </span>
                  </span>
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      selected ? 'text-pet-charcoal' : 'text-pet-faint group-hover:text-pet-muted'
                    }`}
                  />
                </button>
              );
            })}
            {onImport && (
              <button
                onClick={onImport}
                className="rounded-[1.75rem] border-2 border-dashed border-pet-line p-4 flex items-center gap-4 text-left text-pet-muted hover:text-pet-charcoal hover:bg-pet-surface/70 transition-colors"
              >
                <span className="w-16 h-16 rounded-2xl grid place-items-center bg-pet-stone shrink-0">
                  <Plus className="w-6 h-6" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-pet-charcoal">导入我的灵宠</span>
                  <span className="block text-[11px] mt-1">图片变 2.5D · GLB 变真 3D · 最多 5 只</span>
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
