import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CameraBlockingConfig,
  CameraControllerFunctionId,
  ElementFocusPresetId,
  LiveCameraControlSource,
  LiveCameraRigState,
  SolvedAirPose,
  SpatialAnchorNode,
  SpatialAxisConfig,
  SpatialAxisKey,
  SpatialControllerModel,
  SpatialResponseCurve,
  SwitchGroupId,
  UniversalControllerConfig,
  UscpDeviceRoleMode,
  UscpRemoteActionType,
  VisualEffectSettings,
} from '../types/studio';

export const CAMERA_CONTROLLER_FUNCTIONS: Array<{
  id: CameraControllerFunctionId;
  shortTitle: string;
  title: string;
  description: string;
  mappedPreset: ElementFocusPresetId;
  axesHint: string;
}> = [
  {
    id: 'camera_aim_vr',
    shortTitle: 'Obrót i Celowanie VR',
    title: 'Sterowanie Obrotem Kamery (YAW / PITCH / ROLL)',
    description:
      'Telefon lub tarcza gimbal działa jak żyroskopowa głowica VR — obraca kierunek kadrowania kamery.',
    mappedPreset: 'focus_camera_path',
    axesHint: 'YAW · PITCH · ROLL',
  },
  {
    id: 'camera_dolly_track',
    shortTitle: 'Wózek DOLLY & PAN',
    title: 'Przesuw i Najazd Kamery po Scenie (DOLLY Z / PAN X)',
    description:
      'Zamienia sterownik w duży gładzik wózka filmowego do najazdu w głąb i przesuwu na boki.',
    mappedPreset: 'focus_camera_path',
    axesHint: 'DOLLY Z · PAN X · Y',
  },
  {
    id: 'camera_lens_focus',
    shortTitle: 'Optyka i ZOOM',
    title: 'Zoom Optyczny, Ogniskowa i Głębia Ostrości (FOV / DOF)',
    description:
      'Precyzyjne potencjometry do zmiany kąta widzenia (18–85mm), rozmycia tła DOF oraz winiety.',
    mappedPreset: 'focus_optics',
    axesHint: 'ZOOM FOV · DOF · PBR',
  },
  {
    id: 'camera_path_scrub',
    shortTitle: 'Ścieżka 3D + Rzut',
    title: 'Przejazd po Ścieżce A → B i Wyzwolenie Kadru / Rzutu',
    description:
      'Płynne przejście między klatką startową a docelową, regulacja wygładzania oraz szybki rzut WebP/4 Kadry.',
    mappedPreset: 'focus_camera_path',
    axesHint: 'Ścieżka A→B · Smoothing · Rzut',
  },
  {
    id: 'camera_air_6dof',
    shortTitle: 'Ruch w Powietrzu 6DoF',
    title: 'Sterownik w Przestrzeni (Kotwice A1–A4 + Ruch w Powietrzu)',
    description:
      'Steruje pozycją (X, Y, Z) oraz obrotem wirtualnej kamery ruchem dłoni w powietrzu na podstawie kotwic przestrzennych.',
    mappedPreset: 'focus_camera_path',
    axesHint: 'X·Y·Z w Powietrzu + Y·P·R',
  },
  {
    id: 'camera_full_rig',
    shortTitle: 'Pełna Konsola Kamery',
    title: 'Pełny Panel Reżyserski (Wszystkie Osie i Zestawy)',
    description:
      'Odsłania jednocześnie wszystkie 6 potencjometrów osiowych, filtry światła, LUT i opcje mobilne.',
    mappedPreset: 'all_enabled',
    axesHint: 'Wszystkie 6 osi + FX',
  },
];

export const SWITCH_GROUP_DEFINITIONS: {
  id: SwitchGroupId;
  label: string;
  shortLabel: string;
  targetElementDesc: string;
  includedSwitches: string[];
}[] = [
  {
    id: 'camera_path_3d',
    label: 'Ścieżka Kamery 3D (Stan A → B)',
    shortLabel: 'Ścieżka 3D',
    targetElementDesc:
      'Praca wyłącznie nad trajektorią ruchu kamery, wygładzaniem (Smoothing), łukiem M i ogniskową.',
    includedSwitches: [
      'Linia ścieżki 3D na ekranie',
      'Współczynnik wygładzania (Smoothing)',
      'Łuk poziomy ścieżki (M)',
      'Ryglowanie celu kadrowania 3D',
    ],
  },
  {
    id: 'lighting',
    label: 'Oświetlenie Okien i Złota Godzina',
    shortLabel: 'Oświetlenie',
    targetElementDesc:
      'Izoluje przełączniki odpowiedzialne wyłącznie za światło dzienne zza fasady i ciepło opraw LED.',
    includedSwitches: [
      'Światło w oknach',
      'Złota godzina LED',
      'Bryły oświetlenia 3D',
    ],
  },
  {
    id: 'optics_pbr',
    label: 'Optyka, Głębia 3D i Materiały PBR',
    shortLabel: 'Optyka i PBR',
    targetElementDesc:
      'Skupia pracę na plastyce obiektywu, rozmyciu ostrości (DOF), winietowaniu i odbiciach w marmurze.',
    includedSwitches: [
      'Głębia optyczna 3D',
      'Fotorealizm PBR',
      'Rozmycie ostrości (DOF)',
      'Winieta optyczna',
    ],
  },
  {
    id: 'color_lut',
    label: 'Korekcja Kolorów LUT i Faktura 35mm',
    shortLabel: 'Kolor i Ziarno',
    targetElementDesc:
      'Włącza wyłącznie zestaw przełączników gradingu kolorystycznego i organicznego ziarna filmowego.',
    includedSwitches: [
      'Profil optyczny FX',
      'Korekcja kolorów (LUT)',
      'Ziarno filmowe 35mm',
    ],
  },
  {
    id: 'mobile_framing',
    label: 'Ekspozycja Mobilna i Warstwa Narracji',
    shortLabel: 'Mobile & Story',
    targetElementDesc:
      'Zestaw przełączników do przygotowania grafik pionowych 9:16 / 4:5 na smartfony i podpisów historii.',
    includedSwitches: [
      'Strefy bezpieczne ekranu telefonu',
      'Warstwa narracji na widoku głównym',
      'Szybki generator grafik mobilnych',
    ],
  },
];

export const ELEMENT_FOCUS_PRESETS: {
  id: ElementFocusPresetId;
  title: string;
  subtitle: string;
  enabledGroups: Record<SwitchGroupId, boolean>;
}[] = [
  {
    id: 'all_enabled',
    title: 'Pełna Konsola Studyjna (Wszystkie zestawy)',
    subtitle: 'Wszystkie grupy przełączników aktywne jednocześnie.',
    enabledGroups: {
      camera_path_3d: true,
      lighting: true,
      optics_pbr: true,
      color_lut: true,
      mobile_framing: true,
    },
  },
  {
    id: 'focus_camera_path',
    title: 'Tylko Element: Ruch i Ścieżka Kamery 3D',
    subtitle: 'Ukrywa suwaki barwne; zostawia wyłącznie sterowanie ścieżką A→B i wygładzaniem.',
    enabledGroups: {
      camera_path_3d: true,
      lighting: false,
      optics_pbr: false,
      color_lut: false,
      mobile_framing: false,
    },
  },
  {
    id: 'focus_lighting',
    title: 'Tylko Element: Światło Dzienne i Oprawy LED',
    subtitle: 'Izoluje parametry ekspozycji okiennej i temperatury złotej godziny.',
    enabledGroups: {
      camera_path_3d: false,
      lighting: true,
      optics_pbr: false,
      color_lut: false,
      mobile_framing: false,
    },
  },
  {
    id: 'focus_optics',
    title: 'Tylko Element: Optyka Obiektywu i Marmur PBR',
    subtitle: 'Aktywuje jedynie głębię 3D, połysk materiałów PBR, rozmycie DOF i winietę.',
    enabledGroups: {
      camera_path_3d: false,
      lighting: false,
      optics_pbr: true,
      color_lut: false,
      mobile_framing: false,
    },
  },
  {
    id: 'focus_color',
    title: 'Tylko Element: Grading Barwny i Ziarno 35mm',
    subtitle: 'Pozwala precyzyjnie dopracować wyłącznie LUT kolorystyczny i fakturę kliszy.',
    enabledGroups: {
      camera_path_3d: false,
      lighting: false,
      optics_pbr: false,
      color_lut: true,
      mobile_framing: false,
    },
  },
  {
    id: 'focus_mobile',
    title: 'Tylko Element: Grafiki na Telefon (Mobile 9:16)',
    subtitle: 'Włącza przełączniki stref bezpiecznych ekranu mobilnego i narracji.',
    enabledGroups: {
      camera_path_3d: false,
      lighting: false,
      optics_pbr: false,
      color_lut: false,
      mobile_framing: true,
    },
  },
];

export interface UscpPeerInfo {
  clientId: string;
  role: 'host' | 'tablet' | 'app';
  appNamespace: string;
}

export interface UscpRemoteSceneSummary {
  id: string;
  title: string;
  subtitle: string;
  previewThumb?: string;
}

export interface StandardUniversalConnectorPacket {
  protocol: 'USCP-1.0';
  sessionId: string;
  senderId: string;
  seq: number;
  connectorId: string;
  appNamespace: string;
  timestamp: string;
  activeFocusPreset: ElementFocusPresetId;
  activeCameraFunction?: CameraControllerFunctionId;
  enabledSwitchGroups: Record<SwitchGroupId, boolean>;
  switches: {
    show3DPathOnMainViewport: boolean;
    mobileSafeZonesVisible: boolean;
    showStoryOverlay: boolean;
    show3DProps: boolean;
    lockFramingToTarget: boolean;
    liveCameraControlEnabled?: boolean;
    [customSwitch: string]: boolean | undefined;
  };
  values: Partial<VisualEffectSettings> & {
    smoothingFactor?: number;
    curveArcOffset?: number;
    focalLengthMm?: number;
    endFocalLengthMm?: number;
    camYawDeg?: number;
    camPitchDeg?: number;
    camRollDeg?: number;
    camDollyZ?: number;
    camPanX?: number;
    camFovOffset?: number;
    camAirX?: number;
    camAirY?: number;
    camAirZ?: number;
    camVrSensitivity?: number;
    camInvertAxes?: boolean;
    camSource?: LiveCameraControlSource;
    activeCameraFunction?: CameraControllerFunctionId;
    [customValue: string]: number | string | boolean | undefined;
  };
  customChannels?: Record<string, Record<string, unknown>>;
}

export const DEFAULT_CAMERA_3D_SPATIAL_MODEL: SpatialControllerModel = {
  id: 'spatial_cam_3d_default',
  name: 'Model Sterownika Kamery 3D & VR',
  domainProfile: 'camera_3d',
  calibratedAt: new Date().toISOString(),
  zeroAlpha: 0,
  zeroBeta: 0,
  zeroGamma: 0,
  noiseFloorDeg: 0.6,
  deadzoneDeg: 1.5,
  maxTiltDeg: 34,
  sensitivityMultiplier: 1.0,
  smoothingAlpha: 0.45,
  responseCurve: 'precision_cubic',
  axes: {
    yawDeg: {
      key: 'yawDeg',
      enabled: true,
      label: 'Obrót YAW (Poziom)',
      unit: '°',
      min: -45,
      max: 45,
      step: 1,
      invert: false,
    },
    pitchDeg: {
      key: 'pitchDeg',
      enabled: true,
      label: 'Pochył PITCH (Pion)',
      unit: '°',
      min: -30,
      max: 30,
      step: 1,
      invert: false,
    },
    rollDeg: {
      key: 'rollDeg',
      enabled: true,
      label: 'Przechył ROLL (Oś Z)',
      unit: '°',
      min: -25,
      max: 25,
      step: 1,
      invert: false,
    },
    dollyZ: {
      key: 'dollyZ',
      enabled: true,
      label: 'Wózek DOLLY Z (Głębia)',
      unit: 'm',
      min: -1.8,
      max: 1.8,
      step: 0.05,
      invert: false,
    },
    panX: {
      key: 'panX',
      enabled: true,
      label: 'Przesuw PAN X (Bok)',
      unit: 'm',
      min: -1.8,
      max: 1.8,
      step: 0.05,
      invert: false,
    },
    fovOffset: {
      key: 'fovOffset',
      enabled: true,
      label: 'Ogniskowa ZOOM',
      unit: '°',
      min: -12,
      max: 14,
      step: 0.5,
      invert: false,
    },
  },
};

export const MEDICAL_TISSUE_VOLUME_SPATIAL_MODEL: SpatialControllerModel = {
  id: 'spatial_med_tissue_vol_v1',
  name: 'Sonda Wolumetryczna Tkanek (Diagnostyka ΔV)',
  domainProfile: 'medical_tissue_volume',
  calibratedAt: new Date().toISOString(),
  zeroAlpha: 0,
  zeroBeta: 0,
  zeroGamma: 0,
  noiseFloorDeg: 0.4,
  deadzoneDeg: 2.2,
  maxTiltDeg: 24,
  sensitivityMultiplier: 1.4,
  smoothingAlpha: 0.28,
  responseCurve: 'logarithmic_medical',
  axes: {
    yawDeg: {
      key: 'yawDeg',
      enabled: true,
      label: 'Kąt Skanu Obwodowego (Yaw)',
      unit: '°',
      min: -45,
      max: 45,
      step: 1,
      invert: false,
    },
    pitchDeg: {
      key: 'pitchDeg',
      enabled: true,
      label: 'Pochył Sondy Względem Tkanki',
      unit: '°',
      min: -30,
      max: 30,
      step: 1,
      invert: false,
    },
    rollDeg: {
      key: 'rollDeg',
      enabled: true,
      label: 'Stabilizacja Płaszczyzny (Roll)',
      unit: '°',
      min: -25,
      max: 25,
      step: 1,
      invert: false,
    },
    dollyZ: {
      key: 'dollyZ',
      enabled: true,
      label: 'Głębokość Przekroju (mm/Z)',
      unit: 'm',
      min: -1.8,
      max: 1.8,
      step: 0.05,
      invert: false,
    },
    panX: {
      key: 'panX',
      enabled: true,
      label: 'Przesuw Obszaru Zmiany (X)',
      unit: 'm',
      min: -1.8,
      max: 1.8,
      step: 0.05,
      invert: false,
    },
    fovOffset: {
      key: 'fovOffset',
      enabled: true,
      label: 'Czułość Detekcji Obrzęku ΔV',
      unit: '°',
      min: -12,
      max: 14,
      step: 0.5,
      invert: false,
    },
  },
};

/**
 * Evaluates a calibrated SpatialControllerModel transfer curve from raw device tilt angle (deg)
 * into a filtered normalized output (-1..+1) or scaled physical span.
 */
export function applySpatialTransferCurve(
  rawDeltaDeg: number,
  model: SpatialControllerModel,
  maxOutputAbs = 1
): number {
  const sign = rawDeltaDeg < 0 ? -1 : 1;
  const absDelta = Math.abs(rawDeltaDeg);
  if (absDelta <= model.deadzoneDeg) return 0;

  const effectiveSpan = Math.max(4, model.maxTiltDeg - model.deadzoneDeg);
  const rawRatio = Math.min(1.25, ((absDelta - model.deadzoneDeg) / effectiveSpan) * model.sensitivityMultiplier);
  const clamped = Math.max(0, Math.min(1, rawRatio));

  let shaped = clamped;
  if (model.responseCurve === 'precision_cubic') {
    shaped = clamped * 0.45 + Math.pow(clamped, 2.2) * 0.55;
  } else if (model.responseCurve === 'logarithmic_medical') {
    // High micro-precision near center for subtle pathology boundaries, smooth saturation near limit
    shaped = Math.log1p(clamped * 3.5) / Math.log1p(3.5);
    shaped = clamped * 0.25 + shaped * 0.75;
  }

  return sign * shaped * maxOutputAbs;
}

export const DEFAULT_LIVE_CAMERA_RIG: LiveCameraRigState = {
  enabled: false,
  source: 'idle',
  yawDeg: 0,
  pitchDeg: 0,
  rollDeg: 0,
  dollyZ: 0,
  panX: 0,
  fovOffset: 0,
  vrSensitivity: 1.0,
  invertAxes: false,
  airX: 0,
  airY: 0,
  airZ: 0,
};

export const DEFAULT_SPATIAL_ANCHORS: SpatialAnchorNode[] = [
  {
    id: 'ANCHOR-FL',
    label: 'Kotwica Lewy Przód',
    positionMeters: { x: -2.2, y: 1.35, z: 2.4 },
    measuredDistMeters: 3.1,
    signalQuality: 96,
    connected: true,
    sensorTech: 'uwb_ble',
    lastSeenAt: Date.now(),
  },
  {
    id: 'ANCHOR-FR',
    label: 'Kotwica Prawy Przód',
    positionMeters: { x: 2.2, y: 1.35, z: 2.4 },
    measuredDistMeters: 3.1,
    signalQuality: 95,
    connected: true,
    sensorTech: 'uwb_ble',
    lastSeenAt: Date.now(),
  },
  {
    id: 'ANCHOR-CEIL',
    label: 'Kotwica Sufitowa (Góra)',
    positionMeters: { x: 0, y: 2.75, z: 0.2 },
    measuredDistMeters: 1.45,
    signalQuality: 98,
    connected: true,
    sensorTech: 'optical_apriltag',
    lastSeenAt: Date.now(),
  },
  {
    id: 'ANCHOR-REAR',
    label: 'Kotwica Tylna (Baza)',
    positionMeters: { x: 0, y: 1.4, z: -2.4 },
    measuredDistMeters: 2.75,
    signalQuality: 92,
    connected: true,
    sensorTech: 'uwb_ble',
    lastSeenAt: Date.now(),
  },
];

export const DEFAULT_SOLVED_AIR_POSE: SolvedAirPose = {
  x: 0,
  y: 1.4,
  z: 0.35,
  confidencePct: 96,
  pdop: 1.38,
  activeAnchorCount: 4,
  updatedAt: Date.now(),
};

function resolveInitialSessionId(): string {
  if (typeof window === 'undefined') return 'BUJOK-STUDIO';
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const fromQuery = urlParams.get('session');
    if (fromQuery) {
      const cleaned = fromQuery.trim().toUpperCase().slice(0, 24);
      window.localStorage.setItem('uscp_session_id', cleaned);
      return cleaned;
    }
    const saved = window.localStorage.getItem('uscp_session_id');
    if (saved) return saved;
  } catch {
    // ignore storage errors
  }
  return 'BUJOK-STUDIO';
}

function resolveInitialSessionToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const fromQuery = urlParams.get('token') || urlParams.get('pin');
    if (fromQuery) {
      const cleaned = fromQuery.trim().slice(0, 64);
      window.localStorage.setItem('uscp_session_token', cleaned);
      return cleaned;
    }
    return window.localStorage.getItem('uscp_session_token') || '';
  } catch {
    return '';
  }
}

function resolveInitialDeviceRoleMode(): UscpDeviceRoleMode {
  if (typeof window === 'undefined') return 'camera_console';
  const r = new URLSearchParams(window.location.search).get('deviceRole');
  if (r === 'spatial_anchor' || r === 'air_wand' || r === 'camera_console') return r;
  return 'camera_console';
}

function resolveInitialAnchorId(): string {
  if (typeof window === 'undefined') return 'ANCHOR-FL';
  return (
    new URLSearchParams(window.location.search).get('anchorId') || 'ANCHOR-FL'
  ).slice(0, 24);
}

export const DEFAULT_UNIVERSAL_CONTROLLER_CONFIG: UniversalControllerConfig = {
  sessionId: resolveInitialSessionId(),
  sessionToken: resolveInitialSessionToken(),
  connectorId: 'bujok-studio-node-01',
  appNamespace: 'bujok.medical.studio',
  protocolVersion: 'USCP-1.0',
  activeFocusPreset: 'all_enabled',
  activeCameraFunction: 'camera_aim_vr',
  deviceRoleMode: resolveInitialDeviceRoleMode(),
  activeAnchorId: resolveInitialAnchorId(),
  enabledGroups: {
    camera_path_3d: true,
    lighting: true,
    optics_pbr: true,
    color_lut: true,
    mobile_framing: true,
  },
  show3DPathOnMainViewport: true,
  mobileSafeZonesVisible: true,
  autoBroadcastPostMessage: true,
  spatialModel: DEFAULT_CAMERA_3D_SPATIAL_MODEL,
  spatialAnchors: DEFAULT_SPATIAL_ANCHORS,
  solvedAirPose: DEFAULT_SOLVED_AIR_POSE,
};

let localSeqCounter = 0;

export function buildStandardConnectorPacket(
  controller: UniversalControllerConfig,
  settings: VisualEffectSettings,
  cameraBlocking: CameraBlockingConfig,
  showStoryOverlay: boolean,
  senderId = 'local-node',
  liveCameraRig?: LiveCameraRigState
): StandardUniversalConnectorPacket {
  localSeqCounter += 1;
  const g = controller.enabledGroups;
  const values: StandardUniversalConnectorPacket['values'] = {};

  if (g.lighting) {
    values.windowLightIntensity = settings.windowLightIntensity;
    values.warmGlow = settings.warmGlow;
  }
  if (g.optics_pbr) {
    values.depthIntensity = settings.depthIntensity;
    values.photorealism = settings.photorealism;
    values.blurIntensity = settings.blurIntensity;
    values.vignetteIntensity = settings.vignetteIntensity;
  }
  if (g.color_lut) {
    values.activeFxPreset = settings.activeFxPreset;
    values.colorGrading = settings.colorGrading;
    values.filmGrain = settings.filmGrain;
  }
  if (g.camera_path_3d) {
    values.smoothingFactor =
      cameraBlocking.smoothingFactor ??
      (cameraBlocking.easingStyle === 'linear_constant' ? 0 : 65);
    values.curveArcOffset = cameraBlocking.curveArcOffset;
    values.focalLengthMm = cameraBlocking.focalLengthMm;
    values.endFocalLengthMm =
      cameraBlocking.endFocalLengthMm ?? cameraBlocking.focalLengthMm;
  }

  if (liveCameraRig) {
    values.camYawDeg = Number(liveCameraRig.yawDeg.toFixed(2));
    values.camPitchDeg = Number(liveCameraRig.pitchDeg.toFixed(2));
    values.camRollDeg = Number(liveCameraRig.rollDeg.toFixed(2));
    values.camDollyZ = Number(liveCameraRig.dollyZ.toFixed(3));
    values.camPanX = Number(liveCameraRig.panX.toFixed(3));
    values.camFovOffset = Number(liveCameraRig.fovOffset.toFixed(2));
    if (typeof liveCameraRig.airX === 'number') {
      values.camAirX = Number(liveCameraRig.airX.toFixed(3));
    }
    if (typeof liveCameraRig.airY === 'number') {
      values.camAirY = Number(liveCameraRig.airY.toFixed(3));
    }
    if (typeof liveCameraRig.airZ === 'number') {
      values.camAirZ = Number(liveCameraRig.airZ.toFixed(3));
    }
    values.camVrSensitivity = Number(liveCameraRig.vrSensitivity.toFixed(2));
    values.camInvertAxes = liveCameraRig.invertAxes;
    values.camSource = liveCameraRig.source;
  }

  values.activeCameraFunction = controller.activeCameraFunction;

  return {
    protocol: 'USCP-1.0',
    sessionId: controller.sessionId || 'BUJOK-STUDIO',
    senderId,
    seq: localSeqCounter,
    connectorId: controller.connectorId,
    appNamespace: controller.appNamespace,
    timestamp: new Date().toISOString(),
    activeFocusPreset: controller.activeFocusPreset,
    activeCameraFunction: controller.activeCameraFunction,
    enabledSwitchGroups: { ...controller.enabledGroups },
    switches: {
      show3DPathOnMainViewport: controller.show3DPathOnMainViewport,
      mobileSafeZonesVisible: controller.mobileSafeZonesVisible,
      showStoryOverlay,
      show3DProps: settings.show3DProps,
      lockFramingToTarget: cameraBlocking.lockFramingToTarget,
      liveCameraControlEnabled: Boolean(liveCameraRig?.enabled),
    },
    values,
    ...(controller.spatialModel
      ? {
          customChannels: {
            spatialModel: controller.spatialModel as unknown as Record<string, unknown>,
          },
        }
      : {}),
  };
}

export function broadcastUniversalConnectorPacket(
  packet: StandardUniversalConnectorPacket
): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('uscp:state-sync', {
        detail: packet,
      })
    );
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'USCP_CONNECTOR_SYNC_V1',
          payload: packet,
        },
        '*'
      );
    }
  } catch {
    // Ignore cross-origin frame restrictions
  }
}

export interface UscpSecurityStatus {
  tlsEncrypted: boolean;
  tokenAuthenticated: boolean;
  hmacVerified: boolean;
  rateLimitProtected: boolean;
}

export interface UniversalConnectorBridgeState {
  clientId: string;
  sessionToken: string;
  pinCode: string;
  connectionStatus: 'connecting' | 'connected' | 'local_only';
  peers: UscpPeerInfo[];
  remoteScenes: UscpRemoteSceneSummary[];
  remoteActiveSceneId: string;
  spatialAnchors: SpatialAnchorNode[];
  solvedAirPose: SolvedAirPose;
  lastSyncAt: string | null;
  latencyMs: number | null;
  authRequired: boolean;
  authError: string | null;
  securityStatus: UscpSecurityStatus;
  sendRemoteAction: (action: UscpRemoteActionType, payload?: any) => void;
  publishSceneCatalog: (
    catalog: UscpRemoteSceneSummary[],
    activeSceneId: string
  ) => void;
  registerSpatialAnchor: (anchor: SpatialAnchorNode) => void;
  sendRangingSample: (
    samples: Array<{ anchorId: string; distanceMeters: number; signalQuality?: number }>
  ) => void;
  sendAirPose: (pose: { x: number; y: number; z: number }) => void;
  forceSyncNow: () => void;
  rotateSecureSession: () => Promise<void>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  pingServerNow: () => void;
}

/**
 * Multi-transport Standardized Connector Bridge (`USCP-1.0`):
 * Synchronizes Host Desktop, Second-Screen Tablet Companion, Same-Machine Dual Monitors (`BroadcastChannel`),
 * and External Applications (`WebSocket /ws/uscp`, `postMessage`, `window.UniversalAppConnector`) in real time.
 */
export function useUniversalConnectorBridge(params: {
  role: 'host' | 'tablet' | 'app';
  controller: UniversalControllerConfig;
  settings: VisualEffectSettings;
  cameraBlocking: CameraBlockingConfig;
  liveCameraRig?: LiveCameraRigState;
  showStoryOverlay: boolean;
  onUpdateController: (next: UniversalControllerConfig) => void;
  onApplySettings: (partial: Partial<VisualEffectSettings>) => void;
  onChangeCameraBlocking: (next: CameraBlockingConfig) => void;
  onChangeLiveCameraRig?: (next: LiveCameraRigState) => void;
  onSetShowStoryOverlay: (vis: boolean) => void;
  onRemoteAction?: (action: UscpRemoteActionType, payload?: any) => void;
}): UniversalConnectorBridgeState {
  const {
    role,
    controller,
    settings,
    cameraBlocking,
    liveCameraRig,
    showStoryOverlay,
    onUpdateController,
    onApplySettings,
    onChangeCameraBlocking,
    onChangeLiveCameraRig,
    onSetShowStoryOverlay,
    onRemoteAction,
  } = params;

  const clientIdRef = useRef<string>(
    `${role}_${Math.random().toString(36).slice(2, 9)}`
  );
  const wsRef = useRef<WebSocket | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const isRemoteApplyingRef = useRef<boolean>(false);
  const emitTimerRef = useRef<number>(0);

  const [sessionToken, setSessionToken] = useState<string>(
    () => controller.sessionToken || resolveInitialSessionToken()
  );
  const [pinCode, setPinCode] = useState<string>('');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [authRequired, setAuthRequired] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [securityStatus, setSecurityStatus] = useState<UscpSecurityStatus>(() => ({
    tlsEncrypted: typeof window !== 'undefined' && window.location.protocol === 'https:',
    tokenAuthenticated: Boolean(controller.sessionToken || resolveInitialSessionToken()),
    hmacVerified: false,
    rateLimitProtected: true,
  }));
  const sessionTokenRef = useRef<string>(sessionToken);
  sessionTokenRef.current = sessionToken;

  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'local_only'
  >('connecting');
  const [peers, setPeers] = useState<UscpPeerInfo[]>([]);
  const [remoteScenes, setRemoteScenes] = useState<UscpRemoteSceneSummary[]>([]);
  const [remoteActiveSceneId, setRemoteActiveSceneId] = useState<string>('');
  const [spatialAnchors, setSpatialAnchors] = useState<SpatialAnchorNode[]>(
    () => controller.spatialAnchors || DEFAULT_SPATIAL_ANCHORS
  );
  const [solvedAirPose, setSolvedAirPose] = useState<SolvedAirPose>(
    () => controller.solvedAirPose || DEFAULT_SOLVED_AIR_POSE
  );
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const latestRefs = useRef({
    controller,
    settings,
    cameraBlocking,
    liveCameraRig: liveCameraRig || DEFAULT_LIVE_CAMERA_RIG,
    showStoryOverlay,
    onUpdateController,
    onApplySettings,
    onChangeCameraBlocking,
    onChangeLiveCameraRig,
    onSetShowStoryOverlay,
    onRemoteAction,
  });
  latestRefs.current = {
    controller,
    settings,
    cameraBlocking,
    liveCameraRig: liveCameraRig || DEFAULT_LIVE_CAMERA_RIG,
    showStoryOverlay,
    onUpdateController,
    onApplySettings,
    onChangeCameraBlocking,
    onChangeLiveCameraRig,
    onSetShowStoryOverlay,
    onRemoteAction,
  };

  const applyIncomingPacket = useCallback(
    (incoming: Partial<StandardUniversalConnectorPacket>) => {
      if (!incoming || incoming.protocol !== 'USCP-1.0') return;
      if (incoming.senderId && incoming.senderId === clientIdRef.current) return;

      const cur = latestRefs.current;
      isRemoteApplyingRef.current = true;

      try {
        const incomingSpatial = (incoming.customChannels as any)?.spatialModel as
          | SpatialControllerModel
          | undefined;

        const incomingFunc = (incoming.activeCameraFunction ||
          incoming.values?.activeCameraFunction) as CameraControllerFunctionId | undefined;

        if (
          incoming.enabledSwitchGroups ||
          incoming.switches ||
          incomingSpatial ||
          incomingFunc
        ) {
          cur.onUpdateController({
            ...cur.controller,
            activeFocusPreset:
              incoming.activeFocusPreset || cur.controller.activeFocusPreset,
            ...(incomingFunc ? { activeCameraFunction: incomingFunc } : {}),
            enabledGroups: incoming.enabledSwitchGroups
              ? { ...cur.controller.enabledGroups, ...incoming.enabledSwitchGroups }
              : cur.controller.enabledGroups,
            show3DPathOnMainViewport:
              typeof incoming.switches?.show3DPathOnMainViewport === 'boolean'
                ? incoming.switches.show3DPathOnMainViewport
                : cur.controller.show3DPathOnMainViewport,
            mobileSafeZonesVisible:
              typeof incoming.switches?.mobileSafeZonesVisible === 'boolean'
                ? incoming.switches.mobileSafeZonesVisible
                : cur.controller.mobileSafeZonesVisible,
            ...(incomingSpatial && incomingSpatial.axes
              ? { spatialModel: incomingSpatial }
              : {}),
          });
        }

        if (incoming.switches) {
          if (typeof incoming.switches.showStoryOverlay === 'boolean') {
            cur.onSetShowStoryOverlay(incoming.switches.showStoryOverlay);
          }
          if (typeof incoming.switches.show3DProps === 'boolean') {
            cur.onApplySettings({ show3DProps: incoming.switches.show3DProps });
          }
        }

        if (incoming.values) {
          const {
            smoothingFactor,
            curveArcOffset,
            focalLengthMm,
            endFocalLengthMm,
            ...restValues
          } = incoming.values;

          const fxKeys: Array<keyof VisualEffectSettings> = [
            'depthIntensity',
            'cameraMotion',
            'photorealism',
            'warmGlow',
            'windowLightIntensity',
            'activeFxPreset',
            'blurIntensity',
            'vignetteIntensity',
            'colorGrading',
            'filmGrain',
          ];
          const fxPartial: Partial<VisualEffectSettings> = {};
          for (const k of fxKeys) {
            if (restValues[k] !== undefined) {
              (fxPartial as any)[k] = restValues[k];
            }
          }
          if (Object.keys(fxPartial).length > 0) {
            cur.onApplySettings(fxPartial);
          }

          if (
            smoothingFactor !== undefined ||
            curveArcOffset !== undefined ||
            focalLengthMm !== undefined ||
            endFocalLengthMm !== undefined ||
            incoming.switches?.lockFramingToTarget !== undefined
          ) {
            cur.onChangeCameraBlocking({
              ...cur.cameraBlocking,
              ...(typeof smoothingFactor === 'number' ? { smoothingFactor } : {}),
              ...(typeof curveArcOffset === 'number' ? { curveArcOffset } : {}),
              ...(typeof focalLengthMm === 'number'
                ? { focalLengthMm: focalLengthMm as any }
                : {}),
              ...(typeof endFocalLengthMm === 'number'
                ? { endFocalLengthMm: endFocalLengthMm as any }
                : {}),
              ...(typeof incoming.switches?.lockFramingToTarget === 'boolean'
                ? { lockFramingToTarget: incoming.switches.lockFramingToTarget }
                : {}),
            });
          }

          if (
            cur.onChangeLiveCameraRig &&
            (typeof incoming.switches?.liveCameraControlEnabled === 'boolean' ||
              typeof restValues.camYawDeg === 'number' ||
              typeof restValues.camPitchDeg === 'number' ||
              typeof restValues.camRollDeg === 'number' ||
              typeof restValues.camDollyZ === 'number' ||
              typeof restValues.camPanX === 'number' ||
              typeof restValues.camFovOffset === 'number' ||
              typeof restValues.camAirX === 'number' ||
              typeof restValues.camAirY === 'number' ||
              typeof restValues.camAirZ === 'number')
          ) {
            cur.onChangeLiveCameraRig({
              ...cur.liveCameraRig,
              ...(typeof incoming.switches?.liveCameraControlEnabled === 'boolean'
                ? { enabled: incoming.switches.liveCameraControlEnabled }
                : {}),
              ...(typeof restValues.camSource === 'string'
                ? { source: restValues.camSource as LiveCameraControlSource }
                : {}),
              ...(typeof restValues.camYawDeg === 'number'
                ? { yawDeg: restValues.camYawDeg }
                : {}),
              ...(typeof restValues.camPitchDeg === 'number'
                ? { pitchDeg: restValues.camPitchDeg }
                : {}),
              ...(typeof restValues.camRollDeg === 'number'
                ? { rollDeg: restValues.camRollDeg }
                : {}),
              ...(typeof restValues.camDollyZ === 'number'
                ? { dollyZ: restValues.camDollyZ }
                : {}),
              ...(typeof restValues.camPanX === 'number'
                ? { panX: restValues.camPanX }
                : {}),
              ...(typeof restValues.camFovOffset === 'number'
                ? { fovOffset: restValues.camFovOffset }
                : {}),
              ...(typeof restValues.camAirX === 'number'
                ? { airX: restValues.camAirX }
                : {}),
              ...(typeof restValues.camAirY === 'number'
                ? { airY: restValues.camAirY }
                : {}),
              ...(typeof restValues.camAirZ === 'number'
                ? { airZ: restValues.camAirZ }
                : {}),
              ...(typeof restValues.camVrSensitivity === 'number'
                ? { vrSensitivity: restValues.camVrSensitivity }
                : {}),
              ...(typeof restValues.camInvertAxes === 'boolean'
                ? { invertAxes: restValues.camInvertAxes }
                : {}),
            });
          }
        }

        setLastSyncAt(
          new Date().toLocaleTimeString('pl-PL', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      } finally {
        window.setTimeout(() => {
          isRemoteApplyingRef.current = false;
        }, 20);
      }
    },
    []
  );

  const emitPacketOverTransports = useCallback(
    (packet: StandardUniversalConnectorPacket) => {
      broadcastUniversalConnectorPacket(packet);

      if (bcRef.current) {
        try {
          bcRef.current.postMessage({ type: 'uscp:packet', payload: packet });
        } catch {
          // ignore closed channel
        }
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'uscp:packet', payload: packet }));
      } else if (sessionTokenRef.current) {
        // Fallback authenticated REST push if WS is temporarily offline
        fetch(`/api/uscp/sessions/${encodeURIComponent(packet.sessionId)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-USCP-Token': sessionTokenRef.current,
          },
          body: JSON.stringify({
            type: 'uscp:packet',
            payload: packet,
            senderId: clientIdRef.current,
          }),
        }).catch(() => {
          // ignore offline
        });
      }
    },
    []
  );

  // Persist sessionId & sessionToken in localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem('uscp_session_id', controller.sessionId);
      if (sessionToken) {
        window.localStorage.setItem('uscp_session_token', sessionToken);
      }
    } catch {
      // ignore
    }
  }, [controller.sessionId, sessionToken]);

  // Connect BroadcastChannel + Hardened WebSocket (with auto pairing token bootstrap)
  useEffect(() => {
    const sessionId = controller.sessionId || 'BUJOK-STUDIO';
    let destroyed = false;
    let reconnectTimer = 0;

    // 1. Same-origin multi-tab / dual-monitor BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(`uscp-session-${sessionId}`);
      bc.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg) return;
        if (msg.type === 'uscp:packet' && msg.payload) {
          applyIncomingPacket(msg.payload);
        } else if (msg.type === 'uscp:action' && msg.action) {
          if (msg.senderId !== clientIdRef.current) {
            latestRefs.current.onRemoteAction?.(msg.action, msg.payload);
          }
        } else if (msg.type === 'uscp:scenes_update') {
          if (Array.isArray(msg.sceneCatalog)) setRemoteScenes(msg.sceneCatalog);
          if (typeof msg.activeSceneId === 'string')
            setRemoteActiveSceneId(msg.activeSceneId);
        }
      };
      bcRef.current = bc;
    }

    // 2. Cross-device Token-Authenticated WebSocket hub (/ws/uscp)
    const connectWs = async () => {
      if (destroyed) return;
      setConnectionStatus('connecting');

      let activeToken =
        controller.sessionToken || sessionTokenRef.current || resolveInitialSessionToken();

      // Host automatically obtains/verifies session cryptographic pairToken & PIN
      if (role === 'host') {
        try {
          const pairRes = await fetch(
            `/api/uscp/sessions/${encodeURIComponent(sessionId)}/pair`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role: 'host', currentToken: activeToken }),
            }
          );
          if (pairRes.ok) {
            const pairData = await pairRes.json();
            if (pairData.pairToken) {
              activeToken = pairData.pairToken;
              setSessionToken(pairData.pairToken);
              setAuthRequired(false);
              setAuthError(null);
            }
            if (pairData.pinCode) {
              setPinCode(pairData.pinCode);
            }
          }
        } catch {
          // Continue cleanly in local/BroadcastChannel mode
        }
      } else if (!activeToken) {
        setAuthRequired(true);
        setConnectionStatus('local_only');
        return;
      }

      if (destroyed) return;

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws/uscp?session=${encodeURIComponent(
        sessionId
      )}&token=${encodeURIComponent(activeToken)}&role=${encodeURIComponent(
        role
      )}&appNamespace=${encodeURIComponent(
        controller.appNamespace
      )}&clientId=${encodeURIComponent(clientIdRef.current)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (destroyed) {
          ws.close();
          return;
        }
        setConnectionStatus('connected');
        setAuthRequired(false);
        setAuthError(null);
        setSecurityStatus((prev) => ({
          ...prev,
          tokenAuthenticated: Boolean(activeToken),
        }));

        // Trigger initial latency RTT probe
        ws.send(JSON.stringify({ type: 'uscp:ping', clientTs: performance.now() }));

        if (role === 'host') {
          const cur = latestRefs.current;
          const pkt = buildStandardConnectorPacket(
            cur.controller,
            cur.settings,
            cur.cameraBlocking,
            cur.showStoryOverlay,
            clientIdRef.current,
            cur.liveCameraRig
          );
          ws.send(JSON.stringify({ type: 'uscp:packet', payload: pkt }));
        }
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data || '{}'));
          if (msg.type === 'uscp:welcome') {
            if (Array.isArray(msg.peers)) setPeers(msg.peers);
            if (Array.isArray(msg.sceneCatalog)) setRemoteScenes(msg.sceneCatalog);
            if (typeof msg.activeSceneId === 'string')
              setRemoteActiveSceneId(msg.activeSceneId);
            if (Array.isArray(msg.spatialAnchors)) setSpatialAnchors(msg.spatialAnchors);
            if (msg.solvedAirPose) setSolvedAirPose(msg.solvedAirPose);
            if (msg.security) {
              setSecurityStatus((prev) => ({
                ...prev,
                tokenAuthenticated: Boolean(msg.security.tokenProtected),
                hmacVerified: Boolean(msg.security.hmacDigest),
                rateLimitProtected: Boolean(msg.security.rateLimitPerSec),
              }));
            }
            if (role !== 'host' && msg.latestPacket) {
              applyIncomingPacket(msg.latestPacket);
            }
          } else if (msg.type === 'uscp:pong' && typeof msg.clientTs === 'number') {
            const rtt = Math.max(1, Math.round(performance.now() - msg.clientTs));
            setLatencyMs(rtt);
          } else if (msg.type === 'uscp:presence') {
            if (Array.isArray(msg.peers)) setPeers(msg.peers);
          } else if (msg.type === 'uscp:spatial_update') {
            if (Array.isArray(msg.spatialAnchors)) setSpatialAnchors(msg.spatialAnchors);
            if (msg.solvedAirPose) {
              setSolvedAirPose(msg.solvedAirPose);
              const cur = latestRefs.current;
              if (
                cur.onChangeLiveCameraRig &&
                (cur.controller.activeCameraFunction === 'camera_air_6dof' ||
                  cur.liveCameraRig.source === 'air_wand_6dof') &&
                msg.senderId !== clientIdRef.current
              ) {
                cur.onChangeLiveCameraRig({
                  ...cur.liveCameraRig,
                  enabled: true,
                  source: 'air_wand_6dof',
                  airX: msg.solvedAirPose.x,
                  airY: Number((msg.solvedAirPose.y - 1.4).toFixed(3)),
                  airZ: Number((msg.solvedAirPose.z - 0.35).toFixed(3)),
                });
              }
            }
          } else if (msg.type === 'uscp:packet' && msg.payload) {
            if (msg.payload.integrityDigest) {
              setSecurityStatus((prev) => ({ ...prev, hmacVerified: true }));
            }
            applyIncomingPacket(msg.payload);
          } else if (msg.type === 'uscp:scenes_update') {
            if (Array.isArray(msg.sceneCatalog)) setRemoteScenes(msg.sceneCatalog);
            if (typeof msg.activeSceneId === 'string')
              setRemoteActiveSceneId(msg.activeSceneId);
          } else if (msg.type === 'uscp:action' && msg.action) {
            if (msg.senderId !== clientIdRef.current) {
              latestRefs.current.onRemoteAction?.(msg.action, msg.payload);
            }
          }
        } catch {
          // ignore malformed WS message
        }
      };

      ws.onclose = (ev) => {
        if (destroyed) return;
        setConnectionStatus('local_only');
        if (ev.code === 4401) {
          setAuthRequired(true);
          setAuthError('Token sesji wygasł lub jest nieprawidłowy — wpisz 6-znakowy PIN lub zeskanuj nowy kod QR.');
          setSecurityStatus((prev) => ({ ...prev, tokenAuthenticated: false }));
          return;
        }
        reconnectTimer = window.setTimeout(connectWs, 1800);
      };

      ws.onerror = () => {
        setConnectionStatus('local_only');
      };
    };

    void connectWs();

    // 3. Global postMessage & window.UniversalAppConnector for iframes / multi-app containers
    const onWindowMessage = (event: MessageEvent) => {
      if (event.data?.type === 'USCP_CONNECTOR_APPLY_V1' && event.data?.payload) {
        applyIncomingPacket(event.data.payload);
      }
    };
    window.addEventListener('message', onWindowMessage);

    (window as any).UniversalAppConnector = {
      protocol: 'USCP-1.0',
      sessionId,
      role,
      getPacket: () => {
        const cur = latestRefs.current;
        return buildStandardConnectorPacket(
          cur.controller,
          cur.settings,
          cur.cameraBlocking,
          cur.showStoryOverlay,
          clientIdRef.current,
          cur.liveCameraRig
        );
      },
      applyPacket: applyIncomingPacket,
      setPotentiometers: (axes: Partial<LiveCameraRigState>) => {
        const cur = latestRefs.current;
        cur.onChangeLiveCameraRig?.({
          ...cur.liveCameraRig,
          enabled: true,
          source: axes.source || 'potentiometer',
          ...axes,
        });
      },
      enableOnlyGroups: (groups: SwitchGroupId[]) => {
        const cur = latestRefs.current;
        const nextMap: Record<SwitchGroupId, boolean> = {
          camera_path_3d: false,
          lighting: false,
          optics_pbr: false,
          color_lut: false,
          mobile_framing: false,
        };
        groups.forEach((gid) => {
          nextMap[gid] = true;
        });
        cur.onUpdateController({
          ...cur.controller,
          activeFocusPreset: 'custom_selection',
          enabledGroups: nextMap,
        });
      },
    };

    return () => {
      destroyed = true;
      window.clearTimeout(reconnectTimer);
      window.removeEventListener('message', onWindowMessage);
      if (bcRef.current) {
        bcRef.current.close();
        bcRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [controller.sessionId, controller.appNamespace, controller.sessionToken, role, applyIncomingPacket]);

  // Throttled broadcast whenever local state changes (skipped when applying remote delta)
  useEffect(() => {
    if (!controller.autoBroadcastPostMessage) return;
    if (isRemoteApplyingRef.current) return;

    window.clearTimeout(emitTimerRef.current);
    emitTimerRef.current = window.setTimeout(() => {
      const pkt = buildStandardConnectorPacket(
        controller,
        settings,
        cameraBlocking,
        showStoryOverlay,
        clientIdRef.current,
        liveCameraRig
      );
      emitPacketOverTransports(pkt);
    }, 28);

    return () => window.clearTimeout(emitTimerRef.current);
  }, [
    controller,
    settings,
    cameraBlocking,
    liveCameraRig,
    showStoryOverlay,
    emitPacketOverTransports,
  ]);

  const sendRemoteAction = useCallback(
    (action: UscpRemoteActionType, payload?: any) => {
      const msg = {
        type: 'uscp:action',
        action,
        payload,
        senderId: clientIdRef.current,
      };
      if (bcRef.current) {
        try {
          bcRef.current.postMessage(msg);
        } catch {
          // ignore
        }
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg));
      } else if (sessionTokenRef.current) {
        fetch(
          `/api/uscp/sessions/${encodeURIComponent(
            latestRefs.current.controller.sessionId || 'BUJOK-STUDIO'
          )}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-USCP-Token': sessionTokenRef.current,
            },
            body: JSON.stringify(msg),
          }
        ).catch(() => {});
      }
    },
    []
  );

  const publishSceneCatalog = useCallback(
    (catalog: UscpRemoteSceneSummary[], activeSceneId: string) => {
      const msg = {
        type: 'uscp:scenes_update',
        sceneCatalog: catalog,
        activeSceneId,
      };
      if (bcRef.current) {
        try {
          bcRef.current.postMessage(msg);
        } catch {
          // ignore
        }
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg));
      }
    },
    []
  );

  const forceSyncNow = useCallback(() => {
    const cur = latestRefs.current;
    const pkt = buildStandardConnectorPacket(
      cur.controller,
      cur.settings,
      cur.cameraBlocking,
      cur.showStoryOverlay,
      clientIdRef.current,
      cur.liveCameraRig
    );
    emitPacketOverTransports(pkt);
  }, [emitPacketOverTransports]);

  const pingServerNow = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'uscp:ping', clientTs: performance.now() })
      );
    }
  }, []);

  const unlockWithPin = useCallback(async (pin: string): Promise<boolean> => {
    const cur = latestRefs.current;
    const cleanedPin = pin.trim().toUpperCase().slice(0, 12);
    if (!cleanedPin) {
      setAuthError('Wpisz 6-znakowy kod PIN z głównego ekranu.');
      return false;
    }
    try {
      const res = await fetch(
        `/api/uscp/sessions/${encodeURIComponent(cur.controller.sessionId || 'BUJOK-STUDIO')}/pair`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'tablet', pin: cleanedPin }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAuthError(err.error || 'Nieprawidłowy kod PIN sesji.');
        return false;
      }
      const data = await res.json();
      if (data.pairToken) {
        setSessionToken(data.pairToken);
        setPinCode(data.pinCode || cleanedPin);
        setAuthRequired(false);
        setAuthError(null);
        cur.onUpdateController({
          ...cur.controller,
          sessionToken: data.pairToken,
        });
        return true;
      }
    } catch {
      setAuthError('Błąd połączenia z serwerem parowania.');
    }
    return false;
  }, []);

  const rotateSecureSession = useCallback(async () => {
    const cur = latestRefs.current;
    const nextSessionId = `MED-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(
      10 + Math.random() * 89
    )}`;
    try {
      const res = await fetch(
        `/api/uscp/sessions/${encodeURIComponent(nextSessionId)}/pair`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'host', rotate: true }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setSessionToken(data.pairToken || '');
        setPinCode(data.pinCode || '');
        setAuthRequired(false);
        setAuthError(null);
        cur.onUpdateController({
          ...cur.controller,
          sessionId: data.sessionId || nextSessionId,
          sessionToken: data.pairToken || '',
        });
        return;
      }
    } catch {
      // Fallback local session change
    }
    cur.onUpdateController({
      ...cur.controller,
      sessionId: nextSessionId,
    });
  }, []);

  const registerSpatialAnchor = useCallback((anchor: SpatialAnchorNode) => {
    setSpatialAnchors((prev) => {
      const idx = prev.findIndex((a) => a.id === anchor.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = anchor;
        return next;
      }
      return [...prev, anchor];
    });
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'uscp:anchor_register', anchor }));
    }
  }, []);

  const sendRangingSample = useCallback(
    (samples: Array<{ anchorId: string; distanceMeters: number; signalQuality?: number }>) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'uscp:ranging_sample', samples }));
      }
    },
    []
  );

  const sendAirPose = useCallback((pose: { x: number; y: number; z: number }) => {
    setSolvedAirPose((prev) => ({ ...prev, x: pose.x, y: pose.y, z: pose.z, updatedAt: Date.now() }));
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'uscp:air_pose', pose }));
    }
  }, []);

  return {
    clientId: clientIdRef.current,
    sessionToken,
    pinCode,
    connectionStatus,
    peers,
    remoteScenes,
    remoteActiveSceneId,
    spatialAnchors,
    solvedAirPose,
    lastSyncAt,
    latencyMs,
    authRequired,
    authError,
    securityStatus,
    sendRemoteAction,
    publishSceneCatalog,
    registerSpatialAnchor,
    sendRangingSample,
    sendAirPose,
    forceSyncNow,
    rotateSecureSession,
    unlockWithPin,
    pingServerNow,
  };
}

export const UNIVERSAL_CONNECTOR_SDK_SNIPPET = `// Wystandaryzowany Łącznik Wielu Aplikacji (USCP-1.0 Secure Universal Studio Connector)
// Obsługuje: Token-Authenticated WebSocket (/ws/uscp), HMAC Digest, Kalibrowany Model Przestrzenny (np. Diagnostyka Tkanek ΔV) oraz BroadcastChannel.

export type SwitchGroupId = 'camera_path_3d' | 'lighting' | 'optics_pbr' | 'color_lut' | 'mobile_framing';

export interface SpatialModelPayload {
  id: string;
  name: string;
  domainProfile: 'camera_3d' | 'medical_tissue_volume' | 'custom';
  deadzoneDeg: number;
  maxTiltDeg: number;
  sensitivityMultiplier: number;
  smoothingAlpha: number;
  responseCurve: 'linear' | 'precision_cubic' | 'logarithmic_medical';
}

export interface USCPConnectorPacket {
  protocol: 'USCP-1.0';
  sessionId: string;
  senderId: string;
  integrityDigest?: string;
  appNamespace: string;
  enabledSwitchGroups: Record<SwitchGroupId, boolean>;
  switches: Record<string, boolean>;
  values: Record<string, number | string | boolean | undefined>;
  customChannels?: {
    spatialModel?: SpatialModelPayload;
    [channel: string]: Record<string, unknown> | undefined;
  };
}

export function createUniversalAppConnector(options: {
  serverOrigin: string; // np. https://twoja-aplikacja.run.app
  sessionId: string;    // np. 'BUJOK-STUDIO'
  token: string;        // token parowania sesji (z kodu QR lub PIN)
  appNamespace: string; // np. 'med.diagnostyka.tkanki.v1'
  role?: 'host' | 'tablet' | 'app';
  onSync: (packet: USCPConnectorPacket) => void;
  onAction?: (action: string, payload?: unknown) => void;
}) {
  const clientId = \`app_\${Math.random().toString(36).slice(2, 8)}\`;
  const wsOrigin = options.serverOrigin.replace(/^http/, 'ws');
  const ws = new WebSocket(
    \`\${wsOrigin}/ws/uscp?session=\${encodeURIComponent(options.sessionId)}&token=\${encodeURIComponent(options.token)}&role=\${options.role || 'app'}&appNamespace=\${encodeURIComponent(options.appNamespace)}&clientId=\${clientId}\`
  );

  const bc = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(\`uscp-session-\${options.sessionId}\`)
    : null;

  const handlePacket = (packet: USCPConnectorPacket) => {
    if (packet?.protocol === 'USCP-1.0' && packet.senderId !== clientId) {
      options.onSync(packet);
    }
  };

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if ((msg.type === 'uscp:welcome' && msg.latestPacket) || (msg.type === 'uscp:packet' && msg.payload)) {
      handlePacket(msg.latestPacket || msg.payload);
    } else if (msg.type === 'uscp:action' && options.onAction) {
      options.onAction(msg.action, msg.payload);
    }
  };

  if (bc) {
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'uscp:packet') handlePacket(ev.data.payload);
    };
  }

  return {
    sendSwitchSets(
      activeGroups: SwitchGroupId[],
      switches: Record<string, boolean> = {},
      values: Record<string, number | string | boolean | undefined> = {}
    ) {
      const packet: USCPConnectorPacket = {
        protocol: 'USCP-1.0',
        sessionId: options.sessionId,
        senderId: clientId,
        appNamespace: options.appNamespace,
        enabledSwitchGroups: {
          camera_path_3d: activeGroups.includes('camera_path_3d'),
          lighting: activeGroups.includes('lighting'),
          optics_pbr: activeGroups.includes('optics_pbr'),
          color_lut: activeGroups.includes('color_lut'),
          mobile_framing: activeGroups.includes('mobile_framing'),
        },
        switches,
        values,
      };
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'uscp:packet', payload: packet }));
      }
      bc?.postMessage({ type: 'uscp:packet', payload: packet });
    },
    disconnect() {
      ws.close();
      bc?.close();
    },
  };
}`;
