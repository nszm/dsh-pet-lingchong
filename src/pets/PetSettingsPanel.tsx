/**
 * 灵宠设置抽屉 —— 设置按钮的落点。
 * 全部设置即时生效并写入本机（`lijing.pet.settings.v1`）。
 * 覆盖：音色 / 互动音效 / 颂钵提示 / 默认模式 / 自动巡航速度 /
 *       飘字心愿 / 粒子特效 / 每日目标 / 清空今日进度。
 */
import { useEffect, useRef, useState } from 'react';
import { Check, Play, RotateCcw, X } from 'lucide-react';
import {
  AUTO_SPEED_OPTIONS,
  BLESSING_OPTIONS,
  GOAL_OPTIONS,
  PET_SCALE_MAX,
  PET_SCALE_MIN,
  SOUND_HINTS,
  SOUND_LABELS,
  SOUND_TYPES,
  clampPetScale,
  type SoundType,
  type PetSettings
} from './petData';
import { readJSON, writeJSON } from '../host/miniStore';
import { deletePetModel, loadPetModel, savePetModel } from './model3d';
import { CUSTOM_PALETTES, newCustomPetId } from './customPets';
import type { CustomPetId } from './petData';
import { buildFace, encodePet, frameCutout, hasTransparency, normalize, readImageFile } from './petImport';
import { GLB_DEFAULT_FACE, glbTiles } from './glbPet';
import { MODEL_ACCEPT, MODEL_LABEL, is3DModelFile, tagModelBlob } from './modelFormats';
import { ThreeDSiteLinks, ThreeDSitesGuide } from './ThreeDSiteLinks';

interface PetSettingsPanelProps {
  open: boolean;
  settings: PetSettings;
  stats: { tapsToday: number; totalTaps: number; collected: number };
  onChange: (patch: Partial<PetSettings>) => void;
  onPreviewSound: (sound: SoundType) => void;
  onReset: () => void;
  onClose: () => void;
  /** 当前舞台上的灵宠 */
  currentPet?: { id: string; label: string; image: string };
  /** 全部灵宠 */
  pets?: Array<{ id: string; label: string; mode?: 'photo' | 'glb' }>;
  /** 新增一只自定义灵宠(照片/3D 共用管线) */
  addPet?: (meta: any, images: { image: Blob; thumb: Blob }) => Promise<void>;
  /** 移除一只自定义灵宠 */
  removePet?: (id: CustomPetId) => Promise<void>;
  /** 导入成功后把舞台切到新灵宠 */
  onImported?: (id: CustomPetId) => void;
  /** 用户导入的灵宠(图片+GLB,含主项目导入的) */
  imported?: Array<{ id: string; label: string; mode?: 'photo' | 'glb' }>;
  /** 导入位是否已满(5 只) */
  importedFull?: boolean;
}

export function PetSettingsPanel({
  open,
  settings,
  stats,
  onChange,
  onPreviewSound,
  onReset,
  onClose,
  currentPet,
  pets,
  addPet,
  removePet,
  onImported,
  imported,
  importedFull
}: PetSettingsPanelProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmReset(false);
    setResetDone(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!confirmReset) return;
    const timer = window.setTimeout(() => setConfirmReset(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmReset]);

  useEffect(() => {
    if (!resetDone) return;
    const timer = window.setTimeout(() => setResetDone(false), 2600);
    return () => window.clearTimeout(timer);
  }, [resetDone]);

  if (!open) return null;

  const goalDone = stats.tapsToday >= settings.goal;
  const goalProgress = Math.min(100, Math.round((stats.tapsToday / settings.goal) * 100));

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    onReset();
    setConfirmReset(false);
    setResetDone(true);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="灵宠设置"
    >
      <div
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm pet-fade-in"
        onClick={onClose}
      />
      <aside className="relative h-full w-full max-w-[440px] bg-pet-bg shadow-2xl flex flex-col border-l border-pet-rim pet-drawer-in">
        <header className="shrink-0 px-6 pt-6 pb-4 border-b border-pet-line flex items-start justify-between gap-4">
          <div>
            <div className="font-pet-mono text-[10px] tracking-[0.18em] text-pet-muted">
              灵宠 · 本机设置
            </div>
            <h2 className="mt-1 font-display text-xl font-extrabold text-pet-charcoal">灵宠设置</h2>
            <p className="mt-1 text-[11px] text-pet-muted">改动即时生效，只保存在这台设备。</p>
          </div>
          <button
            onClick={onClose}
            autoFocus
            aria-label="关闭设置"
            className="w-9 h-9 rounded-full bg-pet-surface border border-pet-line flex items-center justify-center text-pet-graphite hover:bg-pet-stone transition-all shadow-xs shrink-0"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-7">
          {/* 音效 */}
          <Section title="音效" hint="点选即试听">
            <div className="grid grid-cols-2 gap-2">
              {SOUND_TYPES.map((s) => {
                const active = settings.sound === s;
                return (
                  <button
                    key={s}
                    onClick={() => {
                      onChange({ sound: s });
                      onPreviewSound(s);
                    }}
                    aria-pressed={active}
                    className={`text-left rounded-2xl border px-3.5 py-3 transition-all ${
                      active
                        ? 'bg-pet-surface border-pet-solid/70 shadow-[0_4px_16px_rgba(0,0,0,0.05)]'
                        : 'bg-pet-surface/60 border-pet-line hover:bg-pet-surface hover:border-pet-faint'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-pet-charcoal">{SOUND_LABELS[s]}</span>
                      {active ? (
                        <Check className="w-3.5 h-3.5 text-pet-accent-teal" />
                      ) : (
                        <Play className="w-3.5 h-3.5 text-pet-faint" />
                      )}
                    </span>
                    <span className="mt-1 block text-[10px] leading-snug text-pet-muted">
                      {SOUND_HINTS[s]}
                    </span>
                  </button>
                );
              })}
            </div>
            <ToggleRow
              label="互动音效"
              desc="轻叩与按钮的即时声音反馈"
              checked={settings.soundOn}
              onChange={(v) => onChange({ soundOn: v })}
            />
            <ToggleRow
              label="颂钵提示"
              desc="每轻叩 100 次，落一声轻鸣"
              checked={settings.bell}
              onChange={(v) => onChange({ bell: v })}
            />
          </Section>

          {/* 互动 */}
          <Section title="互动">
            <div>
              <RowLabel label="默认模式" desc="进入页面时先选中哪种互动" />
              <Segmented
                value={settings.mode}
                options={[
                  { value: 'tap', label: '灵犀敲磬' },
                  { value: 'pet', label: '抚慰身心' }
                ]}
                onChange={(v) => onChange({ mode: v })}
              />
            </div>
            <div>
              <RowLabel label="自动巡航速度" desc="开启巡航后按这个节奏自动轻叩" />
              <Segmented
                value={settings.autoSpeed}
                options={AUTO_SPEED_OPTIONS}
                onChange={(v) => onChange({ autoSpeed: v })}
              />
            </div>
            <div>
              <RowLabel label="灵宠大小" desc="无级 30%–300%，悬浮卡 / 舞台 / 小窗统一" />
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={PET_SCALE_MIN}
                  max={PET_SCALE_MAX}
                  step={0.05}
                  value={clampPetScale(settings.petScale)}
                  onChange={(e) => onChange({ petScale: Number(e.target.value) })}
                  className="flex-1 accent-[#3f6f66]"
                />
                <span className="text-[11px] font-bold text-pet-charcoal w-10 text-right">
                  {Math.round(clampPetScale(settings.petScale) * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => onChange({ petScale: 1 })}
                  className="flex-none px-2.5 py-1 rounded-full text-[10px] font-bold border border-pet-line text-pet-muted hover:text-pet-charcoal transition-colors"
                  title="回到原大"
                >
                  原大
                </button>
              </div>
              <div className="mt-1.5 text-[10px] text-pet-muted">
                鼠标停在悬浮灵宠上按 Ctrl + 滚轮，也能随手放大缩小。
              </div>
            </div>
            <ToggleRow
              label="3D 自动旋转"
              desc="关掉后模型站着不动；舞台页仍可拖着转"
              checked={settings.modelSpin !== false}
              onChange={(v) => onChange({ modelSpin: v })}
            />
            <ToggleRow
              label="粒子与浮字"
              desc="关闭后只保留数值变化，界面更安静"
              checked={settings.effects}
              onChange={(v) => onChange({ effects: v })}
            />
            <div>
              <RowLabel label="飘字心愿" desc="每次轻叩时浮起的那句话" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {BLESSING_OPTIONS.map((b) => {
                  const active = settings.blessing === b;
                  return (
                    <button
                      key={b}
                      onClick={() => onChange({ blessing: b })}
                      aria-pressed={active}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all ${
                        active
                          ? 'bg-pet-solid text-pet-on-solid border-pet-solid'
                          : 'bg-pet-surface text-pet-graphite border-pet-line hover:border-pet-faint'
                      }`}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>

          {/* 对话陪伴(2026-10-26):DSH 对话联动开关 */}
          <Section title="对话陪伴" hint="仅真 DSH 页生效">
            <ToggleRow
              label="对话陪伴"
              desc="DSH 每次回复说完，灵宠应一句"
              checked={settings.chatCompanion ?? true}
              onChange={(v) => onChange({ chatCompanion: v })}
            />
            <ToggleRow
              label="见面问候"
              desc="打开页面或久别回来时的招呼气泡"
              checked={settings.greetBubble ?? true}
              onChange={(v) => onChange({ greetBubble: v })}
            />
          </Section>

          {/* 导入灵宠:图片(立绘)/ GLB(真 3D)→ 新增一只自定义灵宠(最多 5 只,不影响内置三只) */}
          <PetImportSection
            imported={imported ?? []}
            importFull={importedFull ?? false}
            addPet={addPet}
            removePet={removePet}
            onImported={onImported}
          />

          {/* 今日目标 */}
          <Section title="今日目标" hint={`今日 ${stats.tapsToday.toLocaleString()} 次`}>
            <div className="rounded-2xl bg-pet-surface border border-pet-line p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold text-pet-charcoal">
                  {goalDone ? '今日目标已达成' : `还差 ${settings.goal - stats.tapsToday} 次`}
                </span>
                <span className="font-pet-mono text-[11px] text-pet-muted">
                  {stats.tapsToday.toLocaleString()} / {settings.goal.toLocaleString()}
                </span>
              </div>
              <div className="mt-2.5 w-full h-1.5 bg-pet-stone rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    goalDone ? 'bg-pet-tint-teal0' : 'bg-rose-400'
                  }`}
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {GOAL_OPTIONS.map((g) => {
                const active = settings.goal === g;
                return (
                  <button
                    key={g}
                    onClick={() => onChange({ goal: g })}
                    aria-pressed={active}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all font-pet-mono ${
                      active
                        ? 'bg-pet-solid text-pet-on-solid border-pet-solid'
                        : 'bg-pet-surface text-pet-graphite border-pet-line hover:border-pet-faint'
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] leading-relaxed text-pet-muted">
              目标只影响今日进度展示，不限制轻叩次数。
            </p>
          </Section>

          {/* 本机数据 */}
          <Section title="本机数据">
            <div className="grid grid-cols-3 gap-2">
              <StatBox label="今日" value={stats.tapsToday.toLocaleString()} />
              <StatBox label="累计" value={stats.totalTaps.toLocaleString()} />
              <StatBox label="图鉴" value={`${stats.collected} / 3`} />
            </div>
            <p className="text-[10px] leading-relaxed text-pet-muted">
              进度保存在本机，不上传。清空只归零「今日能量」，累计能量与灵宠图鉴的陪伴次数都会保留。
            </p>
            <button
              onClick={handleReset}
              className={`w-full py-2.5 rounded-full text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                confirmReset
                  ? 'bg-pet-tint-rose0 border-rose-500 text-pet-on-solid'
                  : 'bg-pet-surface border-pet-line text-pet-charcoal hover:border-pet-faint'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {confirmReset ? '再点一次，确认清空今日进度' : '清空今日进度'}
            </button>
            {resetDone && (
              <p className="text-[11px] font-medium text-pet-accent-teal text-center">已清空今日进度</p>
            )}
          </Section>
        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-pet-line bg-pet-bg">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-full bg-pet-solid text-pet-on-solid text-sm font-bold border border-pet-on-solid/15 hover:opacity-95 active:scale-[0.99] transition-all"
          >
            完成
          </button>
        </footer>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Section({
  title,
  hint,
  children
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-bold tracking-[0.16em] text-pet-charcoal">{title}</h3>
        {hint && <span className="text-[10px] text-pet-muted">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function RowLabel({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="mb-2">
      <div className="text-xs font-bold text-pet-charcoal">{label}</div>
      <div className="text-[10px] text-pet-muted mt-0.5">{desc}</div>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-pet-surface border border-pet-line px-4 py-3">
      <div>
        <div className="text-xs font-bold text-pet-charcoal">{label}</div>
        <div className="text-[10px] text-pet-muted mt-0.5">{desc}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-pet-charcoal' : 'bg-pet-track'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-pet-surface shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-pet-stone p-1 rounded-full border border-pet-line">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`flex-1 px-3 py-1.5 rounded-full text-[11px] transition-all ${
              active
                ? 'bg-pet-surface font-bold text-pet-charcoal shadow-xs'
                : 'font-medium text-pet-muted hover:text-pet-charcoal'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-pet-surface border border-pet-line px-3 py-2.5 text-center">
      <div className="text-[10px] font-bold tracking-wider text-pet-muted">{label}</div>
      <div className="mt-0.5 font-pet-mono text-sm font-bold text-pet-charcoal">{value}</div>
    </div>
  );
}

/* ==================================================================== */
/* 3D 模型(Meshy)区:API Key + 一键生成 + 进度                            */
/* ==================================================================== */


const MAX_GLB_PETS = 5;


const MAX_IMPORTED_PETS = 5;

function PetImportSection({
  imported,
  importFull,
  addPet,
  removePet,
  onImported
}: {
  imported: Array<{ id: string; label: string; mode?: 'photo' | 'glb' }>;
  importFull: boolean;
  addPet?: (meta: any, images: { image: Blob; thumb: Blob }) => Promise<void>;
  removePet?: (id: CustomPetId) => Promise<void>;
  onImported?: (id: CustomPetId) => void;
}) {
  const [name, setName] = useState('');
  const [fileName, setFileName] = useState('');
  const [pick, setPick] = useState<File | null>(null);
  const [isGlb, setIsGlb] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarName, setAvatarName] = useState('');
  const avatarRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const defaultName = `我的灵宠 ${imported.length + 1}`;
  const effectiveName = name.trim() || defaultName;
  const ready = !!pick && !!addPet && !importFull && !busy;

  const start = async () => {
    if (!ready || !pick) return;
    setBusy(true);
    setNote(null);
    try {
      const id = newCustomPetId();
      const palette = imported.length % CUSTOM_PALETTES.length;
      const glb = isGlb;
      let meta: any;
      let tiles: { image: Blob; thumb: Blob; cover: 'photo' | 'model' | 'placeholder' };
      if (glb) {
        /* 头像：有照片用照片（裁成透明底方图），没选就把模型本身渲一张当封面，
           渲不出来才回退渐变「3D」占位 */
        tiles = await glbTiles(effectiveName, avatarFile, pick);
        meta = {
          id,
          label: effectiveName,
          tagline: '真 3D 模型 · 可拖拽旋转',
          personality: '3D · 来自你的 GLB',
          face: GLB_DEFAULT_FACE,
          cutout: 'glb' as const,
          palette,
          createdAt: Date.now(),
          mode: 'glb' as const,
          cover: tiles.cover
        };
        await savePetModel(id, tagModelBlob(pick));
      } else {
        const c = await readImageFile(pick);
        const transparent = hasTransparency(c);
        const cut = transparent ? c : frameCutout(c);
        const norm = normalize(cut);
        meta = {
          id,
          label: effectiveName,
          tagline: '来自你的照片',
          personality: '独一无二 · 只认你',
          face: buildFace(norm, [], 0),
          cutout: transparent ? ('alpha' as const) : ('frame' as const),
          palette,
          createdAt: Date.now(),
          mode: 'photo' as const,
          cover: 'photo' as const
        };
        tiles = { ...(await encodePet(norm)), cover: 'photo' as const };
      }
      await addPet?.(meta, tiles);
      setNote({
        ok: true,
        text: `「${effectiveName}」已加入灵宠列表(第 ${imported.length + 1} 只),舞台已切换。`
      });
      setName('');
      setFileName('');
      setPick(null);
      setAvatarFile(null);
      setAvatarName('');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
      if (fileRef.current) fileRef.current.value = '';
      if (avatarRef.current) avatarRef.current.value = '';
      onImported?.(id);
    } catch (err) {
      setNote({ ok: false, text: '导入失败:' + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await deletePetModel(id);
      await removePet?.(id as CustomPetId);
      setNote({ ok: true, text: '已移除该灵宠。' });
    } catch (err) {
      setNote({ ok: false, text: '移除失败:' + String(err).slice(0, 80) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="导入灵宠" hint="照片 / 3D 模型 · 最多 5 个">
      {/* 操作说明 */}
      <div className="rounded-2xl bg-pet-surface border border-pet-line px-4 py-3">
        <div className="text-xs font-bold text-pet-charcoal">怎么操作</div>
        <ol className="mt-2 space-y-1 text-[10px] leading-relaxed text-pet-muted list-decimal list-inside">
          <li>图片：宠物照 / 人像 / 动漫立绘都行，自动柔边成 2.5D；</li>
          <li>
            真 3D：去 <ThreeDSiteLinks /> 生成 GLB；现成的 {MODEL_LABEL} 也可以直接选；
          </li>
          <li>填名字 → 导入，成为新伙伴（内置三只不变）。</li>
        </ol>
      </div>

      {/* 六家生成站点的免费额度对照（2026-10） */}
      <div className="rounded-2xl bg-pet-surface border border-pet-line px-4 py-3">
        <div className="text-xs font-bold text-pet-charcoal">去哪儿生成（免费额度 · 2026-10）</div>
        <div className="mt-2">
          <ThreeDSitesGuide />
        </div>
        <div className="mt-2 text-[10px] leading-relaxed text-pet-muted">
          额度与授权以各家官方为准；插件不代发、不上传，生成的模型只存在你这台电脑上。
        </div>
      </div>

      {/* 名字 */}
      <div className="rounded-2xl bg-pet-surface border border-pet-line px-4 py-3">
        <div className="text-xs font-bold text-pet-charcoal">自定义名字</div>
        <input
          type="text"
          value={name}
          placeholder={defaultName}
          onChange={(e) => setName(e.target.value)}
          maxLength={12}
          className="mt-2 w-full text-xs rounded-xl border border-pet-line bg-pet-bg px-3 py-2 outline-none focus:border-pet-gold"
        />
      </div>

      {/* 已导入列表 */}
      {imported.length > 0 && (
        <div className="rounded-2xl bg-pet-surface border border-pet-line px-4 py-3">
          <div className="text-xs font-bold text-pet-charcoal">
            已导入 {imported.length} / {MAX_IMPORTED_PETS}
          </div>
          <div className="mt-2 space-y-1.5">
            {imported.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-pet-charcoal truncate">
                  <span
                    className={`inline-block mr-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold align-middle ${
                      p.mode === 'glb'
                        ? 'bg-pet-tint-teal text-pet-accent-teal'
                        : 'bg-pet-tint-amber text-pet-accent-amber'
                    }`}
                  >
                    {p.mode === 'glb' ? '3D' : '图片'}
                  </span>
                  {p.label}
                </span>
                <button
                  onClick={() => void remove(p.id)}
                  disabled={busy}
                  className="flex-none px-2.5 py-1 rounded-full text-[10px] font-bold border border-pet-line bg-pet-surface text-pet-muted hover:text-pet-charcoal transition-all"
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {importFull && (
        <div className="text-[10px] font-bold text-pet-accent-rose">
          已达 5 只上限——移除一只后才能再导入。
        </div>
      )}

      {/* 文件 */}
      <input
        ref={fileRef}
        type="file"
        accept={MODEL_ACCEPT + ",image/*"}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          const glb = is3DModelFile(f);
          setPick(f ?? null);
          setFileName(f ? f.name : '');
          setIsGlb(glb);
          setAvatarFile(null);
          setAvatarName('');
          if (avatarRef.current) avatarRef.current.value = '';
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return f && !glb ? URL.createObjectURL(f) : '';
          });
        }}
      />
      <button
        onClick={() => fileRef.current && fileRef.current.click()}
        disabled={busy || importFull}
        className={`w-full py-2.5 rounded-full text-xs font-bold border transition-all ${
          busy || importFull
            ? 'bg-pet-track text-pet-faint border-pet-track cursor-not-allowed'
            : 'bg-pet-surface text-pet-charcoal border-pet-line hover:border-pet-gold'
        }`}
      >
        {fileName ? `已选:${fileName}` : importFull ? '已达上限' : '选择图片或 GLB 文件'}
      </button>
      {previewUrl && (
        <div className="flex items-center gap-3 rounded-2xl bg-pet-surface border border-pet-line px-3 py-2">
          <img
            src={previewUrl}
            alt="已选图片预览"
            className="w-14 h-14 rounded-xl object-cover border border-pet-line"
          />
          <div className="text-[10px] leading-snug text-pet-muted">
            {isGlb
              ? '这只 3D 灵宠将用这张照片作头像(图鉴/胶囊);舞台渲染 3D 模型。'
              : '导入后这只灵宠的立绘就是它,舞台直接显示。'}
          </div>
        </div>
      )}
      {isGlb && (
        <>
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              setAvatarFile(f ?? null);
              setAvatarName(f ? f.name : '');
              setPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return f ? URL.createObjectURL(f) : '';
              });
            }}
          />
          <button
            onClick={() => avatarRef.current && avatarRef.current.click()}
            disabled={busy}
            className={`w-full py-2 rounded-full text-[11px] font-bold border transition-all ${
              avatarName
                ? 'bg-pet-surface text-pet-charcoal border-pet-gold'
                : 'bg-pet-surface text-pet-muted border-pet-line hover:border-pet-gold'
            }`}
          >
            {avatarName ? `头像照片:${avatarName}` : '选一张照片作头像(可选)'}
          </button>
        </>
      )}
      <button
        onClick={() => void start()}
        disabled={!ready}
        className={`w-full py-2.5 rounded-full text-xs font-bold border transition-all ${
          ready
            ? 'bg-pet-solid text-pet-on-solid border-pet-solid hover:opacity-85'
            : 'bg-pet-track text-pet-faint border-pet-track cursor-not-allowed'
        }`}
      >
        {busy ? '导入中…' : `导入「${effectiveName}」为灵宠`}
      </button>
      {note && (
        <div
          className={`text-[11px] font-bold break-all ${
            note.ok ? 'text-pet-accent-teal' : 'text-pet-accent-rose'
          }`}
        >
          {note.text}
        </div>
      )}
      <div className="text-[10px] leading-snug text-pet-muted">
        图片灵宠 = 2.5D 立绘;GLB 灵宠 = 真 3D 可拖拽旋转,可另选照片作头像。内置三只不受影响,大小都可在「互动」里调。
      </div>
    </Section>
  );
}