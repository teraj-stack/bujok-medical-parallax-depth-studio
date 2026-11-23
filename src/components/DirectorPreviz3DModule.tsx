import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ArrowLeftRight,
  Camera,
  Check,
  Compass,
  Copy,
  Crosshair,
  Download,
  Film,
  Loader2,
  Maximize2,
  MessageSquare,
  Move3d,
  Pause,
  Pin,
  Play,
  RotateCcw,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  ARCHITECTURAL_ANCHOR_TARGETS,
  buildDirectorCommunicationBrief,
  CINEMATIC_NARRATIVE_SHOTS,
  computeAnglesToTarget,
  computePathControlPoint,
  evaluatePathEasing,
  focalLengthToHorizontalFov,
  focalLengthToVerticalFov,
  interpolateBlockingPose,
} from '../data/cinematicShotsLibrary';
import {
  CameraBlockingConfig,
  CameraRigKeyframePose,
  CinematicNarrativeShotPreset,
  FocalLengthOption,
  KeyframeItem,
  PathEasingStyle,
} from '../types/studio';
import { formatBytes } from '../utils/mediaExporter';

interface DirectorPreviz3DModuleProps {
  sceneTitle: string;
  blocking: CameraBlockingConfig;
  onChangeBlocking: (next: CameraBlockingConfig) => void;
  keyframes: KeyframeItem[];
  onApplyToFourFrames: (
    fourPrompts: [string, string, string, string],
    mainPrompt: string
  ) => Promise<void>;
  onGenerateSmoothPathVideo: (
    fourPrompts: [string, string, string, string],
    mainPrompt: string,
    autoDownload?: boolean
  ) => Promise<void>;
  isGeneratingPathVideo: boolean;
  pathVideoProgress: number;
  activePathCompilingFrame: number;
  generatedPathVideoUrl: string | null;
  generatedPathVideoSize: number | null;
  onSendBriefToDirectorChat: (briefText: string) => void;
}

type GizmoTargetMode = 'none' | 'start' | 'mid' | 'end' | 'target';
type StageCameraPreset = 'director_iso' | 'top_floorplan' | 'window_side' | 'swap_viewfinder';

const FOCAL_LENGTHS: FocalLengthOption[] = [18, 24, 35, 50, 85];

const PATH_EASING_OPTIONS: { id: PathEasingStyle; label: string }[] = [
  { id: 'smooth_cinema', label: 'Kinowa Krzywa S (Ease-In-Out)' },
  { id: 'cubic_catmull', label: 'Płynny Splajn Filmowy (Smootherstep)' },
  { id: 'slow_reveal_out', label: 'Intrygujące Wyhamowanie (Slow-Reveal)' },
  { id: 'linear_constant', label: 'Jednostajny Wózek (Linear)' },
];

const SHOT_CATEGORIES: Array<
  'Wszystkie' | CinematicNarrativeShotPreset['filmGrammarCategory']
> = [
  'Wszystkie',
  'Odsłonięcie Narracyjne',
  'Symetria Hipnotyczna',
  'Kontekst i Skala',
  'Perspektywa Premium TV',
];

// Reusable module-scope math objects (Zero GC inside render loop)
const _vStart = new THREE.Vector3();
const _vCtrl = new THREE.Vector3();
const _vEnd = new THREE.Vector3();
const _vSample = new THREE.Vector3();
const _eulerYXZ = new THREE.Euler(0, 0, 0, 'YXZ');
const _dummyObj = new THREE.Object3D();

function focalNumberToVerticalFov(focalMm: number): number {
  const sensorHeightMm = 24;
  const fovRad = 2 * Math.atan(sensorHeightMm / (2 * Math.max(12, focalMm)));
  return (fovRad * 180) / Math.PI;
}

function createCalibratedFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#191b22';
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.strokeStyle = 'rgba(212, 175, 55, 0.05)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 28; i++) {
    ctx.beginPath();
    const startY = (i * 37) % 1024;
    ctx.moveTo(0, startY);
    ctx.bezierCurveTo(
      340,
      startY + ((i % 3) - 1) * 45,
      680,
      startY - ((i % 2) - 0.5) * 60,
      1024,
      startY + 20
    );
    ctx.stroke();
  }

  const step = 1024 / 14;
  for (let i = 0; i <= 14; i++) {
    const pos = i * step;
    const isMajor = i === 7 || i % 2 === 0;
    ctx.strokeStyle =
      i === 7
        ? 'rgba(212, 175, 55, 0.34)'
        : isMajor
          ? 'rgba(255,255,255,0.11)'
          : 'rgba(255,255,255,0.045)';
    ctx.lineWidth = i === 7 ? 2 : 1;

    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, 1024);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(1024, pos);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(212, 175, 55, 0.65)';
  ctx.font = '600 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RECEPCJA & 4 PANELE SPECJALIZACJI (-Z)', 512, 42);
  ctx.fillText('STREFA WEJŚCIA DO LOBBY (+Z)', 512, 996);

  ctx.save();
  ctx.translate(38, 512);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('FASADA OKIENNA · PANORAMA WARSZAWY (-X)', 0, 0);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSpecialtyPanelTexture(
  title: string,
  indexLabel: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 384);
  grad.addColorStop(0, '#3a3328');
  grad.addColorStop(1, '#221e18');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 384);

  ctx.strokeStyle = '#e5c158';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 236, 364);

  ctx.strokeStyle = '#f3dfb2';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(128, 128, 38, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#d4af37';
  ctx.font = '600 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(indexLabel, 128, 136);

  ctx.fillStyle = '#f7f3e8';
  ctx.font = '600 22px sans-serif';
  const words = title.split(' ');
  words.forEach((w, idx) => {
    ctx.fillText(w, 128, 245 + idx * 30);
  });

  ctx.fillStyle = '#d4af37';
  ctx.font = '400 24px sans-serif';
  ctx.fillText('→', 128, 332);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createMarbleDeskTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e9e3d8';
  ctx.fillRect(0, 0, 512, 256);

  for (let i = 0; i < 18; i++) {
    ctx.strokeStyle =
      i % 3 === 0 ? 'rgba(182, 146, 78, 0.32)' : 'rgba(110, 104, 96, 0.24)';
    ctx.lineWidth = 1.5 + (i % 3) * 1.4;
    ctx.beginPath();
    ctx.moveTo((i * 43) % 512, 0);
    ctx.bezierCurveTo(
      ((i * 73) % 512) - 40,
      90,
      ((i * 97) % 512) + 50,
      175,
      ((i * 59) % 512) + 20,
      256
    );
    ctx.stroke();
  }

  ctx.fillStyle = '#b99128';
  ctx.font = '700 28px serif';
  ctx.textAlign = 'center';
  ctx.fillText('B  BUJOK MEDICAL', 256, 140);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function buildCinemaCameraRig(
  accentHex: number,
  opacity = 1.0,
  scale = 1.0
): THREE.Group {
  const group = new THREE.Group();
  const isGhost = opacity < 0.99;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: isGhost ? accentHex : 0x1e222b,
    roughness: 0.35,
    metalness: 0.72,
    transparent: isGhost,
    opacity,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: isGhost ? 0.28 : 0.42,
    roughness: 0.22,
    metalness: 0.85,
    transparent: isGhost,
    opacity,
  });

  const lensGlassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.08,
    metalness: 0.9,
    transparent: true,
    opacity: isGhost ? opacity * 0.8 : 0.9,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.36), bodyMat);
  group.add(body);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.095, 0.22, 20),
    accentMat
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0, -0.26);
  group.add(barrel);

  const matteBox = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.09), bodyMat);
  matteBox.position.set(0, 0, -0.39);
  group.add(matteBox);

  const frontGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.068, 0.02, 20),
    lensGlassMat
  );
  frontGlass.rotation.x = Math.PI / 2;
  frontGlass.position.set(0, 0, -0.435);
  group.add(frontGlass);

  const handleBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.26), accentMat);
  handleBar.position.set(0, 0.18, -0.02);
  group.add(handleBar);

  const riserFront = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.04), bodyMat);
  riserFront.position.set(0, 0.14, -0.11);
  const riserBack = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.04), bodyMat);
  riserBack.position.set(0, 0.14, 0.08);
  group.add(riserFront, riserBack);

  const batteryPack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.1), accentMat);
  batteryPack.position.set(0, 0.01, 0.22);
  group.add(batteryPack);

  const sideMonitor = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.025), accentMat);
  sideMonitor.position.set(0.22, 0.06, -0.05);
  sideMonitor.rotation.y = -0.35;
  group.add(sideMonitor);

  group.scale.setScalar(scale);
  return group;
}

/**
 * Builds a mini 16:9 viewfinder gate frame oriented along one of the 4 sampled path keyframes.
 */
function buildMiniPathFrameGate(hexColor: number): THREE.LineLoop {
  const hw = 0.22;
  const hh = 0.124;
  const pts = [
    new THREE.Vector3(-hw, hh, -0.25),
    new THREE.Vector3(hw, hh, -0.25),
    new THREE.Vector3(hw, -hh, -0.25),
    new THREE.Vector3(-hw, -hh, -0.25),
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color: hexColor,
    transparent: true,
    opacity: 0.72,
  });
  return new THREE.LineLoop(geo, mat);
}

export const DirectorPreviz3DModule: React.FC<DirectorPreviz3DModuleProps> = ({
  sceneTitle,
  blocking,
  onChangeBlocking,
  keyframes,
  onApplyToFourFrames,
  onGenerateSmoothPathVideo,
  isGeneratingPathVideo,
  pathVideoProgress,
  activePathCompilingFrame,
  generatedPathVideoUrl,
  generatedPathVideoSize,
  onSendBriefToDirectorChat,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const blockingRef = useRef<CameraBlockingConfig>(blocking);
  blockingRef.current = blocking;

  const onChangeBlockingRef = useRef(onChangeBlocking);
  onChangeBlockingRef.current = onChangeBlocking;

  const [selectedCategory, setSelectedCategory] =
    useState<(typeof SHOT_CATEGORIES)[number]>('Wszystkie');
  const [playhead, setPlayhead] = useState<number>(0.35);
  const playheadRef = useRef<number>(0.35);
  playheadRef.current = playhead;

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const isPlayingRef = useRef<boolean>(true);
  isPlayingRef.current = isPlaying;

  const [gizmoMode, setGizmoMode] = useState<GizmoTargetMode>('end');
  const [stagePreset, setStagePreset] = useState<StageCameraPreset>('director_iso');
  const [swapMainWithLens, setSwapMainWithLens] = useState<boolean>(false);
  const swapMainWithLensRef = useRef<boolean>(false);
  swapMainWithLensRef.current = swapMainWithLens;

  const [copiedBrief, setCopiedBrief] = useState<boolean>(false);
  const [appliedToFramesToast, setAppliedToFramesToast] = useState<boolean>(false);
  const [capturedStateFeedback, setCapturedStateFeedback] = useState<'A' | 'B' | null>(null);

  const sceneApiRef = useRef<{
    requestRender: () => void;
    startPlayLoop: () => void;
    syncFromBlocking: () => void;
    setGizmoTarget: (mode: GizmoTargetMode) => void;
    applyStageViewPreset: (preset: StageCameraPreset) => void;
    exportPrevizWebP: () => void;
  } | null>(null);

  const activePreset = useMemo(
    () => CINEMATIC_NARRATIVE_SHOTS.find((s) => s.id === blocking.activeShotPresetId),
    [blocking.activeShotPresetId]
  );

  const filteredShots = useMemo(() => {
    if (selectedCategory === 'Wszystkie') return CINEMATIC_NARRATIVE_SHOTS;
    return CINEMATIC_NARRATIVE_SHOTS.filter(
      (s) => s.filmGrammarCategory === selectedCategory
    );
  }, [selectedCategory]);

  const currentLivePose = useMemo(
    () => interpolateBlockingPose(blocking, playhead),
    [blocking, playhead]
  );

  const directorBrief = useMemo(
    () => buildDirectorCommunicationBrief(blocking, activePreset, sceneTitle),
    [blocking, activePreset, sceneTitle]
  );

  const sampledFourStates = useMemo(
    () => [0, 1 / 3, 2 / 3, 1].map((t) => interpolateBlockingPose(blocking, t)),
    [blocking]
  );

  // Initialize Three.js 3D Previz Model, Path Spline, Velocity Ticks & Dual Camera Viewfinder once
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(300, container.clientHeight);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setScissorTest(true);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1017);
    scene.fog = new THREE.FogExp2(0x0d1017, 0.024);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const disposables: Array<{ dispose: () => void }> = [envRT];

    const stageCamera = new THREE.PerspectiveCamera(46, width / height, 0.1, 120);
    stageCamera.position.set(6.4, 5.4, 8.2);
    stageCamera.lookAt(0, 1.2, -0.4);

    const lensCamera = new THREE.PerspectiveCamera(38, 16 / 9, 0.12, 95);

    const orbit = new OrbitControls(stageCamera, renderer.domElement);
    orbit.enableDamping = !isSoftwareGl;
    orbit.dampingFactor = 0.07;
    orbit.target.set(-0.2, 1.25, -0.5);
    orbit.minDistance = 2.5;
    orbit.maxDistance = 22;
    orbit.maxPolarAngle = Math.PI * 0.49;

    const hemiLight = new THREE.HemisphereLight(0x9ec5ff, 0x241d15, 0.75);
    scene.add(hemiLight);

    const sunKeyLight = new THREE.DirectionalLight(0xffcf87, 2.35);
    sunKeyLight.position.set(-11, 5.8, 1.5);
    sunKeyLight.castShadow = !isSoftwareGl;
    sunKeyLight.shadow.mapSize.set(1024, 1024);
    sunKeyLight.shadow.camera.left = -9;
    sunKeyLight.shadow.camera.right = 9;
    sunKeyLight.shadow.camera.top = 7;
    sunKeyLight.shadow.camera.bottom = -7;
    sunKeyLight.shadow.bias = -0.0005;
    sunKeyLight.shadow.normalBias = 0.02;
    scene.add(sunKeyLight);

    const chandelierLight = new THREE.PointLight(0xffdba0, 3.2, 12, 1.4);
    chandelierLight.position.set(1.35, 3.1, -1.85);
    scene.add(chandelierLight);

    // =========================================================================
    // ARCHITECTURAL SCALE MODEL OF BUJOK MEDICAL LOBBY
    // =========================================================================
    const lobbyGroup = new THREE.Group();
    scene.add(lobbyGroup);

    const floorTex = createCalibratedFloorTexture(maxAniso);
    disposables.push(floorTex);
    const floorGeo = new THREE.PlaneGeometry(14, 14);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.22,
      metalness: 0.18,
    });
    disposables.push(floorGeo, floorMat);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    lobbyGroup.add(floorMesh);

    const woodWallGroup = new THREE.Group();
    const backWallGeo = new THREE.BoxGeometry(6.8, 4.1, 0.28);
    const backWallMat = new THREE.MeshStandardMaterial({
      color: 0x3b281c,
      roughness: 0.62,
      metalness: 0.08,
    });
    disposables.push(backWallGeo, backWallMat);
    const backWall = new THREE.Mesh(backWallGeo, backWallMat);
    backWall.position.set(1.5, 2.05, -4.2);
    backWall.receiveShadow = true;
    woodWallGroup.add(backWall);

    const slatCount = 46;
    const slatGeo = new THREE.BoxGeometry(0.06, 4.08, 0.05);
    const slatMat = new THREE.MeshStandardMaterial({
      color: 0x523724,
      roughness: 0.48,
      metalness: 0.12,
    });
    disposables.push(slatGeo, slatMat);
    const slatInstanced = new THREE.InstancedMesh(slatGeo, slatMat, slatCount);
    for (let i = 0; i < slatCount; i++) {
      _dummyObj.position.set(-1.75 + i * 0.142, 2.05, -4.04);
      _dummyObj.rotation.set(0, 0, 0);
      _dummyObj.scale.set(1, 1, 1);
      _dummyObj.updateMatrix();
      slatInstanced.setMatrixAt(i, _dummyObj.matrix);
    }
    slatInstanced.instanceMatrix.needsUpdate = true;
    slatInstanced.computeBoundingSphere();
    woodWallGroup.add(slatInstanced);

    const specialties = [
      { title: 'Proktologia', code: '01' },
      { title: 'Flebologia', code: '02' },
      { title: 'Chirurgia ogólna', code: '03' },
      { title: 'Medycyna estetyczna', code: '04' },
    ];
    specialties.forEach((sp, idx) => {
      const panelTex = createSpecialtyPanelTexture(sp.title, sp.code, maxAniso);
      disposables.push(panelTex);
      const panelGeo = new THREE.BoxGeometry(1.12, 1.68, 0.05);
      const panelMat = new THREE.MeshStandardMaterial({
        map: panelTex,
        emissive: 0xd4af37,
        emissiveMap: panelTex,
        emissiveIntensity: 0.34,
        roughness: 0.18,
        metalness: 0.25,
      });
      disposables.push(panelGeo, panelMat);
      const panelMesh = new THREE.Mesh(panelGeo, panelMat);
      panelMesh.position.set(-0.55 + idx * 1.35, 2.22, -3.96);
      woodWallGroup.add(panelMesh);
    });
    lobbyGroup.add(woodWallGroup);

    const deskGroup = new THREE.Group();
    deskGroup.position.set(1.45, 0, -2.15);

    const marbleTex = createMarbleDeskTexture(maxAniso);
    disposables.push(marbleTex);
    const deskMarbleMat = new THREE.MeshStandardMaterial({
      map: marbleTex,
      roughness: 0.16,
      metalness: 0.12,
    });
    const deskFrontBoxGeo = new THREE.BoxGeometry(3.85, 1.06, 0.95);
    const deskTopGeo = new THREE.BoxGeometry(3.92, 0.08, 1.02);
    const plinthGeo = new THREE.BoxGeometry(3.55, 0.12, 0.78);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.2,
      metalness: 0.88,
    });
    const ledGlowMat = new THREE.MeshStandardMaterial({
      color: 0xffe4a3,
      emissive: 0xffc857,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });
    disposables.push(
      deskMarbleMat,
      deskFrontBoxGeo,
      deskTopGeo,
      plinthGeo,
      brassMat,
      ledGlowMat
    );

    const deskBody = new THREE.Mesh(deskFrontBoxGeo, deskMarbleMat);
    deskBody.position.set(0, 0.59, 0);
    deskBody.castShadow = true;
    deskBody.receiveShadow = true;
    deskGroup.add(deskBody);

    const deskTop = new THREE.Mesh(deskTopGeo, deskMarbleMat);
    deskTop.position.set(0, 1.13, 0);
    deskGroup.add(deskTop);

    const deskPlinth = new THREE.Mesh(plinthGeo, brassMat);
    deskPlinth.position.set(0, 0.06, 0);
    deskGroup.add(deskPlinth);

    const deskLedStrip = new THREE.Mesh(new THREE.BoxGeometry(3.62, 0.03, 0.82), ledGlowMat);
    deskLedStrip.position.set(0, 0.125, 0);
    deskGroup.add(deskLedStrip);

    const sculptureGroup = new THREE.Group();
    sculptureGroup.position.set(1.38, 1.17, 0.12);
    for (let f = 0; f < 7; f++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.28 + f * 0.04, 0.14), brassMat);
      fin.position.set(f * 0.04 - 0.12, 0.16 + f * 0.02, 0);
      fin.rotation.z = -0.18 + f * 0.07;
      sculptureGroup.add(fin);
    }
    deskGroup.add(sculptureGroup);

    const monitorScreen = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.3, 0.025),
      new THREE.MeshStandardMaterial({ color: 0xcfd4dc, metalness: 0.75, roughness: 0.25 })
    );
    monitorScreen.position.set(-0.68, 1.34, -0.05);
    deskGroup.add(monitorScreen);

    lobbyGroup.add(deskGroup);

    const chandelierGroup = new THREE.Group();
    chandelierGroup.position.set(1.35, 3.28, -1.85);
    const outerRingGeo = new THREE.TorusGeometry(1.75, 0.055, 16, 64);
    const innerGlowRingGeo = new THREE.TorusGeometry(1.69, 0.032, 12, 64);
    disposables.push(outerRingGeo, innerGlowRingGeo);

    const outerRing = new THREE.Mesh(outerRingGeo, brassMat);
    outerRing.rotation.x = Math.PI / 2;
    chandelierGroup.add(outerRing);

    const innerRing = new THREE.Mesh(innerGlowRingGeo, ledGlowMat);
    innerRing.rotation.x = Math.PI / 2;
    chandelierGroup.add(innerRing);

    const wireGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.9, 8);
    disposables.push(wireGeo);
    [
      [1.2, 1.2],
      [-1.2, 1.2],
      [1.2, -1.2],
      [-1.2, -1.2],
    ].forEach(([wx, wz]) => {
      const wire = new THREE.Mesh(wireGeo, brassMat);
      wire.position.set(wx, 0.45, wz);
      chandelierGroup.add(wire);
    });
    lobbyGroup.add(chandelierGroup);

    const facadeGroup = new THREE.Group();
    const mullionMat = new THREE.MeshStandardMaterial({
      color: 0x161920,
      roughness: 0.4,
      metalness: 0.7,
    });
    const glassPaneMat = new THREE.MeshStandardMaterial({
      color: 0x8ec5fc,
      transparent: true,
      opacity: 0.14,
      roughness: 0.08,
      metalness: 0.85,
      depthWrite: false,
    });
    disposables.push(mullionMat, glassPaneMat);

    const glassWall = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 4.1), glassPaneMat);
    glassWall.position.set(-5.2, 2.05, 0.2);
    glassWall.rotation.y = Math.PI / 2;
    glassWall.renderOrder = 2;
    facadeGroup.add(glassWall);

    for (let m = 0; m <= 8; m++) {
      const zPos = -4.2 + m * 1.15;
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, 4.15, 0.08), mullionMat);
      mullion.position.set(-5.2, 2.05, zPos);
      facadeGroup.add(mullion);
    }
    [1.35, 2.75, 4.08].forEach((yBar) => {
      const transom = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 9.4), mullionMat);
      transom.position.set(-5.2, yBar, 0.4);
      facadeGroup.add(transom);
    });

    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x263246,
      emissive: 0x3b2c1a,
      emissiveIntensity: 0.22,
      roughness: 0.3,
      metalness: 0.68,
    });
    disposables.push(towerMat);

    const skylineSpecs = [
      { x: -8.8, z: -2.6, w: 1.4, h: 5.4, d: 1.4, spire: false },
      { x: -9.4, z: -0.6, w: 1.25, h: 6.2, d: 1.5, spire: true },
      { x: -8.6, z: 1.4, w: 1.5, h: 4.5, d: 1.3, spire: false },
      { x: -10.5, z: -1.7, w: 1.6, h: 3.8, d: 1.6, spire: false },
      { x: -10.2, z: 2.9, w: 1.3, h: 5.0, d: 1.2, spire: true },
    ];
    skylineSpecs.forEach((tw) => {
      const bldg = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(tw.w, tw.h, tw.d), towerMat);
      base.position.y = tw.h / 2 - 0.5;
      bldg.add(base);
      if (tw.spire) {
        const crown = new THREE.Mesh(
          new THREE.BoxGeometry(tw.w * 0.6, 0.9, tw.d * 0.6),
          towerMat
        );
        crown.position.y = tw.h - 0.1;
        const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 1.3, 8), brassMat);
        needle.position.y = tw.h + 0.9;
        bldg.add(crown, needle);
      }
      bldg.position.set(tw.x, 0, tw.z);
      facadeGroup.add(bldg);
    });
    lobbyGroup.add(facadeGroup);

    const loungeGroup = new THREE.Group();
    const rugMat = new THREE.MeshStandardMaterial({ color: 0x35322d, roughness: 0.92 });
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x9b9082, roughness: 0.82 });
    disposables.push(rugMat, sofaMat);

    const rug = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.02, 2.5), rugMat);
    rug.position.set(-2.55, 0.015, 1.55);
    loungeGroup.add(rug);

    const sofaSeat1 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.42, 0.85), sofaMat);
    sofaSeat1.position.set(-2.65, 0.22, 1.05);
    sofaSeat1.castShadow = true;
    const sofaBack1 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.42, 0.2), sofaMat);
    sofaBack1.position.set(-2.65, 0.52, 0.72);
    const sofaSeat2 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, 1.35), sofaMat);
    sofaSeat2.position.set(-3.35, 0.22, 2.05);
    const coffeeTable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.46, 0.36, 28),
      brassMat
    );
    coffeeTable.position.set(-2.25, 0.19, 1.75);
    coffeeTable.castShadow = true;
    loungeGroup.add(sofaSeat1, sofaBack1, sofaSeat2, coffeeTable);

    const occPillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 4.1, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x262932, roughness: 0.5 })
    );
    occPillar.position.set(-4.55, 2.05, 3.65);
    const planterPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.22, 0.65, 20),
      brassMat
    );
    planterPot.position.set(-4.15, 0.33, 3.25);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x3b5e3c, roughness: 0.65 });
    for (let leaf = 0; leaf < 6; leaf++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.95, 6), foliageMat);
      frond.position.set(
        -4.15 + Math.cos(leaf * 1.05) * 0.15,
        0.95 + (leaf % 2) * 0.15,
        3.25 + Math.sin(leaf * 1.05) * 0.15
      );
      frond.rotation.z = Math.cos(leaf * 1.05) * 0.32;
      frond.rotation.x = Math.sin(leaf * 1.05) * 0.32;
      loungeGroup.add(frond);
    }
    loungeGroup.add(occPillar, planterPot);
    lobbyGroup.add(loungeGroup);

    // =========================================================================
    // 3D CAMERA PATH: STATE A, MIDPOINT HANDLE M, STATE B, VELOCITY TICKS & 4 GATES
    // =========================================================================
    const startProxy = new THREE.Object3D();
    const midProxy = new THREE.Object3D();
    const endProxy = new THREE.Object3D();
    const targetProxy = new THREE.Object3D();
    scene.add(startProxy, midProxy, endProxy, targetProxy);

    const startRigMesh = buildCinemaCameraRig(0x10b981, 0.65, 0.84);
    startProxy.add(startRigMesh);

    const endRigMesh = buildCinemaCameraRig(0xf59e0b, 0.65, 0.84);
    endProxy.add(endRigMesh);

    // Interactive Path Apex Waypoint M (Diamond Octahedron + Ring)
    const midVisual = new THREE.Group();
    const midDiamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.14, 0),
      new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0xc084fc,
        emissiveIntensity: 0.75,
        roughness: 0.2,
        metalness: 0.8,
      })
    );
    const midRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.016, 12, 32),
      new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        emissive: 0xd4af37,
        emissiveIntensity: 0.55,
      })
    );
    midRing.rotation.x = Math.PI / 2;
    midVisual.add(midDiamond, midRing);
    midProxy.add(midVisual);

    const activeRigGroup = buildCinemaCameraRig(0xd4af37, 1.0, 1.0);
    scene.add(activeRigGroup);

    const targetVisual = new THREE.Group();
    const targetSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 20, 20),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.9,
      })
    );
    const targetRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.02, 12, 32),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.6,
      })
    );
    targetVisual.add(targetSphere, targetRing);
    targetProxy.add(targetVisual);

    const pathMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      emissive: 0xd4af37,
      emissiveIntensity: 0.48,
      roughness: 0.25,
      metalness: 0.8,
    });
    disposables.push(pathMaterial);
    let trajectoryTubeMesh: THREE.Mesh | null = null;

    // 24 Velocity-Paced Path Interpolation Ticks (InstancedMesh > 20 repeated nodes)
    const tickCount = 24;
    const tickGeo = new THREE.SphereGeometry(0.036, 10, 10);
    const tickMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xd4af37,
      emissiveIntensity: 0.65,
    });
    disposables.push(tickGeo, tickMat);
    const velocityTicksInstanced = new THREE.InstancedMesh(tickGeo, tickMat, tickCount);
    velocityTicksInstanced.frustumCulled = false;
    scene.add(velocityTicksInstanced);

    // 4 Keyframe Spheres + 4 Mini Oriented Gate Frames (Kadr 01, 02, 03, 04)
    const keyframeNodes: THREE.Group[] = [];
    const kfDotGeo = new THREE.SphereGeometry(0.09, 16, 16);
    const kfDotMat = new THREE.MeshStandardMaterial({
      color: 0xfff3c4,
      emissive: 0xd4af37,
      emissiveIntensity: 0.85,
    });
    disposables.push(kfDotGeo, kfDotMat);
    for (let k = 0; k < 4; k++) {
      const g = new THREE.Group();
      const sphere = new THREE.Mesh(kfDotGeo, kfDotMat);
      const gate = buildMiniPathFrameGate(k === 0 ? 0x10b981 : k === 3 ? 0xf59e0b : 0xd4af37);
      g.add(sphere, gate);
      scene.add(g);
      keyframeNodes.push(g);
    }

    const frustumLineMat = new THREE.LineBasicMaterial({
      color: 0xd4af37,
      transparent: true,
      opacity: 0.72,
    });
    const sightRayMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.8,
    });
    disposables.push(frustumLineMat, sightRayMat);

    const frustumPositions = new Float32Array(16 * 3);
    const frustumGeo = new THREE.BufferGeometry();
    frustumGeo.setAttribute('position', new THREE.BufferAttribute(frustumPositions, 3));
    const frustumLines = new THREE.LineSegments(frustumGeo, frustumLineMat);
    activeRigGroup.add(frustumLines);

    const sightRayPositions = new Float32Array(6);
    const sightRayGeo = new THREE.BufferGeometry();
    sightRayGeo.setAttribute('position', new THREE.BufferAttribute(sightRayPositions, 3));
    const sightRayLine = new THREE.Line(sightRayGeo, sightRayMat);
    scene.add(sightRayLine);
    disposables.push(frustumGeo, sightRayGeo);

    const transformControls = new TransformControls(stageCamera, renderer.domElement);
    transformControls.setSize(0.78);
    transformControls.setMode('translate');
    const transformHelper =
      typeof (transformControls as any).getHelper === 'function'
        ? (transformControls as any).getHelper()
        : (transformControls as unknown as THREE.Object3D);
    scene.add(transformHelper);

    let activeGizmoMode: GizmoTargetMode = 'end';

    const attachGizmoByMode = (mode: GizmoTargetMode) => {
      activeGizmoMode = mode;
      transformControls.detach();
      if (mode === 'start') {
        transformControls.attach(startProxy);
      } else if (mode === 'mid') {
        transformControls.attach(midProxy);
      } else if (mode === 'end') {
        transformControls.attach(endProxy);
      } else if (mode === 'target') {
        transformControls.attach(targetProxy);
      }
    };

    const updateFrustumGeometry = (focalMm: number) => {
      const vFovRad = THREE.MathUtils.degToRad(focalNumberToVerticalFov(focalMm));
      const coneLen = 2.6;
      const halfH = Math.tan(vFovRad / 2) * coneLen;
      const halfW = halfH * (16 / 9);

      const c0 = [-halfW, halfH, -coneLen];
      const c1 = [halfW, halfH, -coneLen];
      const c2 = [halfW, -halfH, -coneLen];
      const c3 = [-halfW, -halfH, -coneLen];
      const orig = [0, 0, -0.35];

      const segs = [
        orig,
        c0,
        orig,
        c1,
        orig,
        c2,
        orig,
        c3,
        c0,
        c1,
        c1,
        c2,
        c2,
        c3,
        c3,
        c0,
      ];
      const attr = frustumGeo.getAttribute('position') as THREE.BufferAttribute;
      segs.forEach((pt, idx) => {
        attr.setXYZ(idx, pt[0], pt[1], pt[2]);
      });
      attr.needsUpdate = true;
      frustumGeo.computeBoundingSphere();
    };

    const rebuildTrajectoryGeometry = (b: CameraBlockingConfig) => {
      const s = b.startPose;
      const e = b.endPose;
      const ctrl = computePathControlPoint(b);

      _vStart.set(s.x, s.y, s.z);
      _vCtrl.set(ctrl.x, ctrl.y, ctrl.z);
      _vEnd.set(e.x, e.y, e.z);

      const curve = new THREE.QuadraticBezierCurve3(
        _vStart.clone(),
        _vCtrl.clone(),
        _vEnd.clone()
      );

      // Position midProxy right at the actual curve apex t = 0.5
      curve.getPoint(0.5, midProxy.position);

      if (trajectoryTubeMesh) {
        scene.remove(trajectoryTubeMesh);
        trajectoryTubeMesh.geometry.dispose();
      }
      const dist = _vStart.distanceTo(_vEnd);
      if (
        dist > 0.04 ||
        Math.abs(b.curveArcOffset) > 0.04 ||
        Math.abs(b.pathVerticalArc ?? 0) > 0.04
      ) {
        const tubeGeo = new THREE.TubeGeometry(curve, 44, 0.032, 10, false);
        trajectoryTubeMesh = new THREE.Mesh(tubeGeo, pathMaterial);
        scene.add(trajectoryTubeMesh);
      }

      // Update 24 velocity-spaced interpolation ticks along the path (reflecting Smoothing Factor)
      const smoothing =
        b.smoothingFactor ?? (b.easingStyle === 'linear_constant' ? 0 : 65);
      for (let i = 0; i < tickCount; i++) {
        const eased = evaluatePathEasing(
          i / (tickCount - 1),
          b.easingStyle,
          smoothing
        );
        curve.getPoint(eased, _vSample);
        _dummyObj.position.copy(_vSample);
        _dummyObj.rotation.set(0, 0, 0);
        _dummyObj.scale.setScalar(1);
        _dummyObj.updateMatrix();
        velocityTicksInstanced.setMatrixAt(i, _dummyObj.matrix);
      }
      velocityTicksInstanced.instanceMatrix.needsUpdate = true;
      velocityTicksInstanced.computeBoundingSphere();

      // Update the 4 sampled keyframe poses & oriented gate frames (0%, 33%, 67%, 100%)
      [0, 1 / 3, 2 / 3, 1].forEach((rawFrac, idx) => {
        const kfPose = interpolateBlockingPose(b, rawFrac);
        keyframeNodes[idx].position.set(kfPose.x, kfPose.y, kfPose.z);
        _eulerYXZ.set(
          THREE.MathUtils.degToRad(kfPose.tiltDeg),
          THREE.MathUtils.degToRad(kfPose.panDeg),
          THREE.MathUtils.degToRad(kfPose.rollDeg)
        );
        keyframeNodes[idx].quaternion.setFromEuler(_eulerYXZ);
      });
    };

    const syncSceneObjectsFromBlocking = () => {
      const b = blockingRef.current;

      startProxy.position.set(b.startPose.x, b.startPose.y, b.startPose.z);
      const startPan = b.lockFramingToTarget
        ? computeAnglesToTarget(b.startPose, b.targetPoint).panDeg
        : b.startPose.panDeg;
      const startTilt = b.lockFramingToTarget
        ? computeAnglesToTarget(b.startPose, b.targetPoint).tiltDeg
        : b.startPose.tiltDeg;
      _eulerYXZ.set(
        THREE.MathUtils.degToRad(startTilt),
        THREE.MathUtils.degToRad(startPan),
        THREE.MathUtils.degToRad(b.startPose.rollDeg)
      );
      startProxy.quaternion.setFromEuler(_eulerYXZ);

      endProxy.position.set(b.endPose.x, b.endPose.y, b.endPose.z);
      const endPan = b.lockFramingToTarget
        ? computeAnglesToTarget(b.endPose, b.targetPoint).panDeg
        : b.endPose.panDeg;
      const endTilt = b.lockFramingToTarget
        ? computeAnglesToTarget(b.endPose, b.targetPoint).tiltDeg
        : b.endPose.tiltDeg;
      _eulerYXZ.set(
        THREE.MathUtils.degToRad(endTilt),
        THREE.MathUtils.degToRad(endPan),
        THREE.MathUtils.degToRad(b.endPose.rollDeg)
      );
      endProxy.quaternion.setFromEuler(_eulerYXZ);

      targetProxy.position.set(b.targetPoint.x, b.targetPoint.y, b.targetPoint.z);

      rebuildTrajectoryGeometry(b);
    };

    const updateActivePlayheadCamera = () => {
      const b = blockingRef.current;
      const pose = interpolateBlockingPose(b, playheadRef.current);

      activeRigGroup.position.set(pose.x, pose.y, pose.z);
      _eulerYXZ.set(
        THREE.MathUtils.degToRad(pose.tiltDeg),
        THREE.MathUtils.degToRad(pose.panDeg),
        THREE.MathUtils.degToRad(pose.rollDeg)
      );
      activeRigGroup.quaternion.setFromEuler(_eulerYXZ);

      updateFrustumGeometry(pose.focalMm);

      lensCamera.position.copy(activeRigGroup.position);
      lensCamera.quaternion.copy(activeRigGroup.quaternion);
      const nextFov = focalNumberToVerticalFov(pose.focalMm);
      if (Math.abs(lensCamera.fov - nextFov) > 0.05) {
        lensCamera.fov = nextFov;
        lensCamera.updateProjectionMatrix();
      }

      const rayAttr = sightRayGeo.getAttribute('position') as THREE.BufferAttribute;
      rayAttr.setXYZ(0, pose.x, pose.y, pose.z);
      if (b.lockFramingToTarget) {
        rayAttr.setXYZ(1, b.targetPoint.x, b.targetPoint.y, b.targetPoint.z);
      } else {
        _vSample
          .set(0, 0, -5.2)
          .applyQuaternion(activeRigGroup.quaternion)
          .add(activeRigGroup.position);
        rayAttr.setXYZ(1, _vSample.x, _vSample.y, _vSample.z);
      }
      rayAttr.needsUpdate = true;
    };

    transformControls.addEventListener('dragging-changed', (ev: any) => {
      orbit.enabled = !ev.value;
    });

    transformControls.addEventListener('objectChange', () => {
      const cur = blockingRef.current;
      if (activeGizmoMode === 'start') {
        const clampedX = Number(THREE.MathUtils.clamp(startProxy.position.x, -4.8, 5.2).toFixed(2));
        const clampedY = Number(THREE.MathUtils.clamp(startProxy.position.y, 0.45, 3.3).toFixed(2));
        const clampedZ = Number(THREE.MathUtils.clamp(startProxy.position.z, -3.2, 5.8).toFixed(2));
        startProxy.position.set(clampedX, clampedY, clampedZ);
        onChangeBlockingRef.current({
          ...cur,
          activeShotPresetId: 'custom',
          startPose: { ...cur.startPose, x: clampedX, y: clampedY, z: clampedZ },
        });
      } else if (activeGizmoMode === 'mid') {
        // Invert Quadratic Bezier Apex P(0.5) = 0.25*S + 0.5*Ctrl + 0.25*E => Ctrl = 2*P(0.5) - 0.5*(S + E)
        const s = cur.startPose;
        const e = cur.endPose;
        const midLinearX = (s.x + e.x) * 0.5;
        const midLinearY = (s.y + e.y) * 0.5;
        const midLinearZ = (s.z + e.z) * 0.5;

        const desiredCtrlX = 2 * midProxy.position.x - midLinearX;
        const desiredCtrlY = 2 * midProxy.position.y - midLinearY;
        const desiredCtrlZ = 2 * midProxy.position.z - midLinearZ;

        const dx = e.x - s.x;
        const dz = e.z - s.z;
        const len = Math.hypot(dx, dz);
        const perpX = len > 0.001 ? -dz / len : 0;
        const perpZ = len > 0.001 ? dx / len : 1;

        const projLateral =
          (desiredCtrlX - midLinearX) * perpX + (desiredCtrlZ - midLinearZ) * perpZ;
        const clampedArc = Number(THREE.MathUtils.clamp(projLateral, -2.4, 2.4).toFixed(2));
        const clampedVert = Number(
          THREE.MathUtils.clamp(desiredCtrlY - midLinearY, -1.2, 1.2).toFixed(2)
        );

        onChangeBlockingRef.current({
          ...cur,
          activeShotPresetId: 'custom',
          curveArcOffset: clampedArc,
          pathVerticalArc: clampedVert,
        });
      } else if (activeGizmoMode === 'end') {
        const clampedX = Number(THREE.MathUtils.clamp(endProxy.position.x, -4.8, 5.2).toFixed(2));
        const clampedY = Number(THREE.MathUtils.clamp(endProxy.position.y, 0.45, 3.3).toFixed(2));
        const clampedZ = Number(THREE.MathUtils.clamp(endProxy.position.z, -3.2, 5.8).toFixed(2));
        endProxy.position.set(clampedX, clampedY, clampedZ);
        onChangeBlockingRef.current({
          ...cur,
          activeShotPresetId: 'custom',
          endPose: { ...cur.endPose, x: clampedX, y: clampedY, z: clampedZ },
        });
      } else if (activeGizmoMode === 'target') {
        const clampedX = Number(THREE.MathUtils.clamp(targetProxy.position.x, -5.5, 5.5).toFixed(2));
        const clampedY = Number(THREE.MathUtils.clamp(targetProxy.position.y, 0.2, 3.6).toFixed(2));
        const clampedZ = Number(THREE.MathUtils.clamp(targetProxy.position.z, -4.3, 4.5).toFixed(2));
        targetProxy.position.set(clampedX, clampedY, clampedZ);
        onChangeBlockingRef.current({
          ...cur,
          activeShotPresetId: 'custom',
          lockFramingToTarget: true,
          targetSubjectLabel: 'Własny punkt skupienia 3D',
          targetPoint: { x: clampedX, y: clampedY, z: clampedZ },
        });
      }
      requestRender();
    });

    syncSceneObjectsFromBlocking();
    updateActivePlayheadCamera();
    attachGizmoByMode('end');

    if (!isSoftwareGl) {
      renderer.compile(scene, stageCamera);
    }

    const drawDualViewports = () => {
      const cw = container.clientWidth || width;
      const ch = container.clientHeight || height;
      const swapped = swapMainWithLensRef.current;

      const setHelpersVisible = (vis: boolean) => {
        activeRigGroup.visible = vis;
        startProxy.visible = vis;
        midProxy.visible = vis;
        endProxy.visible = vis;
        targetProxy.visible = vis;
        sightRayLine.visible = vis;
        velocityTicksInstanced.visible = vis;
        transformHelper.visible = vis && activeGizmoMode !== 'none';
        if (trajectoryTubeMesh) trajectoryTubeMesh.visible = vis;
        keyframeNodes.forEach((n) => {
          n.visible = vis;
        });
      };

      renderer.setViewport(0, 0, cw, ch);
      renderer.setScissor(0, 0, cw, ch);
      if (!swapped) {
        setHelpersVisible(true);
        stageCamera.aspect = cw / ch;
        stageCamera.updateProjectionMatrix();
        renderer.render(scene, stageCamera);
      } else {
        setHelpersVisible(false);
        lensCamera.aspect = cw / ch;
        lensCamera.updateProjectionMatrix();
        renderer.render(scene, lensCamera);
      }

      const pipW = Math.round(Math.min(310, cw * 0.34));
      const pipH = Math.round((pipW * 9) / 16);
      const margin = 14;
      const pipX = cw - pipW - margin;
      const pipY = margin;

      if (cw > 520 && ch > 300) {
        renderer.setViewport(pipX, pipY, pipW, pipH);
        renderer.setScissor(pipX, pipY, pipW, pipH);
        renderer.clearDepth();

        if (!swapped) {
          setHelpersVisible(false);
          lensCamera.aspect = pipW / pipH;
          lensCamera.updateProjectionMatrix();
          renderer.render(scene, lensCamera);
          setHelpersVisible(true);
        } else {
          setHelpersVisible(true);
          stageCamera.aspect = pipW / pipH;
          stageCamera.updateProjectionMatrix();
          renderer.render(scene, stageCamera);
        }
      }
    };

    let frameId = 0;
    let lastTimestamp = performance.now();
    let renderBusy = false;
    let renderDirty = false;
    let loopRunning = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function requestRender() {
      if (isPlayingRef.current) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        orbit.update();
        updateActivePlayheadCamera();
        drawDualViewports();
        const done = () => {
          renderBusy = false;
          if (renderDirty) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    function tick() {
      if (!isPlayingRef.current) {
        loopRunning = false;
        return;
      }
      loopRunning = true;
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTimestamp) / 1000);
      lastTimestamp = now;

      const dur = Math.max(2, blockingRef.current.durationSec || 6);
      const nextT = (playheadRef.current + dt / dur) % 1;
      playheadRef.current = nextT;
      setPlayhead(nextT);

      orbit.update();
      updateActivePlayheadCamera();
      drawDualViewports();

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    function startPlayLoop() {
      if (loopRunning) return;
      lastTimestamp = performance.now();
      tick();
    }

    orbit.addEventListener('change', () => {
      if (!isPlayingRef.current) requestRender();
    });

    const handleResize = () => {
      if (!container) return;
      const nw = Math.max(320, container.clientWidth);
      const nh = Math.max(300, container.clientHeight);
      renderer.setSize(nw, nh);
      if (!isPlayingRef.current) requestRender();
    };
    window.addEventListener('resize', handleResize);

    sceneApiRef.current = {
      requestRender,
      startPlayLoop,
      syncFromBlocking: () => {
        syncSceneObjectsFromBlocking();
        updateActivePlayheadCamera();
        if (!isPlayingRef.current) requestRender();
      },
      setGizmoTarget: (mode: GizmoTargetMode) => {
        attachGizmoByMode(mode);
        if (!isPlayingRef.current) requestRender();
      },
      applyStageViewPreset: (preset: StageCameraPreset) => {
        if (preset === 'director_iso') {
          stageCamera.position.set(6.4, 5.4, 8.2);
          orbit.target.set(-0.2, 1.25, -0.5);
        } else if (preset === 'top_floorplan') {
          stageCamera.position.set(0.0, 12.2, 0.4);
          orbit.target.set(0.0, 0.5, 0.2);
        } else if (preset === 'window_side') {
          stageCamera.position.set(-4.6, 2.5, 7.6);
          orbit.target.set(1.1, 1.4, -1.8);
        }
        orbit.update();
        if (!isPlayingRef.current) requestRender();
      },
      exportPrevizWebP: () => {
        orbit.update();
        updateActivePlayheadCamera();
        drawDualViewports();
        renderer.domElement.toBlob(
          (blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bujok-sciezka-3d-kamery-${blockingRef.current.focalLengthMm}mm.webp`;
            a.click();
          },
          'image/webp',
          0.9
        );
      },
    };

    if (isPlayingRef.current) {
      startPlayLoop();
    } else {
      requestRender();
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      transformControls.detach();
      transformControls.dispose();
      orbit.dispose();
      if (trajectoryTubeMesh) trajectoryTubeMesh.geometry.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    sceneApiRef.current?.syncFromBlocking();
  }, [blocking]);

  useEffect(() => {
    if (isPlaying) {
      sceneApiRef.current?.startPlayLoop();
    } else {
      sceneApiRef.current?.requestRender();
    }
  }, [isPlaying, playhead, swapMainWithLens]);

  const handleSelectShotPreset = (preset: CinematicNarrativeShotPreset) => {
    onChangeBlocking({
      activeShotPresetId: preset.id,
      startPose: { ...preset.blocking.startPose },
      endPose: { ...preset.blocking.endPose },
      curveArcOffset: preset.blocking.curveArcOffset,
      pathVerticalArc: preset.blocking.pathVerticalArc ?? 0,
      focalLengthMm: preset.blocking.focalLengthMm,
      endFocalLengthMm:
        preset.blocking.endFocalLengthMm ?? preset.blocking.focalLengthMm,
      lockFramingToTarget: preset.blocking.lockFramingToTarget,
      targetSubjectLabel: preset.blocking.targetSubjectLabel,
      targetPoint: { ...preset.blocking.targetPoint },
      durationSec: preset.blocking.durationSec,
      easingStyle: preset.blocking.easingStyle,
      smoothingFactor:
        preset.blocking.smoothingFactor ??
        (preset.blocking.easingStyle === 'linear_constant' ? 0 : 65),
      pathEnabledInSequence: true,
    });
    setPlayhead(0);
    setIsPlaying(true);
  };

  const updatePoseField = (
    which: 'startPose' | 'endPose',
    field: keyof CameraRigKeyframePose,
    value: number
  ) => {
    const next: CameraBlockingConfig = {
      ...blocking,
      activeShotPresetId: 'custom',
      lockFramingToTarget:
        field === 'panDeg' || field === 'tiltDeg' ? false : blocking.lockFramingToTarget,
      [which]: {
        ...blocking[which],
        [field]: value,
      },
    };
    onChangeBlocking(next);
  };

  const handleCapturePlayheadAsState = (targetState: 'A' | 'B') => {
    const snappedPose: CameraRigKeyframePose = {
      x: Number(currentLivePose.x.toFixed(2)),
      y: Number(currentLivePose.y.toFixed(2)),
      z: Number(currentLivePose.z.toFixed(2)),
      panDeg: Number(currentLivePose.panDeg.toFixed(1)),
      tiltDeg: Number(currentLivePose.tiltDeg.toFixed(1)),
      rollDeg: Number(currentLivePose.rollDeg.toFixed(1)),
    };
    if (targetState === 'A') {
      onChangeBlocking({
        ...blocking,
        activeShotPresetId: 'custom',
        startPose: snappedPose,
      });
      setPlayhead(0);
    } else {
      onChangeBlocking({
        ...blocking,
        activeShotPresetId: 'custom',
        endPose: snappedPose,
      });
      setPlayhead(1);
    }
    setIsPlaying(false);
    setCapturedStateFeedback(targetState);
    window.setTimeout(() => setCapturedStateFeedback(null), 1800);
  };

  const handleReverseCameraPath = () => {
    const startFocal = blocking.focalLengthMm;
    const endFocal = blocking.endFocalLengthMm ?? startFocal;
    onChangeBlocking({
      ...blocking,
      activeShotPresetId: 'custom',
      startPose: { ...blocking.endPose },
      endPose: { ...blocking.startPose },
      focalLengthMm: endFocal,
      endFocalLengthMm: startFocal,
      // Invert horizontal perpendicular offset so the physical curve in 3D space stays identical when reversed
      curveArcOffset: Number((-blocking.curveArcOffset).toFixed(2)),
    });
  };

  const handleSelectAnchorTarget = (anchor: (typeof ARCHITECTURAL_ANCHOR_TARGETS)[number]) => {
    const startAngles = computeAnglesToTarget(blocking.startPose, anchor.point);
    const endAngles = computeAnglesToTarget(blocking.endPose, anchor.point);
    onChangeBlocking({
      ...blocking,
      lockFramingToTarget: true,
      targetSubjectLabel: anchor.label,
      targetPoint: { ...anchor.point },
      startPose: {
        ...blocking.startPose,
        panDeg: startAngles.panDeg,
        tiltDeg: startAngles.tiltDeg,
      },
      endPose: {
        ...blocking.endPose,
        panDeg: endAngles.panDeg,
        tiltDeg: endAngles.tiltDeg,
      },
    });
  };

  const handleCopyDirectorBrief = () => {
    navigator.clipboard.writeText(directorBrief.fullBriefPL);
    setCopiedBrief(true);
    window.setTimeout(() => setCopiedBrief(false), 2200);
  };

  const effectiveEndFocal = blocking.endFocalLengthMm ?? blocking.focalLengthMm;
  const effectiveSmoothingFactor = Math.round(
    blocking.smoothingFactor ??
      (blocking.easingStyle === 'linear_constant' ? 0 : 65)
  );

  const smoothingIntensityLabel =
    effectiveSmoothingFactor === 0
      ? 'Liniowy (0%)'
      : effectiveSmoothingFactor < 40
        ? 'Subtelny'
        : effectiveSmoothingFactor < 75
          ? 'Kinowy'
          : 'Głębokie wyhamowanie';

  const easingCurveSvgPoints = useMemo(() => {
    const pts: string[] = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const v = evaluatePathEasing(
        u,
        blocking.easingStyle,
        effectiveSmoothingFactor
      );
      const px = (2 + u * 52).toFixed(1);
      const py = (20 - v * 16).toFixed(1);
      pts.push(`${px},${py}`);
    }
    return pts.join(' ');
  }, [blocking.easingStyle, effectiveSmoothingFactor]);

  return (
    <div className="space-y-6">
      {/* Header & Primary Path -> 4-Frame Video Actions */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-2xl font-serif-display font-semibold text-white">
            Makieta 3D, Ścieżka Kamery (Stan A → Stan B) i Animacja w 4 Kadrach
          </h2>
          <p className="text-xs text-[#a9a396] mt-1">
            Zdefiniuj ścieżkę pomiędzy dwoma stanami kamery (Stan A → Punkt M → Stan B), wybierz profil interpolacji i wygeneruj płynną animację ruchu kamery w sekwencji 4 kadrów wideo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyDirectorBrief}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#171b24] hover:bg-[#232938] border border-white/14 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedBrief ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Skopiowano specyfikację!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Kopiuj specyfikację dla Reżysera</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => sceneApiRef.current?.exportPrevizWebP()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#171b24] hover:bg-[#232938] border border-white/14 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Karta 3D (.webp)</span>
          </button>

          <button
            type="button"
            onClick={() => onSendBriefToDirectorChat(directorBrief.fullBriefPL)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#171b24] hover:bg-[#232938] border border-[#d4af37]/50 text-xs font-semibold text-[#f4f1ea] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Wyślij ścieżkę do Reżysera AI</span>
          </button>

          <button
            type="button"
            disabled={isGeneratingPathVideo}
            onClick={() =>
              onGenerateSmoothPathVideo(
                directorBrief.fourFramePrompts,
                activePreset?.promptPL || directorBrief.fullBriefPL,
                false
              )
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] disabled:opacity-50 text-xs font-semibold text-[#090a0d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isGeneratingPathVideo ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>
                  Interpolacja ścieżki: Kadr 0{activePathCompilingFrame}/04 ({pathVideoProgress}%)
                </span>
              </>
            ) : (
              <>
                <Film className="w-3.5 h-3.5" />
                <span>Generuj Płynną Animację Ścieżki (4 Kadry MP4)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Split: Left 3D Stage & Path Timeline | Right Two-State Camera Path Builder */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* LEFT COLUMN (7 cols): Interactive 3D Stage Viewport + Path Scrubber */}
        <div className="xl:col-span-7 flex flex-col gap-3">
          {/* Top 3D Path Gizmo Selector & Stage Angle Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#12151e] border border-white/10 px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-[#9e988c] mr-1 whitespace-nowrap">
                Edytuj na modelu 3D:
              </span>
              {(
                [
                  { id: 'start', label: 'Stan A (Start)' },
                  { id: 'mid', label: 'Ścieżka M (Łuk)' },
                  { id: 'end', label: 'Stan B (Koniec)' },
                  { id: 'target', label: 'Cel Kadru' },
                  { id: 'none', label: 'Obrót 3D' },
                ] as const
              ).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setGizmoMode(g.id);
                    sceneApiRef.current?.setGizmoTarget(g.id);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    gizmoMode === g.id
                      ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                      : 'bg-[#090a0d] text-[#cbc5b8] hover:text-white border border-white/10'
                  }`}
                >
                  <Move3d className="w-3 h-3" />
                  <span>{g.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'director_iso', label: 'Izo 3D' },
                  { id: 'top_floorplan', label: 'Rzut z góry' },
                  { id: 'window_side', label: 'Od okien' },
                ] as const
              ).map((vp) => (
                <button
                  key={vp.id}
                  type="button"
                  onClick={() => {
                    setStagePreset(vp.id);
                    setSwapMainWithLens(false);
                    sceneApiRef.current?.applyStageViewPreset(vp.id);
                  }}
                  className={`px-2 py-1 rounded-md text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    stagePreset === vp.id && !swapMainWithLens
                      ? 'bg-white/16 text-white font-semibold'
                      : 'bg-[#090a0d] text-[#9e988c] hover:text-white border border-white/8'
                  }`}
                >
                  {vp.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setSwapMainWithLens((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  swapMainWithLens
                    ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                    : 'bg-[#090a0d] text-[#d4af37] hover:text-white border border-[#d4af37]/40'
                }`}
              >
                <Maximize2 className="w-3 h-3" />
                <span>{swapMainWithLens ? 'Makieta 3D' : 'Wizjer'}</span>
              </button>
            </div>
          </div>

          {/* Isolated Three.js WebGL Container (Zero backdrop-filter overlays!) */}
          <div className="relative w-full h-[440px] rounded-xl overflow-hidden border border-white/15 bg-[#0d1017]">
            <div ref={canvasMountRef} className="w-full h-full" />

            {/* Top-Left Live Interpolated Path Telemetry Readout */}
            <div className="absolute top-3 left-3 z-10 pointer-events-none rounded-lg bg-[#090a0d]/92 border border-white/12 px-3 py-2 text-[11px] space-y-0.5">
              <div className="text-[#d4af37] font-semibold">
                {swapMainWithLens
                  ? `WIZJER ŚCIEŻKI (${currentLivePose.focalMm.toFixed(0)}mm · Eased ${(currentLivePose.easedT * 100).toFixed(0)}% · Smooth ${effectiveSmoothingFactor}%)`
                  : `ŚCIEŻKA 3D: STAN A → PUNKT M → STAN B (${directorBrief.travelDistanceMeters} m · Smooth ${effectiveSmoothingFactor}%)`}
              </div>
              <div className="text-[#dcd7cc] font-mono-tabular">
                Pozycja(t): X={currentLivePose.x.toFixed(2)}m · Y={currentLivePose.y.toFixed(2)}m · Z=
                {currentLivePose.z.toFixed(2)}m
              </div>
              <div className="text-[#9e988c] font-mono-tabular">
                Rotacja(t): Pan {currentLivePose.panDeg.toFixed(1)}° · Tilt{' '}
                {currentLivePose.tiltDeg.toFixed(1)}° · Roll {currentLivePose.rollDeg.toFixed(1)}° ·{' '}
                {currentLivePose.focalMm.toFixed(0)}mm
              </div>
            </div>

            {/* Bottom-Right Label above Picture-in-Picture Viewfinder */}
            <div
              className="absolute right-3.5 z-10 pointer-events-none rounded bg-[#090a0d]/92 border border-[#d4af37]/40 px-2.5 py-1 text-[10px] font-mono-tabular text-[#f4f1ea]"
              style={{ bottom: '194px' }}
            >
              {swapMainWithLens
                ? 'PODGLĄD ŚCIEŻKI 3D (PIP)'
                : `WIZJER INTERPOLACJI ŚCIEŻKI · ${currentLivePose.focalMm.toFixed(0)}mm`}
            </div>
          </div>

          {/* Path Scrubber, Capture State A/B & 4-Frame Path Milestones */}
          <div className="rounded-xl bg-[#12151e] border border-white/10 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Wstrzymaj ścieżkę</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Odtwórz ścieżkę (A → B)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleCapturePlayheadAsState('A')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#090a0d] hover:bg-white/10 border border-emerald-500/40 text-[11px] font-medium text-emerald-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Zapisz aktualną pozycję kamery na osi czasu jako Stan Początkowy A (0%)"
                >
                  <Pin className="w-3 h-3" />
                  <span>
                    {capturedStateFeedback === 'A' ? 'Zapisano Stan A!' : 'Zapisz jako Stan A'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCapturePlayheadAsState('B')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#090a0d] hover:bg-white/10 border border-amber-500/40 text-[11px] font-medium text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Zapisz aktualną pozycję kamery na osi czasu jako Stan Końcowy B (100%)"
                >
                  <Pin className="w-3 h-3" />
                  <span>
                    {capturedStateFeedback === 'B' ? 'Zapisano Stan B!' : 'Zapisz jako Stan B'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleReverseCameraPath}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#090a0d] hover:bg-white/10 border border-white/14 text-[11px] text-[#e5dec9] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Zamień miejscami Stan A i Stan B (odwróć kierunek ruchu kamery na ścieżce)"
                >
                  <ArrowLeftRight className="w-3 h-3 text-[#d4af37]" />
                  <span>Odwróć A ↔ B</span>
                </button>
              </div>

              <span className="text-xs text-[#cbc5b8] font-mono-tabular">
                t = {Math.round(playhead * 100)}% ({(playhead * blocking.durationSec).toFixed(1)}s /{' '}
                {blocking.durationSec}s)
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(playhead * 100)}
              onChange={(e) => {
                setIsPlaying(false);
                setPlayhead(Number(e.target.value) / 100);
              }}
              className="studio-slider w-full"
            />

            {/* 4 Sampled Path Keyframe Milestones (0% -> 33% -> 67% -> 100%) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {sampledFourStates.map((st, idx) => {
                const frac = idx / 3;
                const isNear = !isPlaying && Math.abs(playhead - frac) < 0.05;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setPlayhead(frac);
                    }}
                    className={`text-left rounded-lg px-2.5 py-2 border transition-colors cursor-pointer ${
                      isNear
                        ? 'bg-[#d4af37]/18 border-[#d4af37] text-white'
                        : 'bg-[#090a0d] border-white/10 text-[#cbc5b8] hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono-tabular">
                      <span className="text-[#d4af37] font-semibold">
                        KADR 0{idx + 1} ({Math.round(frac * 100)}%)
                      </span>
                      <span>{st.focalMm.toFixed(0)}mm</span>
                    </div>
                    <div className="text-[10px] font-mono-tabular text-[#9e988c] mt-0.5 truncate">
                      ({st.x.toFixed(1)}, {st.y.toFixed(1)}, {st.z.toFixed(1)})m · Pan{' '}
                      {st.panDeg.toFixed(0)}°
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5 cols): Two-State Camera Path Definition & Interpolation Settings */}
        <div className="xl:col-span-5 rounded-xl bg-[#12151e] border border-white/10 p-4 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            {/* 1. Path Interpolation Curve, Duration & Focal Length State A -> B */}
            <div className="space-y-2.5 pb-3 border-b border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Interpolacja ścieżki, czas i ogniskowa (Stan A → Stan B)</span>
                </span>
                <span className="text-[11px] font-mono-tabular text-[#d4af37]">
                  HFOV ~{focalLengthToHorizontalFov(blocking.focalLengthMm)}° → ~
                  {focalLengthToHorizontalFov(effectiveEndFocal)}°
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] text-[#9e988c] mb-1">
                    Krzywa prędkości interpolacji ścieżki:
                  </label>
                  <select
                    value={blocking.easingStyle}
                    onChange={(e) => {
                      const nextStyle = e.target.value as PathEasingStyle;
                      const nextSmoothing =
                        nextStyle === 'linear_constant'
                          ? 0
                          : effectiveSmoothingFactor === 0
                            ? 65
                            : effectiveSmoothingFactor;
                      onChangeBlocking({
                        ...blocking,
                        easingStyle: nextStyle,
                        smoothingFactor: nextSmoothing,
                      });
                    }}
                    className="w-full rounded-lg bg-[#090a0d] border border-white/12 px-2.5 py-1.5 text-xs text-white"
                  >
                    {PATH_EASING_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-[#9e988c] mb-1">
                    Czas ruchu (4 kadry):
                  </label>
                  <select
                    value={blocking.durationSec}
                    onChange={(e) =>
                      onChangeBlocking({
                        ...blocking,
                        durationSec: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg bg-[#090a0d] border border-white/12 px-2.5 py-1.5 text-xs text-white font-mono-tabular"
                  >
                    <option value={4}>4 sekundy</option>
                    <option value={6}>6 sekund</option>
                    <option value={8}>8 sekund</option>
                    <option value={12}>12 sekund</option>
                  </select>
                </div>
              </div>

              {/* Smoothing Factor Slider (Easing Intensity between Defined Keyframe States) */}
              <div className="rounded-lg bg-[#090a0d] border border-white/10 px-3 py-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="camera-path-smoothing-slider"
                    className="text-[11px] font-medium text-[#eae6dc]"
                  >
                    Współczynnik wygładzania (Smoothing Factor)
                  </label>
                  <div className="flex items-center gap-2 shrink-0">
                    <svg
                      width="56"
                      height="22"
                      viewBox="0 0 56 22"
                      aria-hidden="true"
                      className="rounded bg-[#12151e] border border-white/10"
                    >
                      <line
                        x1="2"
                        y1="20"
                        x2="54"
                        y2="4"
                        stroke="rgba(255,255,255,0.18)"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                      <polyline
                        fill="none"
                        stroke="#d4af37"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={easingCurveSvgPoints}
                      />
                    </svg>
                    <span className="text-[11px] font-mono-tabular text-[#d4af37]">
                      {effectiveSmoothingFactor}% · {smoothingIntensityLabel}
                    </span>
                  </div>
                </div>
                <input
                  id="camera-path-smoothing-slider"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={effectiveSmoothingFactor}
                  onChange={(e) => {
                    const nextVal = Number(e.target.value);
                    onChangeBlocking({
                      ...blocking,
                      smoothingFactor: nextVal,
                    });
                  }}
                  className="studio-slider w-full"
                />
                <div className="flex justify-between text-[10px] text-[#8e887c] font-mono-tabular">
                  <span>0% (Stałe tempo)</span>
                  <span>50% (Standard S-Curve)</span>
                  <span>100% (Miękki start / stop)</span>
                </div>
              </div>

              {/* Per-state Focal Length (State A mm -> State B mm) */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="block text-[10px] text-emerald-400 mb-1">
                    Ogniskowa Stan A (Start):
                  </span>
                  <div className="grid grid-cols-5 gap-1">
                    {FOCAL_LENGTHS.map((mm) => (
                      <button
                        key={`fa_${mm}`}
                        type="button"
                        onClick={() =>
                          onChangeBlocking({
                            ...blocking,
                            focalLengthMm: mm,
                            endFocalLengthMm: blocking.endFocalLengthMm ?? mm,
                          })
                        }
                        className={`py-1 rounded text-[11px] font-mono-tabular cursor-pointer ${
                          blocking.focalLengthMm === mm
                            ? 'bg-emerald-500 text-[#090a0d] font-semibold'
                            : 'bg-[#090a0d] text-[#cbc5b8] hover:text-white border border-white/10'
                        }`}
                      >
                        {mm}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] text-amber-400 mb-1">
                    Ogniskowa Stan B (Koniec):
                  </span>
                  <div className="grid grid-cols-5 gap-1">
                    {FOCAL_LENGTHS.map((mm) => (
                      <button
                        key={`fb_${mm}`}
                        type="button"
                        onClick={() =>
                          onChangeBlocking({
                            ...blocking,
                            endFocalLengthMm: mm,
                          })
                        }
                        className={`py-1 rounded text-[11px] font-mono-tabular cursor-pointer ${
                          effectiveEndFocal === mm
                            ? 'bg-amber-400 text-[#090a0d] font-semibold'
                            : 'bg-[#090a0d] text-[#cbc5b8] hover:text-white border border-white/10'
                        }`}
                      >
                        {mm}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="inline-flex items-center gap-2 text-xs text-[#eae6dc] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blocking.lockFramingToTarget}
                    onChange={(e) =>
                      onChangeBlocking({
                        ...blocking,
                        lockFramingToTarget: e.target.checked,
                      })
                    }
                    className="accent-[#d4af37]"
                  />
                  <span>Ryglowanie kierunku kadrowania na obiekcie 3D wzdłuż całej ścieżki</span>
                </label>

                <select
                  value={
                    ARCHITECTURAL_ANCHOR_TARGETS.find(
                      (a) => a.label === blocking.targetSubjectLabel
                    )?.id || 'custom'
                  }
                  onChange={(e) => {
                    const found = ARCHITECTURAL_ANCHOR_TARGETS.find(
                      (a) => a.id === e.target.value
                    );
                    if (found) handleSelectAnchorTarget(found);
                  }}
                  className="w-full rounded-lg bg-[#090a0d] border border-white/12 px-3 py-1.5 text-xs text-white"
                >
                  {ARCHITECTURAL_ANCHOR_TARGETS.map((anc) => (
                    <option key={anc.id} value={anc.id}>
                      Cel kadrowania: {anc.label}
                    </option>
                  ))}
                  <option value="custom">
                    Własny punkt 3D ({blocking.targetPoint.x}m, {blocking.targetPoint.y}m,{' '}
                    {blocking.targetPoint.z}m)
                  </option>
                </select>
              </div>
            </div>

            {/* 2. Camera States A & B Spatial Coordinates + 3D Path Waypoint Curvature */}
            <div className="space-y-2.5 pb-3 border-b border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Ścieżka 3D pomiędzy dwoma stanami kamery (A → B)</span>
                </span>
                <span className="text-[11px] font-mono-tabular text-emerald-400">
                  Dystans: {directorBrief.travelDistanceMeters} m
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px]">
                {/* State A */}
                <div className="rounded-lg bg-[#090a0d] border border-emerald-500/30 p-2.5 space-y-1.5">
                  <div className="font-semibold text-emerald-400">
                    STAN KAMERY A (0% START)
                  </div>
                  <div>
                    <div className="flex justify-between text-[#cbc5b8]">
                      <span>X (Boczny)</span>
                      <span className="font-mono-tabular">{blocking.startPose.x} m</span>
                    </div>
                    <input
                      type="range"
                      min={-4.8}
                      max={4.8}
                      step={0.05}
                      value={blocking.startPose.x}
                      onChange={(e) =>
                        updatePoseField('startPose', 'x', Number(e.target.value))
                      }
                      className="studio-slider w-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[#cbc5b8]">
                      <span>Y (Wysokość)</span>
                      <span className="font-mono-tabular">{blocking.startPose.y} m</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={3.2}
                      step={0.05}
                      value={blocking.startPose.y}
                      onChange={(e) =>
                        updatePoseField('startPose', 'y', Number(e.target.value))
                      }
                      className="studio-slider w-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[#cbc5b8]">
                      <span>Z (Głębia)</span>
                      <span className="font-mono-tabular">{blocking.startPose.z} m</span>
                    </div>
                    <input
                      type="range"
                      min={-2.5}
                      max={5.5}
                      step={0.05}
                      value={blocking.startPose.z}
                      onChange={(e) =>
                        updatePoseField('startPose', 'z', Number(e.target.value))
                      }
                      className="studio-slider w-full"
                    />
                  </div>
                </div>

                {/* State B */}
                <div className="rounded-lg bg-[#090a0d] border border-amber-500/30 p-2.5 space-y-1.5">
                  <div className="font-semibold text-amber-400">
                    STAN KAMERY B (100% KONIEC)
                  </div>
                  <div>
                    <div className="flex justify-between text-[#cbc5b8]">
                      <span>X (Boczny)</span>
                      <span className="font-mono-tabular">{blocking.endPose.x} m</span>
                    </div>
                    <input
                      type="range"
                      min={-4.8}
                      max={4.8}
                      step={0.05}
                      value={blocking.endPose.x}
                      onChange={(e) =>
                        updatePoseField('endPose', 'x', Number(e.target.value))
                      }
                      className="studio-slider w-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[#cbc5b8]">
                      <span>Y (Wysokość)</span>
                      <span className="font-mono-tabular">{blocking.endPose.y} m</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={3.2}
                      step={0.05}
                      value={blocking.endPose.y}
                      onChange={(e) =>
                        updatePoseField('endPose', 'y', Number(e.target.value))
                      }
                      className="studio-slider w-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[#cbc5b8]">
                      <span>Z (Głębia)</span>
                      <span className="font-mono-tabular">{blocking.endPose.z} m</span>
                    </div>
                    <input
                      type="range"
                      min={-2.5}
                      max={5.5}
                      step={0.05}
                      value={blocking.endPose.z}
                      onChange={(e) =>
                        updatePoseField('endPose', 'z', Number(e.target.value))
                      }
                      className="studio-slider w-full"
                    />
                  </div>
                </div>
              </div>

              {/* 3D Path Waypoint M Curvature (Horizontal Arc + Vertical Crane Arc) */}
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <div className="flex justify-between text-[#cbc5b8]">
                    <span>Łuk poziomy ścieżki (M)</span>
                    <span className="font-mono-tabular text-[#d4af37]">
                      {blocking.curveArcOffset >= 0 ? '+' : ''}
                      {blocking.curveArcOffset.toFixed(2)} m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-2.2}
                    max={2.2}
                    step={0.05}
                    value={blocking.curveArcOffset}
                    onChange={(e) =>
                      onChangeBlocking({
                        ...blocking,
                        activeShotPresetId: 'custom',
                        curveArcOffset: Number(e.target.value),
                      })
                    }
                    className="studio-slider w-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[#cbc5b8]">
                    <span>Łuk pionowy kranu (M)</span>
                    <span className="font-mono-tabular text-[#d4af37]">
                      {(blocking.pathVerticalArc ?? 0) >= 0 ? '+' : ''}
                      {(blocking.pathVerticalArc ?? 0).toFixed(2)} m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-1.0}
                    max={1.0}
                    step={0.05}
                    value={blocking.pathVerticalArc ?? 0}
                    onChange={(e) =>
                      onChangeBlocking({
                        ...blocking,
                        activeShotPresetId: 'custom',
                        pathVerticalArc: Number(e.target.value),
                      })
                    }
                    className="studio-slider w-full"
                  />
                </div>
              </div>
            </div>

            {/* 3. Interpolated 3-Axis Rotation (Pan / Tilt / Roll between State A and State B) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Rotacja głowicy Stan A → Stan B (Pan · Tilt · Roll)</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChangeBlocking({
                      ...blocking,
                      startPose: { ...blocking.startPose, rollDeg: 0 },
                      endPose: { ...blocking.endPose, rollDeg: 0 },
                    })
                  }
                  className="inline-flex items-center gap-1 text-[11px] text-[#9e988c] hover:text-white cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Poziomuj Roll 0°</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="space-y-1">
                  <div className="flex justify-between text-[#cbc5b8]">
                    <span>Pan A → B (°)</span>
                    <span className="font-mono-tabular text-[#d4af37]">
                      {blocking.startPose.panDeg}° → {blocking.endPose.panDeg}°
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="range"
                      min={-120}
                      max={120}
                      step={1}
                      value={blocking.startPose.panDeg}
                      onChange={(e) =>
                        updatePoseField('startPose', 'panDeg', Number(e.target.value))
                      }
                      className="studio-slider w-1/2"
                    />
                    <input
                      type="range"
                      min={-120}
                      max={120}
                      step={1}
                      value={blocking.endPose.panDeg}
                      onChange={(e) =>
                        updatePoseField('endPose', 'panDeg', Number(e.target.value))
                      }
                      className="studio-slider w-1/2"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[#cbc5b8]">
                    <span>Tilt A → B (°)</span>
                    <span className="font-mono-tabular text-[#d4af37]">
                      {blocking.startPose.tiltDeg}° → {blocking.endPose.tiltDeg}°
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="range"
                      min={-35}
                      max={35}
                      step={1}
                      value={blocking.startPose.tiltDeg}
                      onChange={(e) =>
                        updatePoseField('startPose', 'tiltDeg', Number(e.target.value))
                      }
                      className="studio-slider w-1/2"
                    />
                    <input
                      type="range"
                      min={-35}
                      max={35}
                      step={1}
                      value={blocking.endPose.tiltDeg}
                      onChange={(e) =>
                        updatePoseField('endPose', 'tiltDeg', Number(e.target.value))
                      }
                      className="studio-slider w-1/2"
                    />
                  </div>
                </div>
              </div>

              <div className="text-[11px]">
                <div className="flex justify-between text-[#cbc5b8]">
                  <span>Roll / Przechył osiowy A → B (°)</span>
                  <span className="font-mono-tabular text-[#d4af37]">
                    {blocking.startPose.rollDeg}° → {blocking.endPose.rollDeg}°
                  </span>
                </div>
                <div className="flex gap-2 mt-1">
                  <input
                    type="range"
                    min={-25}
                    max={25}
                    step={0.5}
                    value={blocking.startPose.rollDeg}
                    onChange={(e) =>
                      updatePoseField('startPose', 'rollDeg', Number(e.target.value))
                    }
                    className="studio-slider w-1/2"
                  />
                  <input
                    type="range"
                    min={-25}
                    max={25}
                    step={0.5}
                    value={blocking.endPose.rollDeg}
                    onChange={(e) =>
                      updatePoseField('endPose', 'rollDeg', Number(e.target.value))
                    }
                    className="studio-slider w-1/2"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sync Path Keyframes Only vs Full MP4 Path Synthesis */}
          <div className="rounded-lg bg-[#090a0d] border border-[#d4af37]/35 p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] text-[#dcd7cc]">
              <strong className="text-[#d4af37] block">
                Synchronizacja Ścieżki z Sekwencją 4 Kadrów
              </strong>
              Próbkuje ścieżkę w punktach 0%, 33%, 67%, 100% i tworzy płynną animację 30 kl./s.
            </div>
            <button
              type="button"
              onClick={async () => {
                await onApplyToFourFrames(
                  directorBrief.fourFramePrompts,
                  activePreset?.promptPL || directorBrief.fullBriefPL
                );
                setAppliedToFramesToast(true);
                window.setTimeout(() => setAppliedToFramesToast(false), 2400);
              }}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/16 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {appliedToFramesToast
                ? 'Zaktualizowano 4 Kadry!'
                : 'Przekaż 4 Kadry do Studia Wideo'}
            </button>
          </div>
        </div>
      </div>

      {/* INLINE GENERATED SMOOTH CAMERA PATH 4-FRAME SEQUENCE & MP4 VIDEO PREVIEW */}
      {(isGeneratingPathVideo || generatedPathVideoUrl || keyframes.length === 4) && (
        <div className="rounded-2xl bg-[#12151e] border border-[#d4af37]/40 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-serif-display font-semibold text-white">
                Podgląd Płynnej Animacji Ruchu Kamery w Sekwencji 4 Kadrów (Stan A → Stan B)
              </h3>
              <p className="text-xs text-[#9e988c]">
                Cztery kluczowe fazy ścieżki (0% · 33% · 67% · 100%) połączone ciągłą interpolacją ruchu kamery w strumieniu MP4.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isGeneratingPathVideo}
                onClick={() =>
                  onGenerateSmoothPathVideo(
                    directorBrief.fourFramePrompts,
                    activePreset?.promptPL || directorBrief.fullBriefPL,
                    false
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] disabled:opacity-50 text-xs font-semibold text-[#090a0d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isGeneratingPathVideo ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Renderowanie ścieżki ({pathVideoProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Film className="w-3.5 h-3.5" />
                    <span>Wyrenderuj animację ścieżki (MP4)</span>
                  </>
                )}
              </button>

              {generatedPathVideoUrl && (
                <a
                  href={generatedPathVideoUrl}
                  download={`bujok-animacja-sciezki-3d-${blocking.durationSec}s.mp4`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#181c26] hover:bg-[#232938] border border-white/15 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>
                    Pobierz MP4
                    {generatedPathVideoSize
                      ? ` (${formatBytes(generatedPathVideoSize)})`
                      : ''}
                  </span>
                </a>
              )}
            </div>
          </div>

          {isGeneratingPathVideo && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono-tabular text-[#d4af37]">
                <span>
                  Interpolacja 30fps wzdłuż ścieżki A→B · Aktywny Kadr 0
                  {activePathCompilingFrame}/04
                </span>
                <span>{pathVideoProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#090a0d] overflow-hidden border border-white/10">
                <div
                  className="h-full bg-[#d4af37] transition-all duration-150"
                  style={{ width: `${pathVideoProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* 4 Sampled Path Keyframe Preview Strip */}
          {keyframes.length >= 4 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {keyframes.slice(0, 4).map((kf, idx) => (
                <div
                  key={kf.id}
                  onClick={() => {
                    setIsPlaying(false);
                    setPlayhead(idx / 3);
                  }}
                  className="rounded-lg bg-[#090a0d] border border-white/10 overflow-hidden cursor-pointer hover:border-[#d4af37]/60 transition-colors"
                >
                  <div className="relative aspect-video bg-black">
                    <img
                      src={kf.imageUrl}
                      alt={kf.phaseTitle}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono-tabular text-[#d4af37]">
                      0{idx + 1} · {Math.round((idx / 3) * 100)}% ścieżki
                    </div>
                  </div>
                  <div className="px-2.5 py-1.5 text-[11px] text-[#cbc5b8] truncate">
                    {kf.cameraOffsetLabel}
                  </div>
                </div>
              ))}
            </div>
          )}

          {generatedPathVideoUrl && (
            <video
              src={generatedPathVideoUrl}
              controls
              autoPlay
              loop
              className="w-full max-h-80 rounded-xl border border-white/15 bg-black"
            />
          )}
        </div>
      )}

      {/* STANDARDIZED LIBRARY OF NARRATIVE-OPENING FILM & PRESTIGE TV SHOTS */}
      <div className="rounded-2xl bg-[#12151e] border border-white/10 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
          <div>
            <h3 className="text-lg font-serif-display font-semibold text-white">
              Biblioteka Wystandaryzowanych Ujęć i Ścieżek Narracyjno-Wprowadzających (Film i TV)
            </h3>
            <p className="text-xs text-[#9e988c] mt-0.5">
              Kliknij wybrane ujęcie, aby automatycznie wczytać jego Stan A, Stan B, krzywiznę ścieżki i kąty kadrowania na model 3D.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-[#090a0d] p-1 rounded-lg border border-white/10 shrink-0">
            {SHOT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                    : 'text-[#b8b2a6] hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredShots.map((shot) => {
            const isSelected = blocking.activeShotPresetId === shot.id;
            return (
              <div
                key={shot.id}
                onClick={() => handleSelectShotPreset(shot)}
                className={`rounded-xl p-4 border transition-colors cursor-pointer flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-[#d4af37]/12 border-[#d4af37]'
                    : 'bg-[#090a0d] border-white/10 hover:border-white/25'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#9e988c]">
                    <span className="font-mono-tabular text-[#d4af37] font-semibold">
                      {shot.code}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{shot.filmGrammarCategory}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">{shot.blocking.focalLengthMm}mm Prime</span>
                  </div>

                  <h4 className="text-base font-serif-display font-semibold text-white">
                    {shot.titlePL}
                  </h4>

                  <p className="text-xs text-[#e5dec9] leading-relaxed">
                    <strong className="text-[#d4af37]">Mechanizm utrzymania uwagi: </strong>
                    {shot.attentionMechanismPL}
                  </p>

                  <p className="text-[11px] text-[#9e988c] leading-relaxed">
                    <strong className="text-[#cbc5b8]">Ścieżka dla reżysera: </strong>
                    {shot.directorCommunicationNotePL}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-white/8 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-[#9e988c] truncate max-w-[68%]">
                    {shot.retentionMetricNote} · {shot.referenceCinemaExamples}
                  </span>

                  <span className="inline-flex items-center gap-1 font-semibold text-[#d4af37] whitespace-nowrap shrink-0">
                    <Target className="w-3.5 h-3.5" />
                    <span>{isSelected ? 'Aktywna ścieżka 3D' : 'Wczytaj ścieżkę 3D'}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Standardized User <-> Director Technical Sheet Preview */}
      <div className="rounded-xl bg-[#090a0d] border border-white/12 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#d4af37]" />
              <span>Specyfikacja Ścieżki Kamery 3D (Stan A → Stan B) dla Reżysera</span>
            </h4>
            <p className="text-[11px] text-[#9e988c]">
              Automatycznie aktualizowana karta zawierająca oba stany kamery, wygięcie ścieżki, profil interpolacji oraz rozpiskę 4 kadrów wideo.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyDirectorBrief}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e3be42] text-xs font-semibold text-[#090a0d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedBrief ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Skopiowano kartę ścieżki!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Kopiuj pełną kartę ścieżki 3D</span>
              </>
            )}
          </button>
        </div>

        <pre className="rounded-lg bg-[#10131c] border border-white/8 p-3.5 text-[11px] text-[#dcd7cc] font-mono-tabular whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
          {directorBrief.fullBriefPL}
        </pre>
      </div>
    </div>
  );
};
