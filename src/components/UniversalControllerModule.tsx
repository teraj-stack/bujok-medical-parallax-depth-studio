import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Activity,
  Check,
  Code2,
  Copy,
  Filter,
  KeyRound,
  Lock,
  PlugZap,
  QrCode,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Tablet,
  ToggleLeft,
  ToggleRight,
  Upload,
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
  SpatialControllerModel,
  SwitchGroupId,
  UniversalControllerConfig,
  VisualEffectSettings,
} from '../types/studio';
import { CameraControllerFunctionMenu } from './CameraControllerFunctionMenu';
import { CameraPotentiometerAndVRPad } from './CameraPotentiometerAndVRPad';
import { SpatialCalibrationComposer } from './SpatialCalibrationComposer';
import { SpatialMultiDevicePlanner } from './SpatialMultiDevicePlanner';
import {
  buildStandardConnectorPacket,
  DEFAULT_CAMERA_3D_SPATIAL_MODEL,
  DEFAULT_SOLVED_AIR_POSE,
  DEFAULT_SPATIAL_ANCHORS,
  ELEMENT_FOCUS_PRESETS,
  SWITCH_GROUP_DEFINITIONS,
  UNIVERSAL_CONNECTOR_SDK_SNIPPET,
  UscpPeerInfo,
  UscpSecurityStatus,
} from '../universal-controller/connectorProtocol';

interface UniversalControllerModuleProps {
  controller: UniversalControllerConfig;
  onChangeController: (next: UniversalControllerConfig) => void;
  settings: VisualEffectSettings;
  onApplySettings: (partial: Partial<VisualEffectSettings>) => void;
  cameraBlocking: CameraBlockingConfig;
  onChangeCameraBlocking: (next: CameraBlockingConfig) => void;
  liveCameraRig: LiveCameraRigState;
  onChangeLiveCameraRig: (next: LiveCameraRigState) => void;
  onCaptureVrToBlockingState: (target: 'A' | 'B') => void;
  showStoryOverlay: boolean;
  onToggleStoryOverlay: () => void;
  connectionStatus: 'connecting' | 'connected' | 'local_only';
  peers: UscpPeerInfo[];
  sessionToken?: string;
  pinCode?: string;
  latencyMs?: number | null;
  securityStatus?: UscpSecurityStatus;
  spatialAnchors?: SpatialAnchorNode[];
  solvedAirPose?: SolvedAirPose;
  onRegisterSpatialAnchor?: (anchor: SpatialAnchorNode) => void;
  onSendRangingSample?: (
    samples: Array<{ anchorId: string; distanceMeters: number; signalQuality?: number }>
  ) => void;
  onSendAirPose?: (pose: { x: number; y: number; z: number }) => void;
  onTriggerAirShot?: () => void;
  onRotateSecureSession?: () => void;
  onPingServerNow?: () => void;
  onForceSyncNow: () => void;
  onSwitchToLocalTabletMode: () => void;
}

export const UniversalControllerModule: React.FC<UniversalControllerModuleProps> = ({
  controller,
  onChangeController,
  settings,
  onApplySettings,
  cameraBlocking,
  onChangeCameraBlocking,
  liveCameraRig,
  onChangeLiveCameraRig,
  onCaptureVrToBlockingState,
  showStoryOverlay,
  onToggleStoryOverlay,
  connectionStatus,
  peers,
  sessionToken = '',
  pinCode = '',
  latencyMs = null,
  securityStatus,
  spatialAnchors = DEFAULT_SPATIAL_ANCHORS,
  solvedAirPose = DEFAULT_SOLVED_AIR_POSE,
  onRegisterSpatialAnchor,
  onSendRangingSample,
  onSendAirPose,
  onTriggerAirShot,
  onRotateSecureSession,
  onPingServerNow,
  onForceSyncNow,
  onSwitchToLocalTabletMode,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [showImportBox, setShowImportBox] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const tabletPairUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}${window.location.pathname}`;
    const tokenPart = sessionToken ? `&token=${encodeURIComponent(sessionToken)}` : '';
    return `${base}?mode=tablet&session=${encodeURIComponent(
      controller.sessionId || 'BUJOK-STUDIO'
    )}${tokenPart}`;
  }, [controller.sessionId, sessionToken]);

  const activeSpatialModel: SpatialControllerModel =
    controller.spatialModel || DEFAULT_CAMERA_3D_SPATIAL_MODEL;

  useEffect(() => {
    if (!tabletPairUrl) return;
    QRCode.toDataURL(tabletPairUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: '#f4f1ea',
        light: '#090a0d',
      },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [tabletPairUrl]);

  const livePacket = useMemo(
    () =>
      buildStandardConnectorPacket(
        controller,
        settings,
        cameraBlocking,
        showStoryOverlay,
        'preview_inspector',
        liveCameraRig
      ),
    [controller, settings, cameraBlocking, showStoryOverlay, liveCameraRig]
  );

  const copyWithFeedback = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 2000);
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

  const toggleGroup = (groupId: SwitchGroupId) => {
    const nextGroups = {
      ...controller.enabledGroups,
      [groupId]: !controller.enabledGroups[groupId],
    };
    onChangeController({
      ...controller,
      activeFocusPreset: 'custom_selection',
      enabledGroups: nextGroups,
    });
  };

  const isolateSingleGroup = (groupId: SwitchGroupId) => {
    const isolated: Record<SwitchGroupId, boolean> = {
      camera_path_3d: false,
      lighting: false,
      optics_pbr: false,
      color_lut: false,
      mobile_framing: false,
      [groupId]: true,
    };
    onChangeController({
      ...controller,
      activeFocusPreset: 'custom_selection',
      enabledGroups: isolated,
    });
  };

  const handleApplyImportedJson = () => {
    try {
      const parsed = JSON.parse(importJsonText);
      if (parsed.protocol !== 'USCP-1.0') {
        setImportFeedback('Nieprawidłowy protokół — wymagany pakiet USCP-1.0.');
        return;
      }
      if ((window as any).UniversalAppConnector?.applyPacket) {
        (window as any).UniversalAppConnector.applyPacket(parsed);
        setImportFeedback('Zaimportowano i zastosowano stan z łącznika USCP-1.0.');
      }
    } catch {
      setImportFeedback('Błąd składni JSON — sprawdź wklejony pakiet łącznika.');
    }
  };

  const enabledCount = Object.values(controller.enabledGroups).filter(Boolean).length;
  const currentSmoothing =
    cameraBlocking.smoothingFactor ??
    (cameraBlocking.easingStyle === 'linear_constant' ? 0 : 65);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="inline-flex flex-wrap items-center gap-2 text-[11px] font-mono-tabular text-[#d4af37] mb-1">
            <PlugZap className="w-3.5 h-3.5" />
            <span>
              PROTOKÓŁ ŁĄCZNIKA: {controller.protocolVersion} · SESJA: {controller.sessionId} · ZESTAWY: {enabledCount}/5
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-serif-display font-semibold text-white">
            Panel Tabletu (2. Ekran) &amp; Wspólny Łącznik Wielu Aplikacji (USCP-1.0)
          </h2>
          <p className="text-xs text-[#b8b2a6] mt-1 max-w-3xl leading-relaxed">
            Podłącz tablet lub osobny monitor jako zewnętrzną konsolę dotykową i udostępniaj wspólne, wystandaryzowane złącze{' '}
            <code className="text-[#e8ca64]">USCP-1.0</code> dla wszystkich swoich aplikacji — z możliwością włączania wyłącznie wybranych zestawów przełączników.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onForceSyncNow();
              copyWithFeedback('sync_ping', JSON.stringify(livePacket, null, 2));
            }}
            className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] transition-colors cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>
              {copiedKey === 'sync_ping'
                ? 'Zsynchronizowano sesję!'
                : 'Synchronizuj sesję teraz'}
            </span>
          </button>
        </div>
      </div>

      {/* SECTION 0: SECOND-SCREEN TABLET PAIRING (QR + SESSION BRIDGE) */}
      <div className="rounded-2xl bg-[#11141d] border border-[#d4af37]/40 p-4 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        <div className="md:col-span-3 flex flex-col items-center gap-2">
          {qrDataUrl ? (
            <div className="p-2.5 rounded-xl bg-[#090a0d] border border-white/15">
              <img
                src={qrDataUrl}
                alt="Kod QR do podłączenia tabletu jako drugiego ekranu"
                className="w-36 h-36 rounded"
              />
            </div>
          ) : (
            <div className="w-36 h-36 rounded-xl bg-[#090a0d] border border-white/12 flex items-center justify-center">
              <QrCode className="w-8 h-8 text-[#d4af37]" />
            </div>
          )}
          <span className="text-[11px] font-mono-tabular text-[#9e988c] text-center">
            Zeskanuj telefonem lub tabletem
          </span>
        </div>

        <div className="md:col-span-9 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
              <Tablet className="w-4 h-4 text-[#d4af37]" />
              <span>Podłączenie Telefonu / Tabletu (Sterowanie VR i Potencjometrami)</span>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-mono-tabular">
              {connectionStatus === 'connected' ? (
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Hub WS aktywny · {peers.length} połączeń</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-400">
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Kanał lokalny aktywny</span>
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-[#b8b2a6] leading-relaxed">
            Otwórz poniższy adres na telefonie (żyroskop VR + potencjometry dotykowe), tablecie lub drugim monitorze. Każdy ruch dłonią w przestrzeni VR oraz obrót potencjometrów steruje kamerą 3D w czasie rzeczywistym przez{' '}
            <code className="text-[#d4af37]">/ws/uscp</code>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
            <div className="sm:col-span-4">
              <label className="block text-[10px] text-[#9e988c] mb-1">
                Kod Sesji Parowania (Session ID):
              </label>
              <input
                type="text"
                value={controller.sessionId}
                onChange={(e) =>
                  onChangeController({
                    ...controller,
                    sessionId: e.target.value.toUpperCase().slice(0, 24),
                  })
                }
                className="w-full min-h-[40px] rounded-lg bg-[#090a0d] border border-white/12 px-3 py-1.5 text-xs font-mono-tabular font-semibold text-[#d4af37] uppercase"
              />
            </div>

            <div className="sm:col-span-8">
              <label className="block text-[10px] text-[#9e988c] mb-1">
                Link do Panelu Tabletu (2. Ekran):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={tabletPairUrl}
                  className="flex-1 min-h-[40px] rounded-lg bg-[#090a0d] border border-white/12 px-3 py-1.5 text-[11px] font-mono-tabular text-[#eae6dc]"
                />
                <button
                  type="button"
                  onClick={() => copyWithFeedback('tablet_url', tabletPairUrl)}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] shrink-0 cursor-pointer"
                >
                  {copiedKey === 'tablet_url' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Skopiowano!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Kopiuj Link Tabletu</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Hardened Network Link Security & Simplicity Bar */}
          <div className="rounded-xl bg-[#090a0d] border border-emerald-400/25 p-3 flex flex-wrap items-center justify-between gap-2.5 text-[11px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/12 border border-emerald-400/30 text-emerald-200 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  {securityStatus?.tlsEncrypted ? 'WSS / TLS + Token' : 'Token Auth + HMAC-SHA256'}
                </span>
              </span>

              {pinCode && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#141722] border border-[#d4af37]/35 font-mono-tabular text-[#e8ca64]">
                  <KeyRound className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>PIN Parowania: <strong>{pinCode}</strong></span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#141722] border border-white/10 text-[#b8b2a6] font-mono-tabular">
                <Lock className="w-3 h-3 text-[#d4af37]" />
                <span>Rate-Limit 90/s · Origin Check</span>
              </span>

              {latencyMs !== null && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#141722] border border-white/10 text-emerald-300 font-mono-tabular">
                  <Activity className="w-3 h-3" />
                  <span>RTT: {latencyMs} ms</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onPingServerNow && (
                <button
                  type="button"
                  onClick={onPingServerNow}
                  className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141722] hover:bg-[#1e2334] border border-white/12 text-[11px] text-[#e5dec9] cursor-pointer"
                >
                  <Activity className="w-3 h-3 text-[#d4af37]" />
                  <span>Testuj opóźnienie</span>
                </button>
              )}

              {onRotateSecureSession && (
                <button
                  type="button"
                  onClick={onRotateSecureSession}
                  className="min-h-[34px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#181c26] hover:bg-[#232938] border border-[#d4af37]/40 text-[11px] font-semibold text-[#e8ca64] cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Nowe bezpieczne łącze QR</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#9e988c]">
              <span>Połączone węzły:</span>
              {peers.length === 0 ? (
                <span className="text-[#cbc5b8]">Oczekiwanie na tablet lub inne aplikacje...</span>
              ) : (
                peers.map((p) => (
                  <span
                    key={p.clientId}
                    className="px-2 py-0.5 rounded bg-[#090a0d] border border-white/10 font-mono-tabular text-[#e8ca64]"
                  >
                    {p.role.toUpperCase()} · {p.appNamespace}
                  </span>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={onSwitchToLocalTabletMode}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs text-white cursor-pointer"
            >
              <Tablet className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Przełącz ten ekran na interfejs Tabletu</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 0A: 1-CLICK CONNECTED CAMERA CONTROLLER FUNCTION MENU */}
      <CameraControllerFunctionMenu
        activeFunction={controller.activeCameraFunction || 'camera_full_rig'}
        isConnected={connectionStatus === 'connected'}
        peerCount={peers.length}
        onQuickTriggerShot={onTriggerAirShot}
        onSelectFunction={(
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
        }}
      />

      {/* SECTION 0B: VR MOTION & POTENTIOMETERS DIRECT CONSOLE */}
      <CameraPotentiometerAndVRPad
        rig={liveCameraRig}
        onChangeRig={onChangeLiveCameraRig}
        spatialModel={activeSpatialModel}
        onCaptureToState={onCaptureVrToBlockingState}
      />

      {/* SECTION 0B2: MULTI-DEVICE SPATIAL LOCALIZATION & AIR-WAND PLANNER */}
      <SpatialMultiDevicePlanner
        sessionId={controller.sessionId}
        sessionToken={sessionToken}
        anchors={spatialAnchors}
        solvedAirPose={solvedAirPose}
        liveCameraRig={liveCameraRig}
        onChangeLiveCameraRig={onChangeLiveCameraRig}
        onRegisterAnchor={(a) => onRegisterSpatialAnchor?.(a)}
        onSendRangingSample={(s) => onSendRangingSample?.(s)}
        onSendAirPose={(p) => onSendAirPose?.(p)}
        onTriggerAirShot={onTriggerAirShot}
      />

      {/* SECTION 0C: RAPID SPATIAL CONTROLLER COMPOSER & AUTO-CALIBRATION TOOL */}
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

      {/* SECTION 1: ELEMENT FOCUS PRESETS & SWITCH-SET MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 rounded-2xl bg-[#12151e] border border-white/10 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Filter className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>01. Tryb pracy nad konkretnym elementem</span>
          </div>
          <p className="text-[11px] text-[#9e988c]">
            Wybierz element, nad którym teraz pracujesz — sterownik włączy wyłącznie przypisany zestaw przełączników zarówno tutaj, jak i na podłączonym tablecie.
          </p>

          <div className="space-y-2">
            {ELEMENT_FOCUS_PRESETS.map((preset) => {
              const isSelected = controller.activeFocusPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyFocusPreset(preset.id)}
                  className={`w-full min-h-[48px] text-left px-3.5 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#d4af37]/16 border-[#d4af37] text-white'
                      : 'bg-[#090a0d] border-white/10 text-[#c5bfb3] hover:border-white/25'
                  }`}
                >
                  <div className="text-xs font-semibold">{preset.title}</div>
                  <div className="text-[11px] text-[#9e988c] mt-0.5">{preset.subtitle}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 rounded-2xl bg-[#12151e] border border-white/10 p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Sliders className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>02. Matryca Zestawów Przełączników (Włącz / Wyłącz zestaw)</span>
            </div>
            <span className="text-[11px] font-mono-tabular text-[#9e988c]">
              Kliknij „Tylko ten”, aby odizolować pojedynczy zestaw
            </span>
          </div>

          <div className="space-y-2.5">
            {SWITCH_GROUP_DEFINITIONS.map((group) => {
              const enabled = controller.enabledGroups[group.id];
              return (
                <div
                  key={group.id}
                  className={`rounded-xl border p-3.5 transition-colors ${
                    enabled
                      ? 'bg-[#171b26] border-[#d4af37]/45'
                      : 'bg-[#090a0d]/80 border-white/8 opacity-70'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className="min-h-[40px] flex items-center gap-2.5 text-left cursor-pointer"
                    >
                      {enabled ? (
                        <ToggleRight className="w-6 h-6 text-[#d4af37] shrink-0" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-[#7f7a6f] shrink-0" />
                      )}
                      <div>
                        <div className="text-xs font-semibold text-white">{group.label}</div>
                        <div className="text-[11px] text-[#9e988c]">
                          {group.targetElementDesc}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => isolateSingleGroup(group.id)}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white/8 hover:bg-[#d4af37] hover:text-[#090a0d] text-[11px] font-medium text-[#e5dec9] transition-colors shrink-0 cursor-pointer"
                    >
                      Tylko ten zestaw
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-white/8 text-[10px] text-[#cbc5b8]">
                    {group.includedSwitches.map((sw) => (
                      <span
                        key={sw}
                        className="px-2 py-0.5 rounded bg-[#090a0d] border border-white/10"
                      >
                        {sw}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 2: ISOLATED ACTIVE ELEMENT WORKBENCH */}
      <div className="rounded-2xl bg-[#11141d] border border-[#d4af37]/35 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
          <div>
            <h3 className="text-sm font-semibold text-white">
              03. Aktywny Pulpit Roboczy Wybranych Zestawów Przełączników
            </h3>
            <p className="text-xs text-[#9e988c]">
              Widoczne są wyłącznie przełączniki należące do aktualnie włączonych zestawów elementu.
            </p>
          </div>
        </div>

        {enabledCount === 0 ? (
          <div className="py-6 text-center text-xs text-[#9e988c]">
            Wszystkie zestawy przełączników są obecnie wyłączone. Włącz wybrany zestaw powyżej, aby edytować dany element.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {controller.enabledGroups.camera_path_3d && (
              <div className="rounded-xl bg-[#090a0d] border border-white/10 p-4 space-y-3">
                <div className="text-xs font-semibold text-[#e8ca64]">
                  Zestaw: Ścieżka Kamery 3D (Stan A → B)
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeController({
                        ...controller,
                        show3DPathOnMainViewport: !controller.show3DPathOnMainViewport,
                      })
                    }
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                      controller.show3DPathOnMainViewport
                        ? 'bg-[#d4af37] text-[#090a0d] border-[#d4af37] font-semibold'
                        : 'bg-[#141720] text-[#b8b2a6] border-white/12'
                    }`}
                  >
                    Linia ścieżki 3D na ekranie:{' '}
                    {controller.show3DPathOnMainViewport ? 'WŁ.' : 'WYŁ.'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onChangeCameraBlocking({
                        ...cameraBlocking,
                        lockFramingToTarget: !cameraBlocking.lockFramingToTarget,
                      })
                    }
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                      cameraBlocking.lockFramingToTarget
                        ? 'bg-sky-500/20 text-sky-200 border-sky-400/50'
                        : 'bg-[#141720] text-[#b8b2a6] border-white/12'
                    }`}
                  >
                    Ryglowanie celu 3D: {cameraBlocking.lockFramingToTarget ? 'WŁ.' : 'WYŁ.'}
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#c5bfb3]">Smoothing Factor (Wygładzanie ruchu)</span>
                    <span className="font-mono-tabular text-[#d4af37]">{currentSmoothing}%</span>
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

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#c5bfb3]">Łuk poziomy ścieżki M (m)</span>
                    <span className="font-mono-tabular text-[#d4af37]">
                      {cameraBlocking.curveArcOffset.toFixed(2)} m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-2.5}
                    max={2.5}
                    step={0.05}
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
              </div>
            )}

            {controller.enabledGroups.lighting && (
              <div className="rounded-xl bg-[#090a0d] border border-white/10 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#e8ca64]">
                    Zestaw: Oświetlenie Okien i Złota Godzina
                  </span>
                  <button
                    type="button"
                    onClick={() => onApplySettings({ show3DProps: !settings.show3DProps })}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer ${
                      settings.show3DProps
                        ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#e8ca64]'
                        : 'bg-[#141720] border-white/10 text-[#9e988c]'
                    }`}
                  >
                    Bryły oświetlenia 3D: {settings.show3DProps ? 'WŁ.' : 'WYŁ.'}
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#c5bfb3]">Światło dzienne w oknach</span>
                    <span className="font-mono-tabular text-[#d4af37]">
                      {settings.windowLightIntensity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={settings.windowLightIntensity}
                    onChange={(e) =>
                      onApplySettings({ windowLightIntensity: Number(e.target.value) })
                    }
                    className="studio-slider w-full"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#c5bfb3]">Złota godzina i oprawy LED</span>
                    <span className="font-mono-tabular text-[#d4af37]">{settings.warmGlow}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={settings.warmGlow}
                    onChange={(e) => onApplySettings({ warmGlow: Number(e.target.value) })}
                    className="studio-slider w-full"
                  />
                </div>
              </div>
            )}

            {controller.enabledGroups.optics_pbr && (
              <div className="rounded-xl bg-[#090a0d] border border-white/10 p-4 space-y-3">
                <div className="text-xs font-semibold text-[#e8ca64]">
                  Zestaw: Optyka, Głębia 3D i Materiały PBR
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#c5bfb3]">Głębia optyczna 3D</span>
                      <span className="font-mono-tabular text-[#d4af37]">
                        {settings.depthIntensity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={settings.depthIntensity}
                      onChange={(e) =>
                        onApplySettings({ depthIntensity: Number(e.target.value) })
                      }
                      className="studio-slider w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#c5bfb3]">Fotorealizm PBR</span>
                      <span className="font-mono-tabular text-[#d4af37]">
                        {settings.photorealism}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={settings.photorealism}
                      onChange={(e) =>
                        onApplySettings({ photorealism: Number(e.target.value) })
                      }
                      className="studio-slider w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#c5bfb3]">Rozmycie DOF</span>
                      <span className="font-mono-tabular text-[#d4af37]">
                        {settings.blurIntensity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={settings.blurIntensity}
                      onChange={(e) =>
                        onApplySettings({ blurIntensity: Number(e.target.value) })
                      }
                      className="studio-slider w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#c5bfb3]">Winieta optyczna</span>
                      <span className="font-mono-tabular text-[#d4af37]">
                        {settings.vignetteIntensity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={settings.vignetteIntensity}
                      onChange={(e) =>
                        onApplySettings({ vignetteIntensity: Number(e.target.value) })
                      }
                      className="studio-slider w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            {controller.enabledGroups.color_lut && (
              <div className="rounded-xl bg-[#090a0d] border border-white/10 p-4 space-y-3">
                <div className="text-xs font-semibold text-[#e8ca64]">
                  Zestaw: Korekcja Kolorów LUT i Faktura 35mm
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {VISUAL_FX_PRESETS.map((fx) => (
                    <button
                      key={fx.id}
                      type="button"
                      onClick={() => onApplySettings(fx.settings)}
                      className={`min-h-[34px] px-2.5 py-1 rounded-md text-[11px] cursor-pointer ${
                        settings.activeFxPreset === fx.id
                          ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                          : 'bg-[#141720] text-[#b8b2a6] border border-white/8'
                      }`}
                    >
                      {fx.name}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#c5bfb3]">Korekcja kolorów LUT</span>
                      <span className="font-mono-tabular text-[#d4af37]">
                        {settings.colorGrading}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={settings.colorGrading}
                      onChange={(e) =>
                        onApplySettings({ colorGrading: Number(e.target.value) })
                      }
                      className="studio-slider w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#c5bfb3]">Ziarno filmowe 35mm</span>
                      <span className="font-mono-tabular text-[#d4af37]">
                        {settings.filmGrain}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={settings.filmGrain}
                      onChange={(e) => onApplySettings({ filmGrain: Number(e.target.value) })}
                      className="studio-slider w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            {controller.enabledGroups.mobile_framing && (
              <div className="rounded-xl bg-[#090a0d] border border-white/10 p-4 space-y-3">
                <div className="text-xs font-semibold text-[#e8ca64]">
                  Zestaw: Ekspozycja Mobilna i Warstwa Narracji
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeController({
                        ...controller,
                        mobileSafeZonesVisible: !controller.mobileSafeZonesVisible,
                      })
                    }
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                      controller.mobileSafeZonesVisible
                        ? 'bg-[#d4af37] text-[#090a0d] border-[#d4af37] font-semibold'
                        : 'bg-[#141720] text-[#b8b2a6] border-white/12'
                    }`}
                  >
                    Strefy bezpieczne telefonu:{' '}
                    {controller.mobileSafeZonesVisible ? 'WŁ.' : 'WYŁ.'}
                  </button>

                  <button
                    type="button"
                    onClick={onToggleStoryOverlay}
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                      showStoryOverlay
                        ? 'bg-white/15 text-white border-white/30 font-semibold'
                        : 'bg-[#141720] text-[#b8b2a6] border-white/12'
                    }`}
                  >
                    Warstwa narracji na ekranie: {showStoryOverlay ? 'WŁ.' : 'WYŁ.'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 3: STANDARDIZED MULTI-APP CONNECTOR (USCP-1.0) */}
      <div className="rounded-2xl bg-[#12151e] border border-white/10 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">
              04. Wspólne, Wystandaryzowane Złącze Wielu Aplikacji (USCP-1.0 Adapter)
            </h3>
            <p className="text-xs text-[#9e988c]">
              Jedno wspólne złącze przez <code className="text-[#d4af37]">/ws/uscp</code>,{' '}
              <code className="text-[#d4af37]">BroadcastChannel</code> oraz{' '}
              <code className="text-[#d4af37]">postMessage</code> — skopiuj gotowy adapter TypeScript i wklej do swoich pozostałych aplikacji.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                copyWithFeedback('packet_json', JSON.stringify(livePacket, null, 2))
              }
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs text-white cursor-pointer"
            >
              {copiedKey === 'packet_json' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-[#d4af37]" />
              )}
              <span>
                {copiedKey === 'packet_json' ? 'Skopiowano JSON!' : 'Kopiuj pakiet JSON'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowImportBox((v) => !v)}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181c26] hover:bg-[#232938] border border-white/12 text-xs text-white cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Wczytaj pakiet z innej aplikacji</span>
            </button>

            <button
              type="button"
              onClick={() => copyWithFeedback('sdk_code', UNIVERSAL_CONNECTOR_SDK_SNIPPET)}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] cursor-pointer"
            >
              {copiedKey === 'sdk_code' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Code2 className="w-3.5 h-3.5" />
              )}
              <span>
                {copiedKey === 'sdk_code'
                  ? 'Skopiowano adapter .TS!'
                  : 'Kopiuj kod wspólnego Złącza (.ts)'}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] text-[#b8b2a6] mb-1">
              Identyfikator węzła sterownika (Connector ID):
            </label>
            <input
              type="text"
              value={controller.connectorId}
              onChange={(e) =>
                onChangeController({ ...controller, connectorId: e.target.value })
              }
              className="w-full min-h-[40px] rounded-lg bg-[#090a0d] border border-white/12 px-3 py-1.5 text-xs font-mono-tabular text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#b8b2a6] mb-1">
              Przestrzeń nazw aplikacji (App Namespace):
            </label>
            <input
              type="text"
              value={controller.appNamespace}
              onChange={(e) =>
                onChangeController({ ...controller, appNamespace: e.target.value })
              }
              className="w-full min-h-[40px] rounded-lg bg-[#090a0d] border border-white/12 px-3 py-1.5 text-xs font-mono-tabular text-white"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() =>
                onChangeController({
                  ...controller,
                  autoBroadcastPostMessage: !controller.autoBroadcastPostMessage,
                })
              }
              className={`w-full min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                controller.autoBroadcastPostMessage
                  ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                  : 'bg-[#090a0d] border-white/12 text-[#9e988c]'
              }`}
            >
              Auto-rozgłaszanie USCP-1.0:{' '}
              {controller.autoBroadcastPostMessage ? 'AKTYWNE' : 'WSTRZYMANE'}
            </button>
          </div>
        </div>

        {showImportBox && (
          <div className="rounded-xl bg-[#090a0d] border border-[#d4af37]/40 p-3.5 space-y-2.5">
            <div className="text-xs font-semibold text-white">
              Wklej pakiet JSON zgodny ze standardem USCP-1.0 z innej swojej aplikacji:
            </div>
            <textarea
              rows={4}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='{"protocol": "USCP-1.0", "enabledSwitchGroups": {"lighting": true}}'
              className="w-full rounded-lg bg-[#11141d] border border-white/12 p-2.5 text-xs font-mono-tabular text-[#e5dec9] focus:outline-none focus:border-[#d4af37]"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleApplyImportedJson}
                className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#d4af37] text-[#090a0d] text-xs font-semibold cursor-pointer"
              >
                Zastosuj pakiet w sterowniku
              </button>
              {importFeedback && (
                <span className="text-xs text-[#e8ca64]">{importFeedback}</span>
              )}
            </div>
          </div>
        )}

        <pre className="rounded-xl bg-[#090a0d] border border-white/10 p-3.5 text-[11px] font-mono-tabular text-[#d4af37] overflow-x-auto max-h-44">
          {JSON.stringify(livePacket, null, 2)}
        </pre>
      </div>
    </div>
  );
};
