import React from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Download,
  Film,
  ImagePlus,
  Layers,
  PlugZap,
  RotateCcw,
  Route,
  Smartphone,
  Wand2,
} from 'lucide-react';
import { VISUAL_FX_PRESETS } from '../data/presetScenes';
import {
  CameraBlockingConfig,
  DrawerTabId,
  ElementFocusPresetId,
  SceneAsset,
  UniversalControllerConfig,
  VisualEffectSettings,
  VisualFxPreset,
} from '../types/studio';
import { ELEMENT_FOCUS_PRESETS } from '../universal-controller/connectorProtocol';

interface BottomControlDockProps {
  scenes: SceneAsset[];
  activeScene: SceneAsset;
  onSelectScene: (scene: SceneAsset) => void;
  onUploadImages: (files: FileList | File[]) => void;
  settings: VisualEffectSettings;
  onChangeSettings: (next: VisualEffectSettings) => void;
  onResetSettings: () => void;
  controller: UniversalControllerConfig;
  onChangeController: (next: UniversalControllerConfig) => void;
  cameraBlocking: CameraBlockingConfig;
  onChangeCameraBlocking: (next: CameraBlockingConfig) => void;
  showStoryOverlay: boolean;
  onToggleStoryOverlay: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onQuickExportWebP: () => void;
  onQuickExportMP4: () => void;
  isExportingMP4: boolean;
  mp4Progress: number;
  onOpenDrawerTab: (tab: DrawerTabId) => void;
}

const COMPACT_FOCUS_BUTTONS: { id: ElementFocusPresetId; label: string }[] = [
  { id: 'all_enabled', label: 'Wszystkie' },
  { id: 'focus_camera_path', label: 'Ścieżka 3D' },
  { id: 'focus_lighting', label: 'Światło' },
  { id: 'focus_optics', label: 'Optyka PBR' },
  { id: 'focus_color', label: 'Kolor LUT' },
  { id: 'focus_mobile', label: 'Mobile 9:16' },
];

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  scenes,
  activeScene,
  onSelectScene,
  onUploadImages,
  settings,
  onChangeSettings,
  onResetSettings,
  controller,
  onChangeController,
  cameraBlocking,
  onChangeCameraBlocking,
  showStoryOverlay,
  onToggleStoryOverlay,
  isCollapsed,
  onToggleCollapse,
  onQuickExportWebP,
  onQuickExportMP4,
  isExportingMP4,
  mp4Progress,
  onOpenDrawerTab,
}) => {
  const updateField = <K extends keyof VisualEffectSettings>(
    key: K,
    val: VisualEffectSettings[K]
  ) => {
    onChangeSettings({
      ...settings,
      [key]: val,
    });
  };

  const applyFxPreset = (preset: VisualFxPreset) => {
    onChangeSettings({
      ...settings,
      ...preset.settings,
    });
  };

  const handleSelectFocusPreset = (presetId: ElementFocusPresetId) => {
    const found = ELEMENT_FOCUS_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    onChangeController({
      ...controller,
      activeFocusPreset: found.id,
      enabledGroups: { ...found.enabledGroups },
    });
  };

  const g = controller.enabledGroups;
  const anyEnabled = Object.values(g).some(Boolean);
  const currentSmoothing =
    cameraBlocking.smoothingFactor ??
    (cameraBlocking.easingStyle === 'linear_constant' ? 0 : 65);

  return (
    <div
      className="fixed bottom-16 md:bottom-4 inset-x-0 mx-auto z-30 w-[min(1120px,96vw)] transition-transform duration-200 ease-out"
      style={{
        transform: isCollapsed
          ? 'translateY(calc(100% - 38px))'
          : 'translateY(0)',
      }}
    >
      {/* Top Collapse / Zen Mode Handle */}
      <div className="flex justify-center mb-1.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="min-h-[38px] md:min-h-0 inline-flex items-center gap-2 px-4 py-1.5 rounded-t-lg bg-[#0d0f14] border border-b-0 border-white/15 text-xs font-medium text-[#e5dec9] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Skrót klawiszowy: H"
        >
          {isCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Pokaż konsolę sterownika i efektów (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Ukryj panel — Czysty Widok 3D (H)</span>
            </>
          )}
        </button>
      </div>

      {/* Main Dock Container — Solid/RGBA surface (No backdrop-filter over WebGL) */}
      {!isCollapsed && (
        <div className="rounded-xl bg-[#0c0e13]/96 border border-white/12 shadow-2xl px-3.5 sm:px-5 py-3 text-[#f4f1ea] space-y-2.5 max-h-[44vh] md:max-h-none overflow-y-auto">
          {/* Top Row: Scene Switcher & Quick Module / Export Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
            {/* Scene Selector + Instant Multi-Image Upload */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
              <div className="flex items-center gap-1 bg-[#151821] p-1 rounded-lg border border-white/8">
                {scenes.map((sc, idx) => {
                  const active = sc.id === activeScene.id;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => onSelectScene(sc)}
                      className={`min-h-[34px] md:min-h-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                          : 'text-[#b8b2a6] hover:text-white'
                      }`}
                    >
                      {idx === 0
                        ? '01. Rzeźba'
                        : idx === 1
                          ? '02. Kwiaty'
                          : sc.title.slice(0, 14)}
                    </button>
                  );
                })}
              </div>

              <label
                className="min-h-[36px] md:min-h-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#d4af37]/16 hover:bg-[#d4af37]/26 border border-[#d4af37]/45 text-xs font-semibold text-[#e8ca64] whitespace-nowrap shrink-0 cursor-pointer"
                title="Wgraj jedno lub kilka zdjęć (możesz też upuścić je wprost na ekran lub wkleić Ctrl+V)"
              >
                <ImagePlus className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>+ Wgraj obraz</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      const snapshot = Array.from(e.target.files);
                      e.target.value = '';
                      onUploadImages(snapshot);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {/* Streamlined Quick Actions */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-0.5 md:pb-0">
              <button
                type="button"
                onClick={() =>
                  onChangeController({
                    ...controller,
                    show3DPathOnMainViewport: !controller.show3DPathOnMainViewport,
                  })
                }
                className={`min-h-[36px] md:min-h-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  controller.show3DPathOnMainViewport
                    ? 'bg-[#d4af37]/18 border-[#d4af37]/60 text-[#e8ca64]'
                    : 'bg-[#171b24] border-white/10 text-[#9e988c] hover:text-white'
                }`}
                title="Pokaż/ukryj linię ścieżki kamery 3D na głównym ekranie"
              >
                <Route className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Ścieżka 3D</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenDrawerTab('blocking3d')}
                className="min-h-[36px] md:min-h-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#171b24] hover:bg-[#1f2430] border border-[#d4af37]/40 text-xs font-medium text-[#f4f1ea] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Model 3D</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenDrawerTab('mobile')}
                className="min-h-[36px] md:min-h-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#171b24] hover:bg-[#1f2430] border border-white/10 text-xs font-medium text-[#f4f1ea] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Generator grafik pionowych 9:16 i 4:5 na telefony"
              >
                <Smartphone className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Mobile 9:16</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenDrawerTab('controller')}
                className="min-h-[36px] md:min-h-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#171b24] hover:bg-[#1f2430] border border-white/10 text-xs font-medium text-[#f4f1ea] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Podłącz Telefon / Tablet (VR & Potencjometry) i łącznik USCP-1.0"
              >
                <PlugZap className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Tablet / VR</span>
              </button>

              <button
                type="button"
                onClick={onQuickExportWebP}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#171b24] hover:bg-[#1f2430] border border-white/10 text-xs font-medium text-[#f4f1ea] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>WebP</span>
              </button>

              <button
                type="button"
                onClick={onQuickExportMP4}
                disabled={isExportingMP4}
                className="min-h-[36px] md:min-h-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e0be4c] disabled:opacity-50 text-xs font-semibold text-[#090a0d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Film className="w-3.5 h-3.5" />
                <span>
                  {isExportingMP4 ? `MP4 (${mp4Progress}%)` : 'Wideo MP4'}
                </span>
              </button>
            </div>
          </div>

          {/* Universal Controller Element-Focus Switch-Set Selector */}
          <div className="flex items-center justify-between gap-2 pb-1">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <PlugZap className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
              <span className="text-[11px] text-[#9e988c] whitespace-nowrap">
                Aktywny zestaw przełączników:
              </span>
              {COMPACT_FOCUS_BUTTONS.map((fb) => {
                const active = controller.activeFocusPreset === fb.id;
                return (
                  <button
                    key={fb.id}
                    type="button"
                    onClick={() => handleSelectFocusPreset(fb.id)}
                    className={`min-h-[30px] px-2.5 py-0.5 rounded text-[11px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                        : 'bg-[#151821] text-[#b8b2a6] hover:text-white border border-white/8'
                    }`}
                  >
                    {fb.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onResetSettings}
              className="p-1.5 rounded-lg bg-[#151821] hover:bg-[#1e222d] border border-white/10 text-[#9e988c] hover:text-white transition-colors shrink-0 cursor-pointer"
              title="Przywróć domyślne parametry sceny"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* FX Optical Preset Strip — rendered ONLY when `color_lut` switch-set is enabled */}
          {g.color_lut && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <Wand2 className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
              <span className="text-[11px] text-[#9e988c] mr-1 whitespace-nowrap">
                Profil FX:
              </span>
              {VISUAL_FX_PRESETS.map((fx) => {
                const active = settings.activeFxPreset === fx.id;
                return (
                  <button
                    key={fx.id}
                    type="button"
                    onClick={() => applyFxPreset(fx)}
                    title={fx.description}
                    className={`min-h-[30px] px-2.5 py-0.5 rounded text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white/16 text-white font-semibold border border-[#d4af37]/50'
                        : 'bg-[#151821] text-[#b8b2a6] hover:text-white border border-white/8'
                    }`}
                  >
                    {fx.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Dynamically Filtered Sliders & Switches Strictly Matching Active Switch-Sets */}
          {!anyEnabled ? (
            <div className="py-2 text-center text-xs text-[#9e988c]">
              Wszystkie zestawy przełączników zostały wyłączone w Uniwersalnym Sterowniku. Wybierz element powyżej, aby włączyć jego przełączniki.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 items-center pt-0.5">
              {/* Switch Group: camera_path_3d */}
              {g.camera_path_3d && (
                <>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#e8ca64] font-medium truncate">
                        Smoothing ścieżki 3D
                      </span>
                      <span className="font-mono-tabular text-[#d4af37] font-medium">
                        {currentSmoothing}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={currentSmoothing}
                      onChange={(e) =>
                        onChangeCameraBlocking({
                          ...cameraBlocking,
                          smoothingFactor: Number(e.target.value),
                        })
                      }
                      className="studio-slider w-full"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#e8ca64] font-medium truncate">
                        Łuk ścieżki M (m)
                      </span>
                      <span className="font-mono-tabular text-[#d4af37] font-medium">
                        {cameraBlocking.curveArcOffset.toFixed(1)}m
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-2.5}
                      max={2.5}
                      step={0.1}
                      value={cameraBlocking.curveArcOffset}
                      onChange={(e) =>
                        onChangeCameraBlocking({
                          ...cameraBlocking,
                          curveArcOffset: Number(e.target.value),
                        })
                      }
                      className="studio-slider w-full"
                    />
                  </div>
                </>
              )}

              {/* Switch Group: optics_pbr */}
              {g.optics_pbr && (
                <>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#c5bfb3] font-medium truncate">
                        Głębia optyczna 3D
                      </span>
                      <span className="font-mono-tabular text-[#d4af37] font-medium">
                        {settings.depthIntensity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={settings.depthIntensity}
                      onChange={(e) => updateField('depthIntensity', Number(e.target.value))}
                      className="studio-slider w-full"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#c5bfb3] font-medium truncate">
                        Fotorealizm PBR
                      </span>
                      <span className="font-mono-tabular text-[#d4af37] font-medium">
                        {settings.photorealism}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={settings.photorealism}
                      onChange={(e) => updateField('photorealism', Number(e.target.value))}
                      className="studio-slider w-full"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#c5bfb3] font-medium truncate">
                        Rozmycie ostrości (DOF)
                      </span>
                      <span className="font-mono-tabular text-[#d4af37] font-medium">
                        {settings.blurIntensity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={settings.blurIntensity}
                      onChange={(e) => updateField('blurIntensity', Number(e.target.value))}
                      className="studio-slider w-full"
                    />
                  </div>

                  {!g.lighting && !g.color_lut && (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#c5bfb3] font-medium truncate">
                          Winieta optyczna
                        </span>
                        <span className="font-mono-tabular text-[#d4af37] font-medium">
                          {settings.vignetteIntensity}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={settings.vignetteIntensity}
                        onChange={(e) =>
                          updateField('vignetteIntensity', Number(e.target.value))
                        }
                        className="studio-slider w-full"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Switch Group: lighting */}
              {g.lighting && (
                <>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#c5bfb3] font-medium truncate">
                        Światło w oknach
                      </span>
                      <span className="font-mono-tabular text-[#d4af37] font-medium">
                        {settings.windowLightIntensity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={settings.windowLightIntensity}
                      onChange={(e) =>
                        updateField('windowLightIntensity', Number(e.target.value))
                      }
                      className="studio-slider w-full"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#c5bfb3] font-medium truncate">
                        Złota godzina LED
                      </span>
                      <span className="font-mono-tabular text-[#d4af37] font-medium">
                        {settings.warmGlow}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={settings.warmGlow}
                      onChange={(e) => updateField('warmGlow', Number(e.target.value))}
                      className="studio-slider w-full"
                    />
                  </div>
                </>
              )}

              {/* Switch Group: color_lut (shown directly when isolated or alongside others) */}
              {g.color_lut && (!g.optics_pbr || !g.camera_path_3d) && (
                <>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#c5bfb3] font-medium truncate">
                        Korekcja kolorów LUT
                      </span>
                      <span className="font-mono-tabular text-[#d4af37] font-medium">
                        {settings.colorGrading}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={settings.colorGrading}
                      onChange={(e) => updateField('colorGrading', Number(e.target.value))}
                      className="studio-slider w-full"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#c5bfb3] font-medium truncate">
                        Ziarno filmowe 35mm
                      </span>
                      <span className="font-mono-tabular text-[#d4af37] font-medium">
                        {settings.filmGrain}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={settings.filmGrain}
                      onChange={(e) => updateField('filmGrain', Number(e.target.value))}
                      className="studio-slider w-full"
                    />
                  </div>
                </>
              )}

              {/* Quick Switches for Lighting Props / Mobile Framing */}
              {(g.lighting || g.mobile_framing) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {g.lighting && (
                    <button
                      type="button"
                      onClick={() => updateField('show3DProps', !settings.show3DProps)}
                      className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        settings.show3DProps
                          ? 'bg-[#d4af37]/15 border-[#d4af37]/50 text-[#e8ca64]'
                          : 'bg-[#151821] border-white/10 text-[#9e988c]'
                      }`}
                    >
                      Bryły 3D
                    </button>
                  )}

                  {g.mobile_framing && (
                    <>
                      <button
                        type="button"
                        onClick={onToggleStoryOverlay}
                        className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          showStoryOverlay
                            ? 'bg-white/14 border-white/30 text-white'
                            : 'bg-[#151821] border-white/10 text-[#9e988c]'
                        }`}
                      >
                        Narracja
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenDrawerTab('mobile')}
                        className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#d4af37]/20 border border-[#d4af37]/50 text-xs font-semibold text-[#e8ca64] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Layers className="w-3 h-3" />
                        <span>9:16 Mobile</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
