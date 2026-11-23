import React, { useState } from 'react';
import {
  Aperture,
  Camera,
  Check,
  ChevronDown,
  Compass,
  Move,
  Move3d,
  Radio,
  Route,
  Sliders,
} from 'lucide-react';
import {
  CameraControllerFunctionId,
  ElementFocusPresetId,
  SwitchGroupId,
} from '../types/studio';
import {
  CAMERA_CONTROLLER_FUNCTIONS,
  ELEMENT_FOCUS_PRESETS,
} from '../universal-controller/connectorProtocol';

interface CameraControllerFunctionMenuProps {
  activeFunction: CameraControllerFunctionId;
  onSelectFunction: (
    funcId: CameraControllerFunctionId,
    mappedGroups: Record<SwitchGroupId, boolean>,
    mappedPreset: ElementFocusPresetId
  ) => void;
  isConnected?: boolean;
  peerCount?: number;
  onQuickTriggerShot?: () => void;
  compact?: boolean;
}

function getFunctionIcon(id: CameraControllerFunctionId) {
  switch (id) {
    case 'camera_aim_vr':
      return Compass;
    case 'camera_dolly_track':
      return Move;
    case 'camera_lens_focus':
      return Aperture;
    case 'camera_path_scrub':
      return Route;
    case 'camera_air_6dof':
      return Move3d;
    case 'camera_full_rig':
    default:
      return Sliders;
  }
}

export const CameraControllerFunctionMenu: React.FC<
  CameraControllerFunctionMenuProps
> = ({
  activeFunction,
  onSelectFunction,
  isConnected = false,
  peerCount = 0,
  onQuickTriggerShot,
  compact = false,
}) => {
  const [menuOpen, setMenuOpen] = useState<boolean>(true);

  const activeDef =
    CAMERA_CONTROLLER_FUNCTIONS.find((f) => f.id === activeFunction) ||
    CAMERA_CONTROLLER_FUNCTIONS[0];
  const ActiveIcon = getFunctionIcon(activeDef.id);

  const handlePick = (funcId: CameraControllerFunctionId) => {
    const def = CAMERA_CONTROLLER_FUNCTIONS.find((f) => f.id === funcId);
    const preset = ELEMENT_FOCUS_PRESETS.find((p) => p.id === def?.mappedPreset);
    const fallbackGroups: Record<SwitchGroupId, boolean> = {
      camera_path_3d: true,
      lighting: funcId === 'camera_full_rig',
      optics_pbr: funcId === 'camera_lens_focus' || funcId === 'camera_full_rig',
      color_lut: funcId === 'camera_full_rig',
      mobile_framing: funcId === 'camera_full_rig',
    };
    onSelectFunction(
      funcId,
      preset ? { ...preset.enabledGroups } : fallbackGroups,
      def?.mappedPreset || 'focus_camera_path'
    );
    if (compact) {
      setMenuOpen(false);
    }
  };

  return (
    <section className="rounded-2xl bg-[#11141d] border border-[#d4af37]/45 p-4 space-y-3">
      {/* Top Action Bar: 1-Click Menu Toggle + Quick Capture Shutter */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          className="min-h-[48px] flex-1 min-w-[240px] flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#090a0d] hover:bg-[#161a26] border border-[#d4af37]/55 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/40 flex items-center justify-center shrink-0">
              <ActiveIcon className="w-4 h-4 text-[#d4af37]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-mono-tabular text-[#d4af37]">
                <Radio className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  MENU STERUJĄCE KAMERY {isConnected ? `· POŁĄCZONO (${peerCount})` : '· GOTOWE'}
                </span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-white truncate">
                {activeDef.title}
              </div>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#e8ca64] shrink-0">
            <span className="hidden sm:inline">Zmień funkcję</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-150 ${
                menuOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {onQuickTriggerShot && (
          <button
            type="button"
            onClick={onQuickTriggerShot}
            className="min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Zrób Rzut / Zapisz Kadr</span>
          </button>
        )}
      </div>

      {/* Expandable Function Selection Menu */}
      {menuOpen && (
        <div className="space-y-2 pt-1 border-t border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#b8b2a6]">
            <span>
              Kliknij funkcję, którą ten sterownik ma obsługiwać w panelu sterowania kamerą:
            </span>
            <span className="font-mono-tabular text-[#d4af37]">{activeDef.axesHint}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {CAMERA_CONTROLLER_FUNCTIONS.map((fn) => {
              const Icon = getFunctionIcon(fn.id);
              const selected = fn.id === activeFunction;
              return (
                <button
                  key={fn.id}
                  type="button"
                  onClick={() => handlePick(fn.id)}
                  className={`min-h-[64px] text-left p-3 rounded-xl border transition-colors cursor-pointer flex items-start gap-2.5 ${
                    selected
                      ? 'bg-[#d4af37]/16 border-[#d4af37] text-white'
                      : 'bg-[#090a0d] border-white/10 text-[#c5bfb3] hover:border-[#d4af37]/50 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      selected ? 'text-[#d4af37]' : 'text-[#8e887c]'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-semibold truncate">{fn.shortTitle}</span>
                      {selected && <Check className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />}
                    </div>
                    <p className="text-[11px] text-[#9e988c] mt-0.5 line-clamp-2 leading-snug">
                      {fn.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
