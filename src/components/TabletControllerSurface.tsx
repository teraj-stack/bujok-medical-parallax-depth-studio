import React, { useRef, useState } from 'react';
import {
  Activity,
  Camera,
  Crosshair,
  Download,
  Film,
  KeyRound,
  Layers,
  Monitor,
  Move,
  PlugZap,
  Radar,
  Radio,
  RotateCcw,
  Route,
  ShieldCheck,
  Sliders,
  Tablet,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { VISUAL_FX_PRESETS } from '../data/presetScenes';
import {
  CameraBlockingConfig,
  CameraControllerFunctionId,
  ElementFocusPresetId,
  LiveCameraRigState,
  SolvedAirPose,
  SpatialAnchorNode,
  SwitchGroupId,
  UniversalControllerConfig,
  UscpRemoteActionType,
  VisualEffectSettings,
} from '../types/studio';
import { CameraControllerFunctionMenu } from './CameraControllerFunctionMenu';
import { CameraPotentiometerAndVRPad } from './CameraPotentiometerAndVRPad';
import { SpatialCalibrationComposer } from './SpatialCalibrationComposer';
import { SpatialMultiDevicePlanner } from './SpatialMultiDevicePlanner';
import {
  DEFAULT_CAMERA_3D_SPATIAL_MODEL,
  DEFAULT_SOLVED_AIR_POSE,
  DEFAULT_SPATIAL_ANCHORS,
  ELEMENT_FOCUS_PRESETS,
  SWITCH_GROUP_DEFINITIONS,
  UscpPeerInfo,
  UscpRemoteSceneSummary,
  UscpSecurityStatus,
} from '../universal-controller/connectorProtocol';

interface TabletControllerSurfaceProps {
  controller: UniversalControllerConfig;
  onChangeController: (next: UniversalControllerConfig) => void;
  settings: VisualEffectSettings;
  onApplySettings: (partial: Partial<VisualEffectSettings>) => void;
  cameraBlocking: CameraBlockingConfig;
  onChangeCameraBlocking: (next: CameraBlockingConfig) => void;
  liveCameraRig: LiveCameraRigState;
  onChangeLiveCameraRig: (next: LiveCameraRigState) => void;
  showStoryOverlay: boolean;
  onToggleStoryOverlay: () => void;
  connectionStatus: 'connecting' | 'connected' | 'local_only';
  peers: UscpPeerInfo[];
  remoteScenes: UscpRemoteSceneSummary[];
  remoteActiveSceneId: string;
  lastSyncAt: string | null;
  latencyMs?: number | null;
  pinCode?: string;
  authRequired?: boolean;
  authError?: string | null;
  securityStatus?: UscpSecurityStatus;
  spatialAnchors?: SpatialAnchorNode[];
  solvedAirPose?: SolvedAirPose;
  onRegisterSpatialAnchor?: (anchor: SpatialAnchorNode) => void;
  onSendRangingSample?: (
    samples: Array<{ anchorId: string; distanceMeters: number; signalQuality?: number }>
  ) => void;
  onSendAirPose?: (pose: { x: number; y: number; z: number }) => void;
  onUnlockWithPin?: (pin: string) => Promise<boolean>;
  onPingServerNow?: () => void;
  onSendRemoteAction: (action: UscpRemoteActionType, payload?: any) => void;
  onExitTabletMode: () => void;
}

export const TabletControllerSurface: React.FC<TabletControllerSurfaceProps> = ({
  controller,
  onChangeController,
  settings,
  onApplySettings,
  cameraBlocking,
  onChangeCameraBlocking,
  liveCameraRig,
  onChangeLiveCameraRig,
  showStoryOverlay,
  onToggleStoryOverlay,
  connectionStatus,
  peers,
  remoteScenes,
  remoteActiveSceneId,
  lastSyncAt,
  latencyMs = null,
  pinCode = '',
  authRequired = false,
  authError = null,
  securityStatus,
  spatialAnchors = DEFAULT_SPATIAL_ANCHORS,
  solvedAirPose = DEFAULT_SOLVED_AIR_POSE,
  onRegisterSpatialAnchor,
  onSendRangingSample,
  onSendAirPose,
  onUnlockWithPin,
  onPingServerNow,
  onSendRemoteAction,
  onExitTabletMode,
}) => {
  const [pinInput, setPinInput] = useState<string>('');
  const [unlocking, setUnlocking] = useState<boolean>(false);
  const [showCalibrationPanel, setShowCalibrationPanel] = useState<boolean>(false);
  const [shotFeedback, setShotFeedback] = useState<string | null>(null);
  const dollyTrackPadRef = useRef<boolean>(false);

  const activeSpatialModel = controller.spatialModel || DEFAULT_CAMERA_3D_SPATIAL_MODEL;
  const activeFunction: CameraControllerFunctionId =
    controller.activeCameraFunction || 'camera_full_rig';
  const deviceRoleMode = controller.deviceRoleMode || 'camera_console';
  const activeAnchorId = controller.activeAnchorId || spatialAnchors[0]?.id || 'ANCHOR-FL';
  const activeAnchorNode =
    spatialAnchors.find((a) => a.id === activeAnchorId) || spatialAnchors[0];

  const g = controller.enabledGroups;
  const enabledCount = Object.values(g).filter(Boolean).length;
  const currentSmoothing =
    cameraBlocking.smoothingFactor ??
    (cameraBlocking.easingStyle === 'linear_constant' ? 0 : 65);

  const handleSelectCameraFunction = (
    funcId: CameraControllerFunctionId,
    mappedGroups: Record<SwitchGroupId, boolean>,
    mappedPreset: ElementFocusPresetId
  ) => {
    onChangeController({
      ...controller,
      activeCameraFunction: funcId,
      activeFocusPreset: mappedPreset,
      enabledGroups: mappedGroups,
    });
    if (funcId === 'camera_air_6dof' || funcId === 'camera_aim_vr') {
      onChangeLiveCameraRig({
        ...liveCameraRig,
        enabled: true,
        source: funcId === 'camera_air_6dof' ? 'air_wand_6dof' : liveCameraRig.source,
      });
    }
  };

  const triggerAirShotWithFeedback = () => {
    onSendRemoteAction('capture_air_shot', liveCameraRig);
    setShotFeedback('Wysłano wyzwalacz rzutu/kadru na ekran główny 3D!');
    window.setTimeout(() => setShotFeedback(null), 2400);
  };

  const applyFocusPreset = (presetId: ElementFocusPresetId) => {
    const found = ELEMENT_FOCUS_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    onChangeController({
      ...controller,
      activeFocusPreset: found.id,
      enabledGroups: { ...found.enabledGroups },
    });
  };

  const toggleGroup = (id: SwitchGroupId) => {
    onChangeController({
      ...controller,
      activeFocusPreset: 'custom_selection',
      enabledGroups: {
        ...controller.enabledGroups,
        [id]: !controller.enabledGroups[id],
      },
    });
  };

  const handleDollyTrackPadPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const panX = Number(((nx * 2 - 1) * 1.8).toFixed(2));
    const dollyZ = Number(((1 - ny * 2) * 1.8).toFixed(2));
    onChangeLiveCameraRig({
      ...liveCameraRig,
      enabled: true,
      source: 'potentiometer',
      panX,
      dollyZ,
    });
  };

  const renderTouchSlider = (
    label: string,
    value: number,
    min: number,
    max: number,
    unit: string,
    onChange: (val: number) => void,
    step = 1
  ) => (
    <div className="rounded-xl bg-[#0b0d13] border border-white/10 p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm font-medium text-[#eae6dc] truncate">
          {label}
        </span>
        <span className="text-sm font-mono-tabular font-semibold text-[#d4af37] shrink-0">
          {step < 1 ? value.toFixed(1) : Math.round(value)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="studio-slider w-full cursor-pointer"
      />
    </div>
  );

  const sessionTokenParam =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('token') || ''
      : '';

  return (
    <div className="min-h-[100dvh] w-full bg-[#090a0d] text-[#f4f1ea] flex flex-col overflow-y-auto pb-8">
      {/* Top Bar: Connection Status, Device Role Switcher & Return Button */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-[#0c0e14]/96 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Tablet className="w-5 h-5 text-[#d4af37] shrink-0" />
          <div>
            <div className="text-base sm:text-lg font-serif-display font-semibold text-white leading-tight">
              {deviceRoleMode === 'spatial_anchor'
                ? `Urządzenie Kotwica · ${activeAnchorId}`
                : 'Panel Sterujący Kamery · USCP-1.0'}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-tabular text-[#9e988c]">
              {connectionStatus === 'connected' ? (
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <Wifi className="w-3 h-3" />
                  <span>Połączono ({peers.length} urządzeń)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-400">
                  <WifiOff className="w-3 h-3" />
                  <span>{authRequired ? 'Wymagany PIN sesji' : 'Tryb lokalny / łączenie...'}</span>
                </span>
              )}
              {securityStatus?.tokenAuthenticated && (
                <span className="inline-flex items-center gap-1 text-emerald-300">
                  <ShieldCheck className="w-3 h-3" />
                  <span>{securityStatus.hmacVerified ? 'HMAC' : 'Token'}</span>
                </span>
              )}
              {latencyMs !== null && (
                <button
                  type="button"
                  onClick={onPingServerNow}
                  className="inline-flex items-center gap-1 text-[#e8ca64] hover:underline cursor-pointer"
                  title="Kliknij, aby zmierzyć bieżące opóźnienie łącza"
                >
                  <Activity className="w-3 h-3" />
                  <span>{latencyMs}ms</span>
                </button>
              )}
              {lastSyncAt && <span>· Sync {lastSyncAt}</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#141722] border border-white/12 rounded-lg px-2.5 py-1.5">
            <span className="text-[11px] text-[#9e988c]">Sesja:</span>
            <input
              type="text"
              value={controller.sessionId}
              onChange={(e) =>
                onChangeController({
                  ...controller,
                  sessionId: e.target.value.toUpperCase().slice(0, 24),
                })
              }
              aria-label="Kod sesji łącznika"
              className="w-24 bg-transparent text-xs font-mono-tabular font-semibold text-[#d4af37] focus:outline-none uppercase"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              onChangeController({
                ...controller,
                deviceRoleMode:
                  deviceRoleMode === 'spatial_anchor'
                    ? 'camera_console'
                    : 'spatial_anchor',
              })
            }
            className={`min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
              deviceRoleMode === 'spatial_anchor'
                ? 'bg-sky-500/20 text-sky-200 border-sky-400/50'
                : 'bg-[#171b24] hover:bg-[#222838] border-white/12 text-[#e5dec9]'
            }`}
          >
            <Radar className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>
              {deviceRoleMode === 'spatial_anchor'
                ? 'Przełącz na Sterownik'
                : 'Użyj jako Kotwicę'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowCalibrationPanel((v) => !v)}
            className={`min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
              showCalibrationPanel
                ? 'bg-[#d4af37] text-[#090a0d] border-[#d4af37]'
                : 'bg-[#171b24] hover:bg-[#222838] border-white/12 text-[#e8ca64]'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Kalibracja</span>
          </button>

          <button
            type="button"
            onClick={onExitTabletMode}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#171b24] hover:bg-[#222838] border border-white/12 text-xs font-medium text-white cursor-pointer"
          >
            <Monitor className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Widok Główny 3D</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 space-y-5">
        {/* Shot Confirmation Banner */}
        {shotFeedback && (
          <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/45 px-4 py-2.5 text-xs font-medium text-emerald-200">
            {shotFeedback}
          </div>
        )}

        {/* Optional PIN Unlock Card when paired manually without QR token */}
        {authRequired && onUnlockWithPin && (
          <section className="rounded-2xl bg-[#151822] border border-[#d4af37] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#e8ca64]">
                <KeyRound className="w-4 h-4" />
                <span>Bezpieczne Parowanie Urządzenia (Wpisz 6-znakowy PIN z ekranu głównego)</span>
              </div>
              <p className="text-[11px] text-[#b8b2a6]">
                {authError ||
                  `Sesja ${controller.sessionId} jest chroniona tokenem szyfrującym. Zeskanuj kod QR lub podaj PIN.`}
              </p>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setUnlocking(true);
                await onUnlockWithPin(pinInput);
                setUnlocking(false);
              }}
              className="flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.toUpperCase().slice(0, 8))}
                placeholder={pinCode || 'NP. K8M2P4'}
                aria-label="6-znakowy kod PIN parowania"
                className="w-32 min-h-[44px] rounded-xl bg-[#090a0d] border border-[#d4af37]/60 px-3 text-sm font-mono-tabular font-bold tracking-widest text-white text-center uppercase focus:outline-none"
              />
              <button
                type="submit"
                disabled={unlocking}
                className="min-h-[44px] px-4 rounded-xl bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] cursor-pointer"
              >
                {unlocking ? 'Łączenie...' : 'Odblokuj'}
              </button>
            </form>
          </section>
        )}

        {/* DEDICATED SPATIAL ANCHOR DEVICE VIEW (When this phone/tablet acts as a fixed room anchor) */}
        {deviceRoleMode === 'spatial_anchor' ? (
          <section className="rounded-2xl bg-[#11141d] border border-sky-400/45 p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-mono-tabular text-sky-300">
                  <Radar className="w-4 h-4" />
                  <span>WĘZEŁ ODNIESIENIA PRZESTRZENNEGO · {activeAnchorId}</span>
                </div>
                <h2 className="text-lg font-serif-display font-semibold text-white mt-0.5">
                  To urządzenie działa jako Stacjonarna Kotwica Lokalizująca Sterownik
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  onChangeController({
                    ...controller,
                    deviceRoleMode: 'camera_console',
                  })
                }
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#d4af37] text-[#090a0d] text-xs font-semibold cursor-pointer"
              >
                Przełącz na Ruchomy Sterownik Kamery
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {spatialAnchors.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    onChangeController({ ...controller, activeAnchorId: a.id });
                    onRegisterSpatialAnchor?.({ ...a, connected: true, lastSeenAt: Date.now() });
                  }}
                  className={`min-h-[48px] p-3 rounded-xl border text-left cursor-pointer ${
                    a.id === activeAnchorId
                      ? 'bg-sky-500/20 border-sky-400 text-white'
                      : 'bg-[#090a0d] border-white/10 text-[#b8b2a6]'
                  }`}
                >
                  <div className="text-xs font-semibold">{a.id}</div>
                  <div className="text-[10px] text-[#9e988c] truncate">{a.label}</div>
                </button>
              ))}
            </div>

            {activeAnchorNode && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl bg-[#090a0d] border border-white/10 p-4 space-y-3">
                  <div className="text-xs font-semibold text-white">
                    Odległość mierzona do ruchomego sterownika (d = {activeAnchorNode.measuredDistMeters.toFixed(2)} m)
                  </div>
                  <input
                    type="range"
                    min={0.35}
                    max={5.5}
                    step={0.05}
                    value={activeAnchorNode.measuredDistMeters}
                    onChange={(e) =>
                      onSendRangingSample?.([
                        {
                          anchorId: activeAnchorNode.id,
                          distanceMeters: Number(e.target.value),
                          signalQuality: 96,
                        },
                      ])
                    }
                    className="studio-slider w-full"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onRegisterSpatialAnchor?.({
                        ...activeAnchorNode,
                        connected: true,
                        lastSeenAt: Date.now(),
                      })
                    }
                    className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500/20 border border-sky-400/50 text-xs font-semibold text-sky-200 cursor-pointer"
                  >
                    <Radio className="w-4 h-4" />
                    <span>Potwierdź gotowość kotwicy {activeAnchorNode.id} na hubie USCP</span>
                  </button>
                </div>

                <div className="rounded-xl bg-[#090a0d] border border-white/10 p-4 space-y-2 text-xs">
                  <div className="font-semibold text-[#e8ca64]">
                    Rozwiązana pozycja sterownika w powietrzu (Trilateracja 3D):
                  </div>
                  <div className="font-mono-tabular text-sm text-white">
                    X: {solvedAirPose.x.toFixed(2)} m · Y: {solvedAirPose.y.toFixed(2)} m · Z:{' '}
                    {solvedAirPose.z.toFixed(2)} m
                  </div>
                  <div className="text-[11px] text-[#9e988c]">
                    PDOP: {solvedAirPose.pdop} · Pewność geometryczna: {solvedAirPose.confidencePct}%
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : (
          <>
            {/* 1. PROMINENT 1-CLICK CONNECTED CAMERA CONTROLLER FUNCTION MENU */}
            <CameraControllerFunctionMenu
              activeFunction={activeFunction}
              onSelectFunction={handleSelectCameraFunction}
              isConnected={connectionStatus === 'connected'}
              peerCount={peers.length}
              onQuickTriggerShot={triggerAirShotWithFeedback}
              compact
            />

            {/* In-Hand Handheld Auto-Calibration & Spatial Composer (Toggled from Header) */}
            {showCalibrationPanel && (
              <SpatialCalibrationComposer
                model={activeSpatialModel}
                onChangeModel={(nextModel) =>
                  onChangeController({
                    ...controller,
                    spatialModel: nextModel,
                  })
                }
                onSyncSensitivityToRig={(sens) =>
                  onChangeLiveCameraRig({
                    ...liveCameraRig,
                    vrSensitivity: sens,
                  })
                }
              />
            )}

            {/* FUNCTION-FOCUSED CAMERA CONTROL INTERFACE */}
            {activeFunction === 'camera_aim_vr' && (
              <CameraPotentiometerAndVRPad
                rig={liveCameraRig}
                onChangeRig={onChangeLiveCameraRig}
                spatialModel={activeSpatialModel}
                allowedKnobKeys={['yawDeg', 'pitchDeg', 'rollDeg']}
                onCaptureToState={(target) =>
                  onSendRemoteAction(
                    target === 'A' ? 'capture_vr_to_state_a' : 'capture_vr_to_state_b',
                    liveCameraRig
                  )
                }
                compact
              />
            )}

            {activeFunction === 'camera_dolly_track' && (
              <div className="space-y-4">
                <section className="rounded-2xl bg-[#11141d] border border-[#d4af37]/40 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-2 font-semibold text-white">
                      <Move className="w-4 h-4 text-[#d4af37]" />
                      <span>Touchpad Wózka Kamery (PAN X ↔ oraz DOLLY Z ↕)</span>
                    </span>
                    <span className="font-mono-tabular text-[#d4af37]">
                      PAN {liveCameraRig.panX.toFixed(2)}m · DOLLY {liveCameraRig.dollyZ.toFixed(2)}m
                    </span>
                  </div>

                  <div
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      dollyTrackPadRef.current = true;
                      handleDollyTrackPadPointer(e);
                    }}
                    onPointerMove={(e) => {
                      if (!dollyTrackPadRef.current) return;
                      handleDollyTrackPadPointer(e);
                    }}
                    onPointerUp={() => {
                      dollyTrackPadRef.current = false;
                    }}
                    onPointerCancel={() => {
                      dollyTrackPadRef.current = false;
                    }}
                    className="relative h-56 w-full rounded-xl bg-[#090a0d] border border-white/15 touch-none cursor-crosshair overflow-hidden"
                  >
                    <div className="absolute inset-x-4 top-1/2 h-px bg-white/15 pointer-events-none" />
                    <div className="absolute inset-y-4 left-1/2 w-px bg-white/15 pointer-events-none" />
                    <div
                      className="absolute w-9 h-9 -ml-4.5 -mt-4.5 rounded-full bg-[#d4af37]/25 border-2 border-[#d4af37] pointer-events-none flex items-center justify-center"
                      style={{
                        left: `${((liveCameraRig.panX / 1.8 + 1) / 2) * 100}%`,
                        top: `${((1 - liveCameraRig.dollyZ / 1.8) / 2) * 100}%`,
                      }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-[#fef08a]" />
                    </div>
                  </div>
                </section>

                <CameraPotentiometerAndVRPad
                  rig={liveCameraRig}
                  onChangeRig={onChangeLiveCameraRig}
                  spatialModel={activeSpatialModel}
                  allowedKnobKeys={['dollyZ', 'panX', 'fovOffset']}
                  onCaptureToState={(target) =>
                    onSendRemoteAction(
                      target === 'A' ? 'capture_vr_to_state_a' : 'capture_vr_to_state_b',
                      liveCameraRig
                    )
                  }
                  compact
                />
              </div>
            )}

            {activeFunction === 'camera_lens_focus' && (
              <div className="space-y-4">
                <CameraPotentiometerAndVRPad
                  rig={liveCameraRig}
                  onChangeRig={onChangeLiveCameraRig}
                  spatialModel={activeSpatialModel}
                  allowedKnobKeys={['fovOffset']}
                  compact
                />

                <section className="rounded-2xl bg-[#11141d] border border-[#d4af37]/30 p-4 space-y-3">
                  <div className="text-xs font-semibold text-[#e8ca64]">
                    Optyka 35mm, Głębia Ostrości DOF i Korekcja Obrazu
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {renderTouchSlider(
                      'Głębia optyczna 3D',
                      settings.depthIntensity,
                      0,
                      100,
                      '%',
                      (val) => onApplySettings({ depthIntensity: val })
                    )}
                    {renderTouchSlider(
                      'Rozmycie ostrości (DOF)',
                      settings.blurIntensity,
                      0,
                      100,
                      '%',
                      (val) => onApplySettings({ blurIntensity: val })
                    )}
                    {renderTouchSlider(
                      'Fotorealizm PBR (Marmur i Szkło)',
                      settings.photorealism,
                      0,
                      100,
                      '%',
                      (val) => onApplySettings({ photorealism: val })
                    )}
                    {renderTouchSlider(
                      'Winieta optyczna',
                      settings.vignetteIntensity,
                      0,
                      100,
                      '%',
                      (val) => onApplySettings({ vignetteIntensity: val })
                    )}
                  </div>
                </section>
              </div>
            )}

            {activeFunction === 'camera_path_scrub' && (
              <section className="rounded-2xl bg-[#11141d] border border-[#d4af37]/35 p-4 space-y-4">
                <div className="text-sm font-semibold text-white">
                  Ścieżka Kamery 3D (Stan A → Stan B) &amp; Wyzwalanie Ujęcia
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {renderTouchSlider(
                    'Smoothing Factor (Wygładzanie ścieżki 3D)',
                    currentSmoothing,
                    0,
                    100,
                    '%',
                    (val) =>
                      onChangeCameraBlocking({
                        ...cameraBlocking,
                        smoothingFactor: val,
                      })
                  )}
                  {renderTouchSlider(
                    'Krzywizna łuku ścieżki M',
                    cameraBlocking.curveArcOffset,
                    -2.5,
                    2.5,
                    ' m',
                    (val) =>
                      onChangeCameraBlocking({
                        ...cameraBlocking,
                        curveArcOffset: val,
                      }),
                    0.05
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeController({
                        ...controller,
                        show3DPathOnMainViewport: !controller.show3DPathOnMainViewport,
                      })
                    }
                    className={`min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                      controller.show3DPathOnMainViewport
                        ? 'bg-[#d4af37] text-[#090a0d] border-[#d4af37]'
                        : 'bg-[#090a0d] text-[#c5bfb3] border-white/12'
                    }`}
                  >
                    <Route className="w-4 h-4" />
                    <span>
                      Linia Ścieżki 3D na Ekranie:{' '}
                      {controller.show3DPathOnMainViewport ? 'WŁ.' : 'WYŁ.'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onChangeCameraBlocking({
                        ...cameraBlocking,
                        lockFramingToTarget: !cameraBlocking.lockFramingToTarget,
                      })
                    }
                    className={`min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                      cameraBlocking.lockFramingToTarget
                        ? 'bg-sky-500/25 text-sky-200 border-sky-400/50'
                        : 'bg-[#090a0d] text-[#c5bfb3] border-white/12'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>
                      Ryglowanie Celu 3D: {cameraBlocking.lockFramingToTarget ? 'WŁ.' : 'WYŁ.'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSendRemoteAction('capture_vr_to_state_a', liveCameraRig)}
                    className="min-h-[48px] px-4 py-2 rounded-xl bg-emerald-500/18 border border-emerald-400/50 text-xs font-semibold text-emerald-200 cursor-pointer"
                  >
                    Zapisz bieżącą kamerę jako Stan A
                  </button>

                  <button
                    type="button"
                    onClick={() => onSendRemoteAction('capture_vr_to_state_b', liveCameraRig)}
                    className="min-h-[48px] px-4 py-2 rounded-xl bg-amber-500/18 border border-amber-400/50 text-xs font-semibold text-amber-200 cursor-pointer"
                  >
                    Zapisz bieżącą kamerę jako Stan B
                  </button>
                </div>
              </section>
            )}

            {activeFunction === 'camera_air_6dof' && (
              <div className="space-y-4">
                <SpatialMultiDevicePlanner
                  sessionId={controller.sessionId}
                  sessionToken={sessionTokenParam}
                  anchors={spatialAnchors}
                  solvedAirPose={solvedAirPose}
                  liveCameraRig={liveCameraRig}
                  onChangeLiveCameraRig={onChangeLiveCameraRig}
                  onRegisterAnchor={(a) => onRegisterSpatialAnchor?.(a)}
                  onSendRangingSample={(s) => onSendRangingSample?.(s)}
                  onSendAirPose={(p) => onSendAirPose?.(p)}
                  onTriggerAirShot={triggerAirShotWithFeedback}
                />

                <CameraPotentiometerAndVRPad
                  rig={liveCameraRig}
                  onChangeRig={onChangeLiveCameraRig}
                  spatialModel={activeSpatialModel}
                  allowedKnobKeys={['yawDeg', 'pitchDeg', 'rollDeg', 'dollyZ']}
                  onCaptureToState={(target) =>
                    onSendRemoteAction(
                      target === 'A' ? 'capture_vr_to_state_a' : 'capture_vr_to_state_b',
                      liveCameraRig
                    )
                  }
                  compact
                />
              </div>
            )}

            {activeFunction === 'camera_full_rig' && (
              <>
                <CameraPotentiometerAndVRPad
                  rig={liveCameraRig}
                  onChangeRig={onChangeLiveCameraRig}
                  spatialModel={activeSpatialModel}
                  onCaptureToState={(target) =>
                    onSendRemoteAction(
                      target === 'A' ? 'capture_vr_to_state_a' : 'capture_vr_to_state_b',
                      liveCameraRig
                    )
                  }
                  compact
                />

                <SpatialMultiDevicePlanner
                  sessionId={controller.sessionId}
                  sessionToken={sessionTokenParam}
                  anchors={spatialAnchors}
                  solvedAirPose={solvedAirPose}
                  liveCameraRig={liveCameraRig}
                  onChangeLiveCameraRig={onChangeLiveCameraRig}
                  onRegisterAnchor={(a) => onRegisterSpatialAnchor?.(a)}
                  onSendRangingSample={(s) => onSendRangingSample?.(s)}
                  onSendAirPose={(p) => onSendAirPose?.(p)}
                  onTriggerAirShot={triggerAirShotWithFeedback}
                />

                {/* Element Switch-Set Isolator (Tablet Touch Bar) */}
                <section className="rounded-2xl bg-[#11141d] border border-white/10 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-white">
                      <PlugZap className="w-4 h-4 text-[#d4af37]" />
                      <span>Wybierz Zestaw Przełączników dla Konkretnego Elementu</span>
                    </div>
                    <span className="text-[11px] font-mono-tabular text-[#d4af37]">
                      Aktywne zestawy: {enabledCount}/5
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {ELEMENT_FOCUS_PRESETS.map((p) => {
                      const active = controller.activeFocusPreset === p.id;
                      const shortTitle = p.title
                        .replace('Pełna Konsola Studyjna (Wszystkie zestawy)', 'Wszystkie Zestawy')
                        .replace('Tylko Element: ', '');
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => applyFocusPreset(p.id)}
                          className={`min-h-[48px] px-3 py-2 rounded-xl border text-xs font-medium text-center transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#d4af37] text-[#090a0d] border-[#d4af37] font-semibold'
                              : 'bg-[#090a0d] text-[#c5bfb3] border-white/10 hover:border-white/25'
                          }`}
                        >
                          {shortTitle}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1 border-t border-white/8">
                    {SWITCH_GROUP_DEFINITIONS.map((grp) => {
                      const active = controller.enabledGroups[grp.id];
                      return (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={() => toggleGroup(grp.id)}
                          className={`min-h-[40px] px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#d4af37]/18 border-[#d4af37]/60 text-[#e8ca64] font-semibold'
                              : 'bg-[#090a0d] border-white/10 text-[#7f7a6f]'
                          }`}
                        >
                          {active ? '✓ ' : '+ '}
                          {grp.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Active Element Touch Control Faders */}
                <section className="rounded-2xl bg-[#11141d] border border-[#d4af37]/30 p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                      <Sliders className="w-4 h-4 text-[#d4af37]" />
                      <span>Pulpit Sterowania Elementami (Live Sync z Ekranem Głównym)</span>
                    </div>
                  </div>

                  {enabledCount === 0 ? (
                    <div className="py-8 text-center text-xs text-[#9e988c]">
                      Wybierz co najmniej jeden zestaw przełączników powyżej, aby rozpocząć pracę z tabletem.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {g.camera_path_3d && (
                        <>
                          {renderTouchSlider(
                            'Smoothing Factor (Wygładzanie ścieżki 3D)',
                            currentSmoothing,
                            0,
                            100,
                            '%',
                            (val) =>
                              onChangeCameraBlocking({
                                ...cameraBlocking,
                                smoothingFactor: val,
                              })
                          )}
                          {renderTouchSlider(
                            'Krzywizna łuku ścieżki M',
                            cameraBlocking.curveArcOffset,
                            -2.5,
                            2.5,
                            ' m',
                            (val) =>
                              onChangeCameraBlocking({
                                ...cameraBlocking,
                                curveArcOffset: val,
                              }),
                            0.05
                          )}
                          <div className="md:col-span-2 flex flex-wrap gap-2.5">
                            <button
                              type="button"
                              onClick={() =>
                                onChangeController({
                                  ...controller,
                                  show3DPathOnMainViewport: !controller.show3DPathOnMainViewport,
                                })
                              }
                              className={`min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                                controller.show3DPathOnMainViewport
                                  ? 'bg-[#d4af37] text-[#090a0d] border-[#d4af37]'
                                  : 'bg-[#090a0d] text-[#c5bfb3] border-white/12'
                              }`}
                            >
                              <Route className="w-4 h-4" />
                              <span>
                                Linia Ścieżki 3D na Ekranie:{' '}
                                {controller.show3DPathOnMainViewport ? 'WŁ.' : 'WYŁ.'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                onChangeCameraBlocking({
                                  ...cameraBlocking,
                                  lockFramingToTarget: !cameraBlocking.lockFramingToTarget,
                                })
                              }
                              className={`min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                                cameraBlocking.lockFramingToTarget
                                  ? 'bg-sky-500/25 text-sky-200 border-sky-400/50'
                                  : 'bg-[#090a0d] text-[#c5bfb3] border-white/12'
                              }`}
                            >
                              <Camera className="w-4 h-4" />
                              <span>
                                Ryglowanie Celu 3D: {cameraBlocking.lockFramingToTarget ? 'WŁ.' : 'WYŁ.'}
                              </span>
                            </button>
                          </div>
                        </>
                      )}

                      {g.lighting && (
                        <>
                          {renderTouchSlider(
                            'Światło dzienne w oknach',
                            settings.windowLightIntensity,
                            0,
                            100,
                            '%',
                            (val) => onApplySettings({ windowLightIntensity: val })
                          )}
                          {renderTouchSlider(
                            'Złota godzina i oprawy LED',
                            settings.warmGlow,
                            0,
                            100,
                            '%',
                            (val) => onApplySettings({ warmGlow: val })
                          )}
                          <div className="md:col-span-2">
                            <button
                              type="button"
                              onClick={() => onApplySettings({ show3DProps: !settings.show3DProps })}
                              className={`min-h-[48px] w-full px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                                settings.show3DProps
                                  ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#e8ca64]'
                                  : 'bg-[#090a0d] border-white/12 text-[#9e988c]'
                              }`}
                            >
                              Bryły Oświetlenia 3D w Scenie: {settings.show3DProps ? 'WIDOCZNE' : 'UKRYTE'}
                            </button>
                          </div>
                        </>
                      )}

                      {g.optics_pbr && (
                        <>
                          {renderTouchSlider(
                            'Głębia optyczna 3D',
                            settings.depthIntensity,
                            0,
                            100,
                            '%',
                            (val) => onApplySettings({ depthIntensity: val })
                          )}
                          {renderTouchSlider(
                            'Fotorealizm PBR (Marmur i Szkło)',
                            settings.photorealism,
                            0,
                            100,
                            '%',
                            (val) => onApplySettings({ photorealism: val })
                          )}
                          {renderTouchSlider(
                            'Rozmycie ostrości (DOF)',
                            settings.blurIntensity,
                            0,
                            100,
                            '%',
                            (val) => onApplySettings({ blurIntensity: val })
                          )}
                          {renderTouchSlider(
                            'Winieta optyczna',
                            settings.vignetteIntensity,
                            0,
                            100,
                            '%',
                            (val) => onApplySettings({ vignetteIntensity: val })
                          )}
                        </>
                      )}

                      {g.color_lut && (
                        <>
                          <div className="md:col-span-2 flex flex-wrap gap-2">
                            {VISUAL_FX_PRESETS.map((fx) => (
                              <button
                                key={fx.id}
                                type="button"
                                onClick={() => onApplySettings(fx.settings)}
                                className={`min-h-[44px] flex-1 min-w-[120px] px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer ${
                                  settings.activeFxPreset === fx.id
                                    ? 'bg-[#d4af37] text-[#090a0d] border-[#d4af37] font-semibold'
                                    : 'bg-[#090a0d] text-[#c5bfb3] border-white/10'
                                }`}
                              >
                                {fx.name}
                              </button>
                            ))}
                          </div>
                          {renderTouchSlider(
                            'Korekcja kolorów (LUT)',
                            settings.colorGrading,
                            0,
                            100,
                            '%',
                            (val) => onApplySettings({ colorGrading: val })
                          )}
                          {renderTouchSlider(
                            'Ziarno filmowe 35mm',
                            settings.filmGrain,
                            0,
                            100,
                            '%',
                            (val) => onApplySettings({ filmGrain: val })
                          )}
                        </>
                      )}

                      {g.mobile_framing && (
                        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              onChangeController({
                                ...controller,
                                mobileSafeZonesVisible: !controller.mobileSafeZonesVisible,
                              })
                            }
                            className={`min-h-[48px] px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                              controller.mobileSafeZonesVisible
                                ? 'bg-[#d4af37] text-[#090a0d] border-[#d4af37]'
                                : 'bg-[#090a0d] text-[#c5bfb3] border-white/12'
                            }`}
                          >
                            Strefy bezpieczne 9:16: {controller.mobileSafeZonesVisible ? 'WŁ.' : 'WYŁ.'}
                          </button>
                          <button
                            type="button"
                            onClick={onToggleStoryOverlay}
                            className={`min-h-[48px] px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                              showStoryOverlay
                                ? 'bg-white/16 text-white border-white/30'
                                : 'bg-[#090a0d] text-[#c5bfb3] border-white/12'
                            }`}
                          >
                            Warstwa narracji: {showStoryOverlay ? 'WŁ.' : 'WYŁ.'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </>
            )}

            {/* Synced Desktop Scenes Switcher */}
            {remoteScenes.length > 0 && (
              <section className="rounded-2xl bg-[#11141d] border border-white/10 p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">
                    Sceny na Ekranie Głównym (kliknij, aby przełączyć obraz)
                  </span>
                  <span className="font-mono-tabular text-[#9e988c]">
                    {remoteScenes.length} dostępnych
                  </span>
                </div>
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                  {remoteScenes.map((sc) => {
                    const isSelected = sc.id === remoteActiveSceneId;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => onSendRemoteAction('select_scene', { sceneId: sc.id })}
                        className={`min-h-[54px] flex items-center gap-2.5 px-3 py-2 rounded-xl border shrink-0 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#d4af37]/16 border-[#d4af37] text-white'
                            : 'bg-[#090a0d] border-white/10 text-[#c5bfb3]'
                        }`}
                      >
                        {sc.previewThumb && (
                          <img
                            src={sc.previewThumb}
                            alt={sc.title}
                            className="w-14 h-9 rounded object-cover border border-white/10"
                          />
                        )}
                        <div className="text-left">
                          <div className="text-xs font-semibold truncate max-w-[140px]">
                            {sc.title}
                          </div>
                          <div className="text-[10px] text-[#9e988c]">
                            {isSelected ? 'Aktywna na 3D' : 'Przełącz ekran'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Remote Host Execution Pad */}
            <section className="rounded-2xl bg-[#11141d] border border-white/10 p-4 space-y-3">
              <div className="text-xs font-semibold text-white">
                Polecenia Zdalne na Ekranie Głównym (Wykonanie Rzutu / Kadru)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <button
                  type="button"
                  onClick={triggerAirShotWithFeedback}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Zrób Rzut / Kadr</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSendRemoteAction('regenerate_keyframes')}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs font-medium text-white cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-[#d4af37]" />
                  <span>Przelicz 4 Kadry</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSendRemoteAction('export_webp')}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs font-medium text-white cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#d4af37]" />
                  <span>Eksport WebP</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSendRemoteAction('export_mp4')}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs font-medium text-white cursor-pointer"
                >
                  <Film className="w-4 h-4 text-[#d4af37]" />
                  <span>Renderuj MP4</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSendRemoteAction('reset_settings')}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs font-medium text-[#c5bfb3] cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Sceny</span>
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};
