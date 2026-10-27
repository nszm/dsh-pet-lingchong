/**
 * 灵宠 —— 主程序「灵宠」大功能页。
 * 2026-10-18 改版：
 *   · 品牌「灵宠」，页头不再出现旧品牌词；
 *   · 页签只保留「敲击蓄能 / 灵宠图鉴」，两个都真的可用；
 *   · 「全球祈福榜」移除，右侧改为记录本机真实轻叩的「陪伴日记」；
 *   · 设置按钮打开灵宠设置抽屉（音效 / 模式 / 目标 / 数据），改动即时生效；
 *   · 图鉴补全三只灵宠的档案、亲密度与「带到舞台」；
 *   · 今日能量 / 累计轻叩 / 七日心流全部接本机进度，不再用演示数字。
 *
 * 布局：主程序的滚动容器已下移到顶栏下方（App.tsx main），本页用 min-h-full，
 * 页内 sticky 顶条 top-0 即贴在滚动容器顶部。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePersistentState } from '../host/miniStore';
import { PetHeader } from './PetHeader';
import { PetMetricCards } from './PetMetricCards';
import { PetSoundToolbar } from './PetSoundToolbar';
import { PetStage } from './PetStage';
import { PetCharmsPanel } from './PetCharmsPanel';
import { PetCompanionLog } from './PetCompanionLog';
import { PetFlowChart } from './PetFlowChart';
import { PetGallery } from './PetGallery';
import { PetSettingsPanel } from './PetSettingsPanel';
import { LiquidGlassDefs } from './LiquidGlassDefs';
import { usePetAudio } from './usePetAudio';
import { usePetEngine } from './usePetEngine';
import { PetImportDialog } from './PetImportDialog';
import { useAllPets, type CustomPetMeta } from './customPets';
import {
  BLESSING_OPTIONS,
  DEFAULT_PET_SETTINGS,
  PET_CURRENT_KEY,
  PET_SETTINGS_KEY,
  isPetId,
  isPetSettings,
  rankLabel,
  type CustomPetId,
  type PetId,
  type SoundType,
  type PetSettings,
  type PetTab
} from './petData';

function PetStudio() {
  const [petId, setPetId] = usePersistentState<PetId>(PET_CURRENT_KEY, 'cat', isPetId);
  // 三只常驻 + 用户导入的灵宠（图片在 IndexedDB，读到才上列表）
  const { pets, customs, addPet, removePet } = useAllPets();
  /** 用户口径 2026-10-26:自定义灵宠(图片+GLB 合计)最多 5 只 */
  const importFull = customs.length >= 5;
  const petIndex = Math.max(0, pets.findIndex((p) => p.id === petId));
  const [importOpen, setImportOpen] = useState(false);
  const [tab, setTab] = useState<PetTab>('bless');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoActive, setAutoActive] = useState(false);

  const [settings, setSettings] = usePersistentState<PetSettings>(
    PET_SETTINGS_KEY,
    DEFAULT_PET_SETTINGS,
    isPetSettings
  );

  const patchSettings = useCallback(
    (patch: Partial<PetSettings>) => setSettings((prev) => ({ ...prev, ...patch })),
    [setSettings]
  );

  // 存档里若有旧心愿文案（不在当前选项内），回落到第一项，避免下拉框空白
  const blessing = BLESSING_OPTIONS.includes(settings.blessing)
    ? settings.blessing
    : BLESSING_OPTIONS[0];

  const { play } = usePetAudio(settings.sound);
  const engine = usePetEngine({ effects: settings.effects, blessing });

  const handleInteract = useCallback(() => {
    const pet = pets[petIndex];
    if (settings.soundOn) play(settings.sound);

    // 每 100 次轻叩落一声颂钵（与互动音效分开控制）
    if (settings.soundOn && settings.bell && (engine.merit + 1) % 100 === 0) {
      window.setTimeout(() => play('crystal'), 90);
    }

    engine.registerInteraction(pet);
  }, [
    pets,
    petIndex,
    settings.sound,
    settings.soundOn,
    settings.bell,
    play,
    engine.merit,
    engine.registerInteraction
  ]);

  // 自动巡航：用 ref 拿最新交互，避免每次能量变化都把 interval 重建
  const interactRef = useRef(handleInteract);
  interactRef.current = handleInteract;

  useEffect(() => {
    if (!autoActive || tab !== 'bless' || settingsOpen) return;
    const timer = window.setInterval(() => interactRef.current(), settings.autoSpeed);
    return () => window.clearInterval(timer);
  }, [autoActive, tab, settingsOpen, settings.autoSpeed]);

  const handleSwitchPet = useCallback(
    (i: number) => {
      setPetId(pets[i].id);
      if (settings.soundOn) play(settings.sound);
    },
    [pets, setPetId, play, settings.sound, settings.soundOn]
  );

  const handleSoundChange = useCallback(
    (s: SoundType) => {
      patchSettings({ sound: s });
      if (settings.soundOn) play(s);
    },
    [patchSettings, play, settings.soundOn]
  );

  const handleBringToStage = useCallback(
    (i: number) => {
      setPetId(pets[i].id);
      setTab('bless');
      if (settings.soundOn) play(settings.sound);
    },
    [pets, setPetId, play, settings.sound, settings.soundOn]
  );

  const handleOpenImport = useCallback(() => setImportOpen(true), []);
  const handleCloseImport = useCallback(() => setImportOpen(false), []);

  // 导入完成：直接请上舞台
  const handleImported = useCallback(
    async (meta: CustomPetMeta, images: { image: Blob; thumb: Blob }) => {
      await addPet(meta, images);
      setPetId(meta.id);
      setImportOpen(false);
      setTab('bless');
    },
    [addPet, setPetId]
  );

  // 移除导入的灵宠：若它正在舞台上，换回第一只常驻灵宠
  const handleRemovePet = useCallback(
    (id: CustomPetId) => {
      if (id === petId) setPetId('cat');
      void removePet(id);
    },
    [petId, removePet, setPetId]
  );

  const handleResetToday = useCallback(() => {
    engine.resetToday();
    setAutoActive(false);
  }, [engine.resetToday]);

  // 抽屉的回调要稳定：不稳定会让抽屉的 [open, onClose] effect 每次父级重渲染都复位提示
  const handleCloseSettings = useCallback(() => setSettingsOpen(false), []);

  // 颂钵提示依赖互动音效：音效关着时点铃铛 = 把两者一起打开
  const handleToggleBell = useCallback(() => {
    if (!settings.soundOn) {
      patchSettings({ soundOn: true, bell: true });
      return;
    }
    patchSettings({ bell: !settings.bell });
  }, [patchSettings, settings.soundOn, settings.bell]);

  const bellOn = settings.bell && settings.soundOn;

  return (
    <div className="relative min-h-full font-sans text-pet-graphite antialiased selection:bg-pet-charcoal selection:text-pet-on-solid -mx-4 sm:-mx-6 md:-mx-8">
      <LiquidGlassDefs />
      {/* Ambient color field behind the whole page so glass has something to refract */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-pet-bg" />
        {/* 色场：亮色是水彩般的浅渐层，暗色由 .pet-aurora 压暗成低饱和夜雾 */}
        <div className="pet-aurora pet-aurora-page absolute inset-0">
          <div className="absolute top-[-10%] left-[-5%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-br from-sky-300/50 to-indigo-300/30 blur-[120px]" />
          <div className="absolute top-[30%] right-[-8%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-rose-300/40 to-amber-200/30 blur-[140px]" />
          <div className="absolute bottom-[-10%] left-[20%] w-[40vw] h-[40vw] rounded-full bg-gradient-to-br from-teal-300/40 to-emerald-200/30 blur-[130px]" />
        </div>
      </div>

      <div className="relative">
        <PetHeader
          headerMerit={engine.headerMerit}
          todayTaps={engine.merit}
          activeTab={tab}
          onTabChange={setTab}
          bellOn={bellOn}
          onToggleBell={handleToggleBell}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {tab === 'bless' ? (
          <main className="w-full pt-4 pb-16 bg-pet-bg">
            <div className="max-w-7xl mx-auto px-6 md:px-10 flex flex-col gap-5">
              <PetMetricCards
                merit={engine.merit}
                stress={engine.stress}
                combo={engine.combo}
                comboBar={engine.comboBar}
                comboSubtext={engine.comboSubtext}
                rankLabel={rankLabel(engine.totalTaps)}
                goal={settings.goal}
                totalTaps={engine.totalTaps}
              />

              <PetSoundToolbar
                sound={settings.sound}
                onSoundChange={handleSoundChange}
                blessing={blessing}
                onBlessingChange={(b) => patchSettings({ blessing: b })}
                autoActive={autoActive}
                onToggleAuto={() => setAutoActive((a) => !a)}
              />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left column */}
                <div className="lg:col-span-3">
                  <PetCharmsPanel
                    totalTaps={engine.totalTaps}
                    bellOn={bellOn}
                    soundOn={settings.soundOn}
                    onToggleBell={handleToggleBell}
                  />
                </div>

                {/* Center column */}
                <PetStage
                  pets={pets}
                  petIndex={petIndex}
                  onImport={importFull ? undefined : handleOpenImport}
                  onSwitchPet={handleSwitchPet}
                  mode={settings.mode}
                  onModeChange={(m) => patchSettings({ mode: m })}
                  onInteract={handleInteract}
                  healing={engine.healing}
                  blessing={blessing}
                  particles={engine.particles}
                  pulse={engine.totalTaps}
                  combo={engine.combo}
                  petScale={settings.petScale ?? 1}
                  modelSpin={settings.modelSpin !== false}
                />

                {/* Right column */}
                <div className="lg:col-span-3 flex flex-col gap-6">
                  <PetCompanionLog feed={engine.feed} tapsToday={engine.merit} />
                  <PetFlowChart daily={engine.daily} tapsToday={engine.merit} goal={settings.goal} />
                </div>
              </div>
            </div>
          </main>
        ) : (
          <PetGallery
            pets={pets}
            currentIndex={petIndex}
            onImport={importFull ? undefined : handleOpenImport}
            onRemove={handleRemovePet}
            tapsByPet={engine.tapsByPet}
            totalTaps={engine.totalTaps}
            onBringToStage={handleBringToStage}
          />
        )}
      </div>

      <PetImportDialog
        open={importOpen}
        customCount={customs.length}
        onSave={handleImported}
        onClose={handleCloseImport}
      />

      <PetSettingsPanel
        open={settingsOpen}
        settings={settings}
        stats={{
          tapsToday: engine.merit,
          totalTaps: engine.totalTaps,
          collected: pets.length
        }}
        onChange={patchSettings}
        onPreviewSound={(s) => play(s)}
        onReset={handleResetToday}
        onClose={handleCloseSettings}
        currentPet={pets[petIndex]}
        pets={pets}
        addPet={addPet}
        removePet={removePet}
        onImported={setPetId}
        imported={customs.map((c) => ({ id: c.id, label: c.label, mode: c.mode ?? 'photo' }))}
        importedFull={customs.length >= 5}
      />
    </div>
  );
}

export default PetStudio;
