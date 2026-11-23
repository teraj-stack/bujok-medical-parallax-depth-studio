export type CameraMotionPreset =
  | 'dolly_in'
  | 'cinematic_pan'
  | 'orbital_drift'
  | 'breathing_cinema'
  | 'static_studio';

export type AspectRatioOption =
  | '1:1'
  | '2:3'
  | '3:2'
  | '3:4'
  | '4:3'
  | '9:16'
  | '16:9'
  | '21:9';

export type VisualFxPresetId =
  | 'cinematic_gold'
  | 'leica_soft_dof'
  | 'nordic_clean'
  | 'analog_35mm'
  | 'vivid_hdr';

export type NarrativeToneId =
  | 'luxury_patient'
  | 'warsaw_architecture'
  | 'aesthetic_innovation'
  | 'cinematic_voiceover';

export interface VisualEffectSettings {
  // Core Depth, Lighting & Photorealism
  depthIntensity: number; // 0 - 100: 3D perspective relief of interior architecture
  cameraMotion: number; // 0 - 100: Discreet camera frame motion speed & amplitude
  photorealism: number; // 0 - 100: PBR specular marble gloss, glass reflections & micro-contrast
  warmGlow: number; // 0 - 100: Golden hour sunset warmth & ring chandelier bloom
  windowLightIntensity: number; // 0 - 100: Natural daylight / dusk illumination through the clinic windows
  motionPreset: CameraMotionPreset;
  show3DProps: boolean; // Toggle 3D architectural chandelier & sculptural reception accents

  // Predefined Visual Effects Library (Real-time Post-Processing FX)
  activeFxPreset: VisualFxPresetId;
  blurIntensity: number; // 0 - 100: Optical Depth-of-Field / Tilt-Shift edge blur
  vignetteIntensity: number; // 0 - 100: Cinematic peripheral lens vignette
  colorGrading: number; // 0 - 100: Color correction & tonal LUT intensity
  filmGrain: number; // 0 - 100: Fine 35mm organic film grain texture
}

export interface VisualFxPreset {
  id: VisualFxPresetId;
  name: string;
  description: string;
  settings: Pick<
    VisualEffectSettings,
    | 'activeFxPreset'
    | 'blurIntensity'
    | 'vignetteIntensity'
    | 'colorGrading'
    | 'filmGrain'
    | 'warmGlow'
    | 'photorealism'
  >;
}

export interface SceneNarrative {
  title: string;
  toneLabel: string;
  leadHook: string;
  storyBody: string;
  voiceoverTagline: string;
  frameCaptions: [string, string, string, string];
}

export interface ReadyPromptRecipe {
  id: string;
  title: string;
  category: 'depth_lighting' | 'photorealism' | 'camera_motion' | 'sequence_4';
  subtitle: string;
  promptPL: string;
  promptEN: string;
  recommendedSettings: Partial<VisualEffectSettings>;
}

export interface KeyframePathTransform {
  t: number; // 0..1 normalized position on path
  shiftXNorm: number; // normalized horizontal shift (-0.12 .. +0.12)
  shiftYNorm: number; // normalized vertical shift (-0.12 .. +0.12)
  zoomScale: number; // optical & dolly scale (>= 1.12)
  rollRad: number; // axial roll in radians
}

export interface KeyframeItem {
  id: number;
  label: string;
  phaseTitle: string;
  cameraOffsetLabel: string;
  prompt: string;
  imageUrl: string;
  sourceType: 'realtime_shader' | 'ai_generated';
  pathTransform?: KeyframePathTransform;
}

export interface SceneAsset {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  windowBounds: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  defaultSettings: VisualEffectSettings;
  curatedPrompts: ReadyPromptRecipe[];
  defaultNarrative: SceneNarrative;
}

export type DrawerTabId =
  | 'blocking3d'
  | 'mobile'
  | 'controller'
  | 'prompts'
  | 'story'
  | 'sequence'
  | 'export'
  | 'director';

export type SwitchGroupId =
  | 'lighting'
  | 'optics_pbr'
  | 'color_lut'
  | 'camera_path_3d'
  | 'mobile_framing';

export type ElementFocusPresetId =
  | 'all_enabled'
  | 'focus_camera_path'
  | 'focus_lighting'
  | 'focus_optics'
  | 'focus_color'
  | 'focus_mobile'
  | 'custom_selection';

export type SpatialResponseCurve = 'linear' | 'precision_cubic' | 'logarithmic_medical';

export type SpatialAxisKey =
  | 'yawDeg'
  | 'pitchDeg'
  | 'rollDeg'
  | 'dollyZ'
  | 'panX'
  | 'fovOffset';

export type SpatialDomainProfile = 'camera_3d' | 'medical_tissue_volume' | 'custom';

export interface SpatialAxisConfig {
  key: SpatialAxisKey;
  enabled: boolean;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  invert: boolean;
}

export interface SpatialControllerModel {
  id: string;
  name: string;
  domainProfile: SpatialDomainProfile;
  calibratedAt: string;
  zeroAlpha: number;
  zeroBeta: number;
  zeroGamma: number;
  noiseFloorDeg: number; // measured hand/sensor micro-tremor baseline
  deadzoneDeg: number; // auto-computed deadzone around zero point
  maxTiltDeg: number; // measured comfortable full-scale tilt (e.g., 15°..45°)
  sensitivityMultiplier: number; // auto-computed gain factor (0.4..3.0)
  smoothingAlpha: number; // EMA filter coefficient (0.08..0.85, lower = smoother)
  responseCurve: SpatialResponseCurve;
  axes: Record<SpatialAxisKey, SpatialAxisConfig>;
}

export type CameraControllerFunctionId =
  | 'camera_aim_vr'
  | 'camera_dolly_track'
  | 'camera_lens_focus'
  | 'camera_path_scrub'
  | 'camera_air_6dof'
  | 'camera_full_rig';

export type UscpDeviceRoleMode = 'air_wand' | 'spatial_anchor' | 'camera_console';

export type SpatialSensorTech =
  | 'optical_apriltag'
  | 'uwb_ble'
  | 'acoustic_tdoa'
  | 'webxr_vio';

export interface SpatialAnchorNode {
  id: string;
  label: string;
  positionMeters: { x: number; y: number; z: number };
  measuredDistMeters: number;
  signalQuality: number; // 0..100%
  connected: boolean;
  sensorTech: SpatialSensorTech;
  lastSeenAt: number;
}

export interface SolvedAirPose {
  x: number; // -2.5..2.5m
  y: number; // 0.3..2.6m
  z: number; // -2.5..2.5m
  confidencePct: number; // 0..100
  pdop: number; // Position Dilution of Precision
  activeAnchorCount: number;
  updatedAt: number;
}

export interface UniversalControllerConfig {
  sessionId: string;
  sessionToken?: string;
  connectorId: string;
  appNamespace: string;
  protocolVersion: 'USCP-1.0';
  activeFocusPreset: ElementFocusPresetId;
  activeCameraFunction: CameraControllerFunctionId;
  deviceRoleMode?: UscpDeviceRoleMode;
  activeAnchorId?: string;
  enabledGroups: Record<SwitchGroupId, boolean>;
  show3DPathOnMainViewport: boolean;
  mobileSafeZonesVisible: boolean;
  autoBroadcastPostMessage: boolean;
  spatialModel?: SpatialControllerModel;
  spatialAnchors?: SpatialAnchorNode[];
  solvedAirPose?: SolvedAirPose;
}

export type UscpRemoteActionType =
  | 'export_webp'
  | 'export_mp4'
  | 'select_scene'
  | 'reset_settings'
  | 'regenerate_keyframes'
  | 'open_tab'
  | 'capture_vr_to_state_a'
  | 'capture_vr_to_state_b'
  | 'capture_air_shot';

export type LiveCameraControlSource =
  | 'idle'
  | 'vr_gyro'
  | 'vr_simulator'
  | 'potentiometer'
  | 'hardware_gamepad'
  | 'web_midi'
  | 'air_wand_6dof';

export interface LiveCameraRigState {
  enabled: boolean;
  source: LiveCameraControlSource;
  yawDeg: number; // -45 to +45 deg
  pitchDeg: number; // -30 to +30 deg
  rollDeg: number; // -25 to +25 deg
  dollyZ: number; // -1.8 to +1.8 m
  panX: number; // -1.8 to +1.8 m
  fovOffset: number; // -12 to +14 deg
  vrSensitivity: number; // 0.3 to 2.5
  invertAxes: boolean;
  airX?: number; // solved free-space X in meters (-2.0..+2.0)
  airY?: number; // solved free-space Y offset from 1.4m eye height (-1.0..+1.0)
  airZ?: number; // solved free-space Z offset in meters (-2.0..+2.0)
}

export type MobileGraphicFormat =
  | '9:16_story'
  | '9:16_wallpaper'
  | '4:5_feed'
  | '1:1_square';

export type FocalLengthOption = 18 | 24 | 35 | 50 | 85;

export type PathEasingStyle =
  | 'smooth_cinema'
  | 'cubic_catmull'
  | 'linear_constant'
  | 'slow_reveal_out';

export interface CameraRigKeyframePose {
  x: number; // meters (-5.5 to +5.5)
  y: number; // camera height in meters (0.45 to 3.4)
  z: number; // depth in meters (-3.8 to +6.2)
  panDeg: number; // horizontal framing yaw (-180 to +180 deg)
  tiltDeg: number; // vertical framing pitch (-45 to +45 deg)
  rollDeg: number; // axial Dutch roll (-35 to +35 deg)
}

export interface InterpolatedCameraState extends CameraRigKeyframePose {
  focalMm: number;
  easedT: number;
}

export interface CameraBlockingConfig {
  activeShotPresetId: string;
  startPose: CameraRigKeyframePose;
  endPose: CameraRigKeyframePose;
  curveArcOffset: number; // -2.5m to +2.5m lateral path curvature
  pathVerticalArc?: number; // -1.2m to +1.2m vertical crane/arc midpoint offset
  focalLengthMm: FocalLengthOption; // State A focal length (mm)
  endFocalLengthMm?: FocalLengthOption; // Optional State B focal length (mm) for smooth zoom path
  lockFramingToTarget: boolean;
  targetSubjectLabel: string;
  targetPoint: {
    x: number;
    y: number;
    z: number;
  };
  durationSec: number;
  easingStyle: PathEasingStyle;
  smoothingFactor?: number; // 0 - 100: Easing intensity of interpolated camera path between keyframe states
  pathEnabledInSequence?: boolean;
}

export interface CinematicNarrativeShotPreset {
  id: string;
  code: string;
  titlePL: string;
  titleEN: string;
  filmGrammarCategory:
    | 'Odsłonięcie Narracyjne'
    | 'Symetria Hipnotyczna'
    | 'Kontekst i Skala'
    | 'Perspektywa Premium TV';
  attentionMechanismPL: string;
  referenceCinemaExamples: string;
  retentionMetricNote: string;
  directorCommunicationNotePL: string;
  promptPL: string;
  promptEN: string;
  fourFrameBreakdownPL: [string, string, string, string];
  blocking: Omit<CameraBlockingConfig, 'activeShotPresetId'>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  modelUsed?: string;
  timestamp: string;
}

