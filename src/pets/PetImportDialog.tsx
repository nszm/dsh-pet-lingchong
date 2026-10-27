/**
 * 导入灵宠 · 四步向导
 * ---------------------------------------------------------------------------
 *   ① 选照片（点选 / 拖入）
 *   ② 抠图：原图自带透明底直接用；否则 AI 抠图（首次联网下载模型，带进度）；
 *      下载或推理失败自动回退柔边圆框，随时可手动改用圆框
 *   ③ 标眼睛：在图上点两下标出双眼 + 调眼睛大小，右侧实时预览眨眼 / 笑眼 / 星星眼…
 *      没有明显眼睛的照片可以跳过（只保留身体动作）
 *   ④ 起名字 + 题签 + 配色 → 存进本机（IndexedDB + 元数据跨窗同步）
 */
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Sparkles, Undo2, X } from 'lucide-react';
import { PetFace } from './PetFace';
import { PetModel3D } from './PetModel3D';
import { savePetModel } from './model3d';
import { GLB_DEFAULT_FACE, glbTiles } from './glbPet';
import { MODEL_ACCEPT, MODEL_LABEL, is3DModelFile, tagModelBlob } from './modelFormats';
import { ThreeDSiteLinks } from './ThreeDSiteLinks';
import {
  CANVAS,
  buildFace,
  defaultEyeRadius,
  encodePet,
  frameCutout,
  hasTransparency,
  normalize,
  readImageFile,
  type EyePoint
} from './petImport';
import {
  CUSTOM_PALETTES,
  newCustomPetId,
  type CustomPetMeta,
  type CutoutKind
} from './customPets';
import type { Pet, PetMood } from './petData';

type Step = 'pick' | 'cut' | 'eyes' | 'info';

interface PetImportDialogProps {
  open: boolean;
  /** 已导入几只（决定默认配色轮换） */
  customCount: number;
  onSave: (meta: CustomPetMeta, images: { image: Blob; thumb: Blob }) => Promise<void>;
  onClose: () => void;
}

const PREVIEW_MOODS: { mood: PetMood; blink?: boolean; label: string }[] = [
  { mood: 'idle', label: '平静' },
  { mood: 'idle', blink: true, label: '眨眼' },
  { mood: 'happy', label: '笑眼' },
  { mood: 'content', label: '享受' },
  { mood: 'ecstatic', label: '星星眼' },
  { mood: 'surprised', label: '惊醒' }
];

const STEPS: { id: Step; label: string }[] = [
  { id: 'pick', label: '选照片' },
  { id: 'cut', label: '抠图' },
  { id: 'eyes', label: '标眼睛' },
  { id: 'info', label: '起名字' }
];

/** GLB 走另一条路:模型文件本身没有「抠图 / 标眼睛」这两步 */
const GLB_STEPS: { id: Step; label: string }[] = [
  { id: 'pick', label: '选文件' },
  { id: 'info', label: '起名字' }
];

const CUTOUT_LABEL: Partial<Record<CutoutKind, string>> = {
  alpha: '原图透明底',
  frame: '柔边圆框'
};

/** 编辑区边长（px）：1024 坐标按比例缩到这里 */
const PAD = 320;

export function PetImportDialog({ open, customCount, onSave, onClose }: PetImportDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const runRef = useRef(0);

  const [step, setStep] = useState<Step>('pick');
  const [raw, setRaw] = useState<HTMLCanvasElement | null>(null);
  const [art, setArt] = useState<HTMLCanvasElement | null>(null);
  const [artUrl, setArtUrl] = useState('');
  const [cutout, setCutout] = useState<CutoutKind>('alpha');
  const [notice, setNotice] = useState('');
  const [eyes, setEyes] = useState<EyePoint[]>([]);
  const [eyeR, setEyeR] = useState(30);
  const [skipEyes, setSkipEyes] = useState(false);
  const [preview, setPreview] = useState(0);
  const [label, setLabel] = useState('');
  const [tagline, setTagline] = useState('');
  const [personality, setPersonality] = useState('');
  const [palette, setPalette] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  /* 真 3D 分支(2026-10-27 用户口径):这个向导也要能直接导 GLB,
     不再要求去「设置 → 导入灵宠」绕一圈。GLB 只跳过抠图/标眼睛两步。 */
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const avatarRef = useRef<HTMLInputElement>(null);

  // 每次打开都从头来
  useEffect(() => {
    if (!open) return;
    runRef.current++;
    setStep('pick');
    setRaw(null);
    setArt(null);
    setGlbFile(null);
    setAvatarFile(null);
    setAvatarUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setEyes([]);
    setSkipEyes(false);
    setPreview(0);
    setLabel('');
    setTagline('');
    setPersonality('');
    setPalette(customCount % CUSTOM_PALETTES.length);
    setNotice('');
    setError('');
    setSaving(false);
    // 焦点收进弹窗：舞台的空格键监听看到 [role=dialog] 就不会穿透去敲灵宠
    window.setTimeout(() => panelRef.current?.focus(), 0);
  }, [open, customCount]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, saving]);

  // 处理后的方图 → object URL（预览 + PetFace 借毛都用它）
  useEffect(() => {
    if (!art) {
      setArtUrl('');
      return;
    }
    let url = '';
    let alive = true;
    art.toBlob((b) => {
      if (!alive || !b) return;
      url = URL.createObjectURL(b);
      setArtUrl(url);
    }, 'image/png');
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [art]);

  if (!open) return null;

  const applyArt = (c: HTMLCanvasElement, kind: CutoutKind) => {
    setArt(normalize(c));
    setCutout(kind);
    setEyes([]);
    setStep('eyes');
  };

  const takeFile = async (file: File | undefined) => {
    if (!file) return;
    /* GLB：真 3D 模型原样存起来，跳过抠图 / 标眼睛，直接去起名字 */
    if (is3DModelFile(file)) {
      setError('');
      setGlbFile(file);
      setRaw(null);
      setArt(null);
      setEyes([]);
      setSkipEyes(false);
      setStep('info');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError(`请选择图片（JPG / PNG / WebP）或 3D 模型（${MODEL_LABEL}）。`);
      return;
    }
    setError('');
    setGlbFile(null);
    try {
      const c = await readImageFile(file);
      setRaw(c);
      // DSH 版无 AI 抠图(用户口径 2026-10-26):透明底直接用,否则柔边圆框
      if (hasTransparency(c)) applyArt(c, 'alpha');
      else applyArt(frameCutout(c), 'frame');
    } catch {
      setError('这张图片读不出来，换一张试试。');
    }
  };

  /* GLB 灵宠的头像（图鉴 / 换宠胶囊用），可选 */
  const pickAvatar = (f: File | undefined) => {
    if (!f) return;
    setAvatarFile(f);
    setAvatarUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  };
  const clearAvatar = () => {
    setAvatarFile(null);
    setAvatarUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    if (avatarRef.current) avatarRef.current.value = '';
  };

  const toFrame = () => {
    if (!raw) return;
    runRef.current++;
    setNotice('');
    applyArt(frameCutout(raw), 'frame');
  };

  const placeEye = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS
    };
    setSkipEyes(false);
    setEyes((prev) => {
      if (prev.length < 2) {
        const next = [...prev, p];
        if (next.length === 2) setEyeR(defaultEyeRadius(next[0], next[1]));
        return next;
      }
      // 已有两只：点哪儿就把离得近的那只挪过去
      const i = Math.hypot(prev[0].x - p.x, prev[0].y - p.y) <= Math.hypot(prev[1].x - p.x, prev[1].y - p.y) ? 0 : 1;
      return prev.map((q, k) => (k === i ? p : q));
    });
  };

  const eyesReady = eyes.length === 2 || skipEyes;
  const face = art && eyesReady ? buildFace(art, skipEyes ? [] : eyes, eyeR) : null;
  const previewPet: Pet | null =
    face && artUrl
      ? {
          id: 'custom-preview',
          serial: '',
          edition: '',
          label: label || '新灵宠',
          image: artUrl,
          thumb: artUrl,
          rarity: '',
          rarityClass: '',
          element: '',
          tagline: '',
          personality: '',
          traits: [],
          attrs: { healing: 0, charm: 0, spirit: 0 },
          story: '',
          glow: CUSTOM_PALETTES[palette].glow,
          ring: '',
          face
        }
      : null;

  const save = async () => {
    if (!label.trim()) return;
    setSaving(true);
    setError('');
    try {
      /* GLB：先落模型，再落头像 + 元数据（与设置面板同一条存储口径） */
      if (glbFile) {
        const id = newCustomPetId();
        await savePetModel(id, tagModelBlob(glbFile));
        const tiles = await glbTiles(label.trim(), avatarFile, glbFile);
        await onSave(
          {
            id,
            label: label.trim(),
            tagline: tagline.trim() || '真 3D 模型 · 可拖拽旋转',
            personality: personality.trim() || '3D · 来自你的 GLB',
            face: GLB_DEFAULT_FACE,
            cutout: 'glb',
            cover: tiles.cover,
            palette,
            createdAt: Date.now(),
            mode: 'glb'
          },
          tiles
        );
        return;
      }
      if (!art || !face) {
        setSaving(false);
        return;
      }
      const images = await encodePet(art);
      await onSave(
        {
          id: newCustomPetId(),
          label: label.trim(),
          tagline: tagline.trim(),
          personality: personality.trim(),
          face,
          cutout,
          palette,
          createdAt: Date.now()
        },
        images
      );
    } catch {
      setError('保存失败：本机存储空间可能不足。');
      setSaving(false);
    }
  };

  const steps = glbFile ? GLB_STEPS : STEPS;
  const stepIndex = steps.findIndex((s) => s.id === step);
  const pm = PREVIEW_MOODS[preview];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal aria-label="导入灵宠">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm pet-fade-in" onClick={() => !saving && onClose()} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative w-full max-w-[780px] max-h-[calc(100vh-2rem)] overflow-y-auto bg-pet-bg rounded-[1.75rem] border border-pet-rim shadow-2xl outline-none pet-fade-in"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-pet-line">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-pet-mono tracking-[0.2em] text-pet-muted">
              <Sparkles className="w-3.5 h-3.5 text-pet-accent-amber" />
              我的灵宠
            </div>
            <h2 className="mt-1 font-display text-xl font-extrabold text-pet-charcoal">导入灵宠</h2>
          </div>
          <div className="flex items-center gap-4">
            <ol className="hidden sm:flex items-center gap-1.5">
              {steps.map((s, i) => (
                <li
                  key={s.id}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    i === stepIndex
                      ? 'bg-pet-solid text-pet-on-solid'
                      : i < stepIndex
                        ? 'bg-pet-stone text-pet-charcoal'
                        : 'text-pet-faint'
                  }`}
                >
                  {i + 1} {s.label}
                </li>
              ))}
            </ol>
            <button
              onClick={onClose}
              disabled={saving}
              className="w-9 h-9 rounded-full grid place-items-center text-pet-muted hover:text-pet-charcoal hover:bg-pet-stone transition-colors"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          {/* ① 选照片 */}
          {step === 'pick' && (
            <div className="flex flex-col gap-4">
              {/* 导入说明(2026-10-27 用户口径:加号进来也要有说明) */}
              <div className="rounded-2xl bg-pet-surface border border-pet-line px-4 py-3">
                <div className="text-xs font-bold text-pet-charcoal">导入说明</div>
                <ol className="mt-2 space-y-1 text-[11px] leading-relaxed text-pet-muted list-decimal list-inside">
                  <li>图片 → 2.5D 立绘（会眨眼、会笑）：宠物、人像、动漫立绘都行，可标眼睛、起名字；</li>
                  <li>
                    <span className="font-bold text-pet-charcoal">{MODEL_LABEL} → 真 3D</span>：现成的模型（人物、动漫角色、
                    手办扫描、3D 打印件）直接拖进来；没有模型就去 <ThreeDSiteLinks />{' '}
                    用照片 / 一句话生成（都有免费额度），跳过抠图与标眼睛；
                  </li>
                  <li>最多 5 个（图片 + 3D 合计），不影响内置三只。</li>
                  <li>更多免费方案（3D AI Studio / Rodin / HuggingFace Space）与额度对比，见设置里的「导入灵宠」。</li>
                </ol>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  void takeFile(e.dataTransfer.files[0]);
                }}
                className={`w-full h-64 rounded-[1.5rem] border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-colors ${
                  dragOver ? 'border-pet-solid bg-pet-stone' : 'border-pet-line bg-pet-surface hover:bg-pet-stone'
                }`}
              >
                <span className="w-14 h-14 rounded-full bg-pet-stone grid place-items-center text-pet-charcoal">
                  <ImagePlus className="w-7 h-7" />
                </span>
                <span className="text-sm font-bold text-pet-charcoal">点击选择，或把照片 / 3D 模型拖到这里</span>
                <span className="text-xs text-pet-muted">JPG / PNG / WebP · {MODEL_LABEL} 直导真 3D</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={MODEL_ACCEPT + ",image/*"}
                className="hidden"
                onChange={(e) => {
                  void takeFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <ul className="grid sm:grid-cols-3 gap-3 text-xs text-pet-muted">
                <li className="rounded-2xl bg-pet-surface border border-pet-line-soft p-3">
                  <b className="block text-pet-charcoal mb-1">正脸更好</b>两只眼睛都露出来，表情才对得上。
                </li>
                <li className="rounded-2xl bg-pet-surface border border-pet-line-soft p-3">
                  <b className="block text-pet-charcoal mb-1">背景干净</b>主体清楚，抠图更利落。
                </li>
                <li className="rounded-2xl bg-pet-surface border border-pet-line-soft p-3">
                  <b className="block text-pet-charcoal mb-1">只存本机</b>照片不出这台电脑。
                </li>
              </ul>
            </div>
          )}

          {/* ② 抠图中（透明底/圆框即时完成，通常一闪而过） */}
          {step === 'cut' && (
            <div className="h-72 flex flex-col items-center justify-center gap-4 text-center">
              <Loader2 className="w-8 h-8 text-pet-charcoal animate-spin" />
              <div className="text-sm font-bold text-pet-charcoal">正在整理图片…</div>
            </div>
          )}

          {/* ③ 标眼睛 */}
          {step === 'eyes' && art && (
            <div className="flex flex-col gap-4">
              {notice && (
                <div className="rounded-2xl bg-pet-tint-amber border border-pet-tint-amber-line px-4 py-2.5 text-xs text-pet-accent-amber">
                  {notice}
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-pet-charcoal">
                      {eyes.length < 2 && !skipEyes ? `点一下${eyes.length === 0 ? '第一' : '第二'}只眼睛` : '点图可以挪动眼睛位置'}
                    </span>
                    <span className="text-[10px] text-pet-muted">{CUTOUT_LABEL[cutout]}</span>
                  </div>
                  <div
                    onClick={placeEye}
                    className="pet-import-checker relative rounded-2xl overflow-hidden border border-pet-line cursor-crosshair"
                    style={{ width: PAD, height: PAD }}
                  >
                    {artUrl && <img src={artUrl} alt="" className="absolute inset-0 w-full h-full pointer-events-none select-none" />}
                    {!skipEyes &&
                      eyes.map((e, i) => (
                        <span
                          key={i}
                          className="absolute rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.55)] pointer-events-none"
                          style={{
                            left: (e.x / CANVAS) * PAD,
                            top: (e.y / CANVAS) * PAD,
                            width: ((eyeR * 2) / CANVAS) * PAD,
                            height: ((eyeR * 2) / CANVAS) * PAD,
                            transform: 'translate(-50%, -50%)'
                          }}
                        />
                      ))}
                  </div>
                  <label className="flex items-center gap-3 text-xs text-pet-muted" style={{ width: PAD }}>
                    眼睛大小
                    <input
                      type="range"
                      min={8}
                      max={100}
                      value={eyeR}
                      disabled={eyes.length < 2}
                      onChange={(e) => setEyeR(Number(e.target.value))}
                      className="flex-1 accent-current text-pet-charcoal"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setEyes([])}
                      disabled={eyes.length === 0}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-pet-line text-[11px] font-bold text-pet-charcoal hover:bg-pet-stone disabled:opacity-40"
                    >
                      <Undo2 className="w-3.5 h-3.5" /> 重标
                    </button>
                    <button
                      onClick={() => {
                        setSkipEyes(true);
                        setEyes([]);
                      }}
                      className="px-3 py-1.5 rounded-full border border-pet-line text-[11px] font-bold text-pet-charcoal hover:bg-pet-stone"
                    >
                      看不清眼睛，跳过
                    </button>
                  </div>
                </div>

                {/* 实时预览 */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-pet-charcoal">表情预览</span>
                  <div
                    className={`relative rounded-2xl overflow-hidden border border-pet-line bg-gradient-to-br ${CUSTOM_PALETTES[palette].glow} grid place-items-center`}
                    style={{ height: PAD }}
                  >
                    <div className="pet-glow absolute inset-0" />
                    {previewPet ? (
                      <div className="relative w-60 h-60 [container-type:inline-size]">
                        <img src={previewPet.image} alt="" className="absolute inset-0 w-full h-full object-contain drop-shadow-xl" />
                        <PetFace pet={previewPet} mood={pm.mood} blink={!!pm.blink} emotes={[]} />
                      </div>
                    ) : (
                      <span className="relative text-xs text-pet-muted">标好两只眼睛后，这里能看到表情</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PREVIEW_MOODS.map((m, i) => (
                      <button
                        key={m.label}
                        onClick={() => setPreview(i)}
                        disabled={!previewPet || skipEyes}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors disabled:opacity-40 ${
                          preview === i ? 'bg-pet-solid text-pet-on-solid' : 'bg-pet-stone text-pet-charcoal hover:bg-pet-surface'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {skipEyes && (
                    <p className="text-[11px] text-pet-muted">跳过后没有眼部表情，仍有腮红、蹦跳、歪头、打盹。</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ④ 起名字（GLB 到这一步前不经过抠图/标眼睛） */}
          {step === 'info' && (previewPet || glbFile) && (
            <div className="grid sm:grid-cols-[220px_1fr] gap-6 items-start">
              <div
                className={`relative rounded-2xl overflow-hidden border border-pet-line bg-gradient-to-br ${CUSTOM_PALETTES[palette].glow} grid place-items-center h-56`}
              >
                <div className="pet-glow absolute inset-0" />
                {glbFile ? (
                  /* 真 3D 直接在这里转给你看：拖着能旋转，确认没问题再请它入驻 */
                  <div className="relative w-48 h-48">
                    <PetModel3D blob={glbFile} />
                  </div>
                ) : (
                  <div className="relative w-48 h-48 [container-type:inline-size]">
                    <img src={previewPet!.image} alt="" className="absolute inset-0 w-full h-full object-contain drop-shadow-xl" />
                    <PetFace pet={previewPet!} mood="happy" blink={false} emotes={[]} />
                  </div>
                )}
                {glbFile && (
                  <span className="absolute left-2 bottom-2 z-20 px-2 py-0.5 rounded-full bg-pet-solid text-pet-on-solid text-[10px] font-bold">
                    真 3D · 拖着可旋转
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-pet-charcoal">名字 *</span>
                  <input
                    value={label}
                    maxLength={10}
                    autoFocus
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="比如：团子、可乐、小满"
                    className="px-4 py-2.5 rounded-xl bg-pet-surface border border-pet-line text-sm text-pet-charcoal outline-none focus:border-pet-solid"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-pet-charcoal">一句话题签</span>
                  <input
                    value={tagline}
                    maxLength={24}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="比如：每天在门口等我回家。"
                    className="px-4 py-2.5 rounded-xl bg-pet-surface border border-pet-line text-sm text-pet-charcoal outline-none focus:border-pet-solid"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-pet-charcoal">性格</span>
                  <input
                    value={personality}
                    maxLength={16}
                    onChange={(e) => setPersonality(e.target.value)}
                    placeholder="比如：贪吃 · 话痨 · 爱撒娇"
                    className="px-4 py-2.5 rounded-xl bg-pet-surface border border-pet-line text-sm text-pet-charcoal outline-none focus:border-pet-solid"
                  />
                </label>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-pet-charcoal">图鉴配色</span>
                  <div className="flex gap-2">
                    {CUSTOM_PALETTES.map((p, i) => (
                      <button
                        key={p.name}
                        onClick={() => setPalette(i)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold ${
                          palette === i ? 'border-pet-solid text-pet-charcoal' : 'border-pet-line text-pet-muted hover:bg-pet-stone'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full ${p.swatch}`} />
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
                {glbFile && (
                  /* 头像照片：只影响图鉴/换宠胶囊，不选就生成「3D」占位 */
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-pet-charcoal">头像照片（可选）</span>
                    <div className="flex items-center gap-2">
                      {avatarUrl && (
                        <img
                          src={avatarUrl}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover border border-pet-line"
                        />
                      )}
                      <button
                        onClick={() => avatarRef.current?.click()}
                        className="px-3 py-1.5 rounded-full border border-pet-line text-[11px] font-bold text-pet-charcoal hover:bg-pet-stone"
                      >
                        {avatarFile ? '换一张' : '选一张照片'}
                      </button>
                      {avatarFile && (
                        <button
                          onClick={clearAvatar}
                          className="px-3 py-1.5 rounded-full text-[11px] font-bold text-pet-muted hover:text-pet-charcoal hover:bg-pet-stone"
                        >
                          不用照片
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-pet-muted">
                      只用于图鉴和换宠胶囊；不选就用带名字的「3D」渐变占位。
                    </p>
                    <input
                      ref={avatarRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        pickAvatar(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-xs font-bold text-pet-accent-rose">{error}</p>}
        </div>

        {/* 底部操作 */}
        {(step === 'eyes' || step === 'info') && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-pet-line">
            <button
              onClick={() => (step === 'info' ? setStep(glbFile ? 'pick' : 'eyes') : setStep('pick'))}
              disabled={saving}
              className="px-4 py-2 rounded-full text-xs font-bold text-pet-muted hover:text-pet-charcoal hover:bg-pet-stone"
            >
              {step === 'info' ? '上一步' : glbFile ? '换一个文件' : '换一张照片'}
            </button>
            {step === 'eyes' ? (
              <button
                onClick={() => setStep('info')}
                disabled={!eyesReady}
                className="px-6 py-2.5 rounded-full bg-pet-solid text-pet-on-solid text-sm font-bold disabled:opacity-40 active:scale-95 transition-all"
              >
                下一步
              </button>
            ) : (
              <button
                onClick={() => void save()}
                disabled={!label.trim() || saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-pet-solid text-pet-on-solid text-sm font-bold disabled:opacity-40 active:scale-95 transition-all"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                请它入驻
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
