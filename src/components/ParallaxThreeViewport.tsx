import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  evaluatePathEasing,
  interpolateBlockingPose,
} from '../data/cinematicShotsLibrary';
import {
  CameraBlockingConfig,
  LiveCameraRigState,
  SceneAsset,
  VisualEffectSettings,
  VisualFxPresetId,
} from '../types/studio';

interface ParallaxThreeViewportProps {
  sceneAsset: SceneAsset;
  settings: VisualEffectSettings;
  cameraBlocking?: CameraBlockingConfig;
  liveCameraRig?: LiveCameraRigState;
  showCameraPathOverlay?: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

const _lookAtVec = new THREE.Vector3(0, 0, 0);
const _dummyTickObj = new THREE.Object3D();
const _gateEuler = new THREE.Euler(0, 0, 0, 'YXZ');

function fxPresetToIndex(id: VisualFxPresetId): number {
  switch (id) {
    case 'cinematic_gold':
      return 0;
    case 'leica_soft_dof':
      return 1;
    case 'nordic_clean':
      return 2;
    case 'analog_35mm':
      return 3;
    case 'vivid_hdr':
      return 4;
    default:
      return 0;
  }
}

/**
 * Maps architectural lobby coordinates (meters) from `cameraBlocking` into the 3D screen stage
 * in front of the depth-relief plane (width 8.8, height 4.95 at z = 0, camera at z = 5.32).
 */
function mapBlockingPoseToViewport3D(pose: {
  x: number;
  y: number;
  z: number;
}): THREE.Vector3 {
  const vx = THREE.MathUtils.clamp(pose.x * 0.54, -3.35, 3.35);
  const vy = THREE.MathUtils.clamp((pose.y - 1.52) * 0.88, -1.55, 1.55);
  const vz = THREE.MathUtils.clamp(0.52 + (5.2 - pose.z) * 0.21, 0.36, 2.22);
  return new THREE.Vector3(vx, vy, vz);
}

function createKeyframeBadgeSprite(
  label: string,
  borderHex: string,
  maxAnisotropy: number
): { sprite: THREE.Sprite; texture: THREE.CanvasTexture; material: THREE.SpriteMaterial } {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(9, 10, 14, 0.88)';
  ctx.beginPath();
  ctx.roundRect(4, 6, 248, 52, 12);
  ctx.fill();

  ctx.strokeStyle = borderHex;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(4, 6, 248, 52, 12);
  ctx.stroke();

  ctx.fillStyle = '#f4f1ea';
  ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 33);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.76, 0.19, 1);
  sprite.renderOrder = 12;
  return { sprite, texture, material };
}

function buildMiniViewportGate(hexColor: number): {
  loop: THREE.LineLoop;
  geo: THREE.BufferGeometry;
  mat: THREE.LineBasicMaterial;
} {
  const hw = 0.19;
  const hh = 0.107;
  const pts = [
    new THREE.Vector3(-hw, hh, -0.14),
    new THREE.Vector3(hw, hh, -0.14),
    new THREE.Vector3(hw, -hh, -0.14),
    new THREE.Vector3(-hw, -hh, -0.14),
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color: hexColor,
    transparent: true,
    opacity: 0.88,
    depthTest: false,
  });
  const loop = new THREE.LineLoop(geo, mat);
  loop.renderOrder = 10;
  return { loop, geo, mat };
}

const VERTEX_SHADER = `
  uniform sampler2D uTexture;
  uniform float uDepthIntensity;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    vUv = uv;
    vec4 tex = texture2D(uTexture, uv);
    float luma = dot(tex.rgb, vec3(0.299, 0.587, 0.114));

    float floorMask = smoothstep(0.45, 0.0, uv.y);
    float deskMask = smoothstep(0.36, 0.94, uv.x) * smoothstep(0.10, 0.62, uv.y) * (1.0 - smoothstep(0.62, 0.85, uv.y));
    float structuralDepth = (floorMask * 0.35 + deskMask * 0.25) + (luma - 0.5) * 0.12;

    vDepth = structuralDepth;

    vec3 pos = position;
    pos.z += structuralDepth * uDepthIntensity * 0.45;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform sampler2D uTexture;
  uniform float uPhotorealism;
  uniform float uWarmGlow;
  uniform float uBlurIntensity;
  uniform float uVignetteIntensity;
  uniform float uColorGrading;
  uniform float uFilmGrain;
  uniform float uWindowLight;
  uniform float uFxPresetIndex;
  uniform vec4 uWindowBounds;
  varying vec2 vUv;
  varying float vDepth;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec3 sampleWithOptionalBlur(vec2 uv, float blurRadius) {
    if (blurRadius <= 0.0001) {
      return texture2D(uTexture, uv).rgb;
    }
    vec3 sum = texture2D(uTexture, uv).rgb * 0.36;
    sum += texture2D(uTexture, clamp(uv + vec2(blurRadius, 0.0), vec2(0.002), vec2(0.998))).rgb * 0.16;
    sum += texture2D(uTexture, clamp(uv - vec2(blurRadius, 0.0), vec2(0.002), vec2(0.998))).rgb * 0.16;
    sum += texture2D(uTexture, clamp(uv + vec2(0.0, blurRadius), vec2(0.002), vec2(0.998))).rgb * 0.16;
    sum += texture2D(uTexture, clamp(uv - vec2(0.0, blurRadius), vec2(0.002), vec2(0.998))).rgb * 0.16;
    return sum;
  }

  void main() {
    vec2 uv = vUv;

    // Optical Depth-of-Field (keeps reception focal center crisp, softens peripheral edges)
    float distFromFocus = distance(uv, vec2(0.56, 0.46));
    float dofFactor = smoothstep(0.18, 0.68, distFromFocus);
    float blurRadius = dofFactor * uBlurIntensity * 0.0055;

    // Floor-to-ceiling Warsaw window area for natural daylight enhancement
    float inWindowX = smoothstep(uWindowBounds.x, uWindowBounds.x + 0.03, uv.x) *
                      (1.0 - smoothstep(uWindowBounds.y - 0.04, uWindowBounds.y, uv.x));
    float inWindowY = smoothstep(uWindowBounds.z, uWindowBounds.z + 0.04, 1.0 - uv.y) *
                      (1.0 - smoothstep(uWindowBounds.w - 0.05, uWindowBounds.w, 1.0 - uv.y));
    float windowRegion = inWindowX * inWindowY;

    vec3 color = sampleWithOptionalBlur(uv, blurRadius);
    float baseLuma = dot(color, vec3(0.299, 0.587, 0.114));
    float skyAndTowersMask = windowRegion * smoothstep(0.15, 0.34, baseLuma);

    // Static natural daylight bloom through the Warsaw windows
    if (uWindowLight > 0.01 && skyAndTowersMask > 0.05) {
      float shaftWave = 0.5 + 0.5 * sin(uv.x * 6.5 + uv.y * 3.8);
      color += vec3(1.0, 0.91, 0.72) * pow(shaftWave, 2.5) * skyAndTowersMask * uWindowLight * 0.14;
    }

    // PBR Floor & Calacatta Marble specular enhancement
    float floorZone = smoothstep(0.42, 0.02, uv.y);
    float specularHighlight = smoothstep(0.52, 0.88, baseLuma) * (floorZone * 0.65 + 0.35);
    float staticSheen = 0.5 + 0.5 * cos(uv.x * 10.0);
    color += color * specularHighlight * staticSheen * uPhotorealism * 0.22;

    // Golden Hour Warm Glow & Ring Chandelier atmospheric light
    float chandelierGlow = exp(-distance(uv, vec2(0.66, 0.80)) * 4.2) * uWarmGlow * 0.22;
    float sunsetHorizon = exp(-distance(uv, vec2(0.32, 0.42)) * 3.0) * uWarmGlow * 0.16;
    color += vec3(1.0, 0.84, 0.56) * (chandelierGlow + sunsetHorizon);

    // Predefined Visual FX Color Correction & Grading Curve
    float cg = uColorGrading;
    if (cg > 0.01) {
      vec3 sCurve = color * color * (3.0 - 2.0 * color);
      vec3 graded = mix(color, sCurve, 0.42 * cg);

      if (uFxPresetIndex < 0.5) {
        graded *= mix(vec3(1.0), vec3(1.05, 1.01, 0.94), cg);
      } else if (uFxPresetIndex < 1.5) {
        graded = mix(graded, pow(clamp(graded, 0.0, 1.0), vec3(0.95, 0.97, 1.02)), cg * 0.6);
      } else if (uFxPresetIndex < 2.5) {
        graded *= mix(vec3(1.0), vec3(0.96, 1.01, 1.06), cg);
      } else if (uFxPresetIndex < 3.5) {
        graded = mix(graded, graded * 0.88 + vec3(0.045, 0.038, 0.028), cg * 0.75);
      } else {
        float l = dot(graded, vec3(0.299, 0.587, 0.114));
        graded = mix(vec3(l), graded, 1.0 + 0.35 * cg);
      }
      color = mix(color, clamp(graded, 0.0, 1.0), cg);
    }

    // Optical Lens Vignette
    if (uVignetteIntensity > 0.01) {
      vec2 centered = uv - 0.5;
      centered.x *= 1.15;
      float vig = 1.0 - smoothstep(0.28, 0.78, length(centered)) * uVignetteIntensity * 0.78;
      color *= vig;
    }

    // 35mm Organic Film Grain (static photographic grain)
    if (uFilmGrain > 0.01) {
      float grain = hash12(uv * 950.0) - 0.5;
      color += vec3(grain) * uFilmGrain * 0.14;
    }

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

function createRadialContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  g.addColorStop(0.6, 'rgba(0, 0, 0, 0.18)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createArchitecturalPropsGroup(
  isSoftwareGl: boolean,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const rootGroup = new THREE.Group();

  const haloGroup = new THREE.Group();
  haloGroup.position.set(1.55, 1.72, 0.55);
  haloGroup.rotation.x = Math.PI * 0.47;
  haloGroup.rotation.y = -0.12;

  const goldMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#c8a258'),
    metalness: 0.92,
    roughness: 0.2,
    clearcoat: 0.6,
  });

  const darkBronzeMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2a241d'),
    metalness: 0.65,
    roughness: 0.48,
  });

  const ledEmissiveMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fff3d6'),
    emissive: new THREE.Color('#ffcf75'),
    emissiveIntensity: 2.1,
    roughness: 0.15,
    metalness: 0.1,
  });

  const outerRingGeo = new THREE.TorusGeometry(1.55, 0.042, 20, 72);
  const outerRingMesh = new THREE.Mesh(outerRingGeo, goldMaterial);
  outerRingMesh.castShadow = !isSoftwareGl;
  haloGroup.add(outerRingMesh);

  const innerLedGeo = new THREE.TorusGeometry(1.5, 0.024, 16, 72);
  const innerLedMesh = new THREE.Mesh(innerLedGeo, ledEmissiveMaterial);
  haloGroup.add(innerLedMesh);

  const trimRingGeo = new THREE.TorusGeometry(1.55, 0.018, 12, 64);
  const trimRingMesh = new THREE.Mesh(trimRingGeo, darkBronzeMaterial);
  trimRingMesh.position.z = -0.035;
  haloGroup.add(trimRingMesh);

  const cableGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.9, 8);
  const anchorGeo = new THREE.CylinderGeometry(0.025, 0.018, 0.05, 12);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.4;
    const rx = Math.cos(angle) * 1.54;
    const ry = Math.sin(angle) * 1.54;

    const cable = new THREE.Mesh(cableGeo, darkBronzeMaterial);
    cable.position.set(rx, ry, -0.45);
    cable.rotation.x = Math.PI * 0.5;
    haloGroup.add(cable);

    const anchor = new THREE.Mesh(anchorGeo, goldMaterial);
    anchor.position.set(rx, ry, -0.02);
    anchor.rotation.x = Math.PI * 0.5;
    haloGroup.add(anchor);
  }

  rootGroup.add(haloGroup);

  const sculptureGroup = new THREE.Group();
  sculptureGroup.position.set(2.52, -0.62, 0.82);
  sculptureGroup.scale.setScalar(0.42);

  const lathePoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.38, 0.0),
    new THREE.Vector2(0.34, 0.08),
    new THREE.Vector2(0.22, 0.14),
    new THREE.Vector2(0.0, 0.14),
  ];
  const plinthGeo = new THREE.LatheGeometry(lathePoints, 28);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d8cfc2'),
    roughness: 0.55,
    metalness: 0.15,
  });
  const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
  sculptureGroup.add(plinthMesh);

  const waveShape = new THREE.Shape();
  waveShape.moveTo(-0.18, 0.14);
  waveShape.bezierCurveTo(-0.35, 0.48, 0.28, 0.72, 0.35, 1.05);
  waveShape.bezierCurveTo(0.12, 0.85, -0.15, 0.55, 0.05, 0.14);
  waveShape.closePath();

  const extrudeGeo = new THREE.ExtrudeGeometry(waveShape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.015,
    bevelSegments: 3,
  });
  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#eceff4'),
    metalness: 0.95,
    roughness: 0.12,
    clearcoat: 1.0,
  });
  const waveMesh = new THREE.Mesh(extrudeGeo, chromeMat);
  sculptureGroup.add(waveMesh);

  const shadowTex = createRadialContactShadowTexture();
  const shadowGeo = new THREE.PlaneGeometry(1.1, 1.1);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.48,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI * 2 * 0.25;
  shadowPlane.position.y = 0.005;
  sculptureGroup.add(shadowPlane);

  disposables.push(
    goldMaterial,
    darkBronzeMaterial,
    ledEmissiveMaterial,
    outerRingGeo,
    innerLedGeo,
    trimRingGeo,
    cableGeo,
    anchorGeo,
    plinthGeo,
    plinthMat,
    extrudeGeo,
    chromeMat,
    shadowTex,
    shadowGeo,
    shadowMat
  );

  rootGroup.add(sculptureGroup);
  return rootGroup;
}

export const ParallaxThreeViewport: React.FC<ParallaxThreeViewportProps> = ({
  sceneAsset,
  settings,
  cameraBlocking,
  liveCameraRig,
  showCameraPathOverlay = true,
  onCanvasReady,
}) => {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const fpsValueRef = useRef<HTMLSpanElement>(null);
  const fpsStatusRef = useRef<HTMLSpanElement>(null);
  const settingsRef = useRef<VisualEffectSettings>(settings);
  const blockingRef = useRef<CameraBlockingConfig | undefined>(cameraBlocking);
  blockingRef.current = cameraBlocking;
  const liveRigRef = useRef<LiveCameraRigState | undefined>(liveCameraRig);
  liveRigRef.current = liveCameraRig;
  const showPathRef = useRef<boolean>(showCameraPathOverlay);
  showPathRef.current = showCameraPathOverlay;

  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const propsGroupRef = useRef<THREE.Group | null>(null);
  const textureLoaderRef = useRef<THREE.TextureLoader>(new THREE.TextureLoader());

  const viewportApiRef = useRef<{
    requestRender: () => void;
    rebuildCameraPathLine: () => void;
    applyLiveCameraPose: () => void;
  } | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
    if (materialRef.current) {
      const u = materialRef.current.uniforms;
      u.uDepthIntensity.value = settings.depthIntensity / 100;
      u.uPhotorealism.value = settings.photorealism / 100;
      u.uWarmGlow.value = settings.warmGlow / 100;
      u.uBlurIntensity.value = (settings.blurIntensity ?? 18) / 100;
      u.uVignetteIntensity.value = (settings.vignetteIntensity ?? 34) / 100;
      u.uColorGrading.value = (settings.colorGrading ?? 62) / 100;
      u.uFilmGrain.value = (settings.filmGrain ?? 14) / 100;
      u.uWindowLight.value = (settings.windowLightIntensity ?? 76) / 100;
      u.uFxPresetIndex.value = fxPresetToIndex(settings.activeFxPreset);
    }
    if (propsGroupRef.current) {
      propsGroupRef.current.visible = settings.show3DProps;
    }
    viewportApiRef.current?.requestRender();
  }, [settings]);

  useEffect(() => {
    viewportApiRef.current?.rebuildCameraPathLine();
    viewportApiRef.current?.requestRender();
  }, [cameraBlocking, showCameraPathOverlay]);

  useEffect(() => {
    viewportApiRef.current?.applyLiveCameraPose();
    viewportApiRef.current?.requestRender();
  }, [liveCameraRig]);

  useEffect(() => {
    if (!materialRef.current) return;
    const loader = textureLoaderRef.current;
    loader.load(sceneAsset.imageUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      if (materialRef.current) {
        const oldTex = materialRef.current.uniforms.uTexture.value;
        materialRef.current.uniforms.uTexture.value = tex;
        materialRef.current.uniforms.uWindowBounds.value.set(
          sceneAsset.windowBounds.xMin,
          sceneAsset.windowBounds.xMax,
          sceneAsset.windowBounds.yMin,
          sceneAsset.windowBounds.yMax
        );
        if (oldTex && oldTex !== tex) {
          oldTex.dispose();
        }
        viewportApiRef.current?.requestRender();
      }
    });
  }, [sceneAsset]);

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

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    onCanvasReady?.(renderer.domElement);

    const disposables: Array<{ dispose: () => void }> = [];
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090a0d');
    scene.fog = new THREE.FogExp2('#090a0d', 0.045);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();
    disposables.push(envRT);

    const camera = new THREE.PerspectiveCamera(
      42,
      (container.clientWidth || window.innerWidth) /
        (container.clientHeight || window.innerHeight),
      0.1,
      100
    );
    camera.position.set(0, 0, 5.32);
    camera.lookAt(_lookAtVec);

    const hemiLight = new THREE.HemisphereLight('#c4d6ff', '#2c2219', 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#ffdfa8', 1.85);
    keyLight.position.set(-3.5, 2.8, 4.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#ffd180', 1.1);
    rimLight.position.set(3.2, 2.4, -2.0);
    scene.add(rimLight);

    const initCanvas = document.createElement('canvas');
    initCanvas.width = 64;
    initCanvas.height = 36;
    const initCtx = initCanvas.getContext('2d')!;
    initCtx.fillStyle = '#151821';
    initCtx.fillRect(0, 0, 64, 36);
    const placeholderTex = new THREE.CanvasTexture(initCanvas);
    placeholderTex.colorSpace = THREE.SRGBColorSpace;

    const planeGeo = new THREE.PlaneGeometry(8.8, 4.95, 128, 72);
    const s = settingsRef.current;
    const shaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: placeholderTex },
        uDepthIntensity: { value: s.depthIntensity / 100 },
        uPhotorealism: { value: s.photorealism / 100 },
        uWarmGlow: { value: s.warmGlow / 100 },
        uBlurIntensity: { value: (s.blurIntensity ?? 18) / 100 },
        uVignetteIntensity: { value: (s.vignetteIntensity ?? 34) / 100 },
        uColorGrading: { value: (s.colorGrading ?? 62) / 100 },
        uFilmGrain: { value: (s.filmGrain ?? 14) / 100 },
        uWindowLight: { value: (s.windowLightIntensity ?? 76) / 100 },
        uFxPresetIndex: { value: fxPresetToIndex(s.activeFxPreset) },
        uWindowBounds: {
          value: new THREE.Vector4(
            sceneAsset.windowBounds.xMin,
            sceneAsset.windowBounds.xMax,
            sceneAsset.windowBounds.yMin,
            sceneAsset.windowBounds.yMax
          ),
        },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });
    materialRef.current = shaderMat;
    disposables.push(planeGeo, shaderMat);

    const depthMesh = new THREE.Mesh(planeGeo, shaderMat);
    scene.add(depthMesh);

    const propsGroup = createArchitecturalPropsGroup(isSoftwareGl, disposables);
    propsGroup.visible = settingsRef.current.show3DProps;
    propsGroupRef.current = propsGroup;
    scene.add(propsGroup);

    // =========================================================================
    // 3D CAMERA PATH OVERLAY GROUP (Drawn from `cameraBlocking` across 4 frames)
    // =========================================================================
    const cameraPathGroup = new THREE.Group();
    cameraPathGroup.renderOrder = 8;
    scene.add(cameraPathGroup);

    const pathTubeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d4af37'),
      emissive: new THREE.Color('#d4af37'),
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.82,
      transparent: true,
      opacity: 0.88,
      depthTest: false,
    });
    const pathCoreLineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#fef08a'),
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    const sightRayMat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#38bdf8'),
      transparent: true,
      opacity: 0.48,
      depthTest: false,
    });
    disposables.push(pathTubeMat, pathCoreLineMat, sightRayMat);

    let pathTubeMesh: THREE.Mesh | null = null;
    let pathCoreLine: THREE.Line | null = null;

    // 24 Velocity-spaced interpolation ticks along the 3D path (InstancedMesh)
    const tickCount = 24;
    const tickGeo = new THREE.SphereGeometry(0.022, 10, 10);
    const tickMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef08a'),
      emissive: new THREE.Color('#d4af37'),
      emissiveIntensity: 0.85,
      depthTest: false,
    });
    disposables.push(tickGeo, tickMat);
    const velocityTicksMesh = new THREE.InstancedMesh(tickGeo, tickMat, tickCount);
    velocityTicksMesh.frustumCulled = false;
    velocityTicksMesh.renderOrder = 9;
    cameraPathGroup.add(velocityTicksMesh);

    // 4 Keyframe Nodes (0%, 33%, 67%, 100%) + Mini 16:9 Viewfinder Gates + Labels
    const kfSphereGeo = new THREE.SphereGeometry(0.052, 16, 16);
    disposables.push(kfSphereGeo);

    const kfBadgeSpecs = [
      { label: 'A · K01 (0%)', hexNum: 0x10b981, hexStr: '#10b981' },
      { label: 'K02 (33%)', hexNum: 0xd4af37, hexStr: '#d4af37' },
      { label: 'K03 (67%)', hexNum: 0xd4af37, hexStr: '#d4af37' },
      { label: 'B · K04 (100%)', hexNum: 0xf59e0b, hexStr: '#f59e0b' },
    ];

    const keyframeAnchors: Array<{
      group: THREE.Group;
      gateLoop: THREE.LineLoop;
      sprite: THREE.Sprite;
    }> = [];

    kfBadgeSpecs.forEach((spec) => {
      const nodeGroup = new THREE.Group();
      const nodeMat = new THREE.MeshStandardMaterial({
        color: spec.hexNum,
        emissive: spec.hexNum,
        emissiveIntensity: 0.78,
        depthTest: false,
      });
      disposables.push(nodeMat);

      const sphere = new THREE.Mesh(kfSphereGeo, nodeMat);
      sphere.renderOrder = 11;

      const gate = buildMiniViewportGate(spec.hexNum);
      disposables.push(gate.geo, gate.mat);

      const badge = createKeyframeBadgeSprite(spec.label, spec.hexStr, maxAniso);
      badge.sprite.position.set(0, 0.21, 0);
      disposables.push(badge.texture, badge.material);

      nodeGroup.add(sphere, gate.loop, badge.sprite);
      cameraPathGroup.add(nodeGroup);
      keyframeAnchors.push({
        group: nodeGroup,
        gateLoop: gate.loop,
        sprite: badge.sprite,
      });
    });

    // Target Focal Anchor & 2 Sight Rays (State A -> Target, State B -> Target)
    const targetAnchorMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      depthTest: false,
    });
    const targetRingGeo = new THREE.TorusGeometry(0.11, 0.012, 12, 32);
    disposables.push(targetAnchorMat, targetRingGeo);
    const targetRingMesh = new THREE.Mesh(targetRingGeo, targetAnchorMat);
    targetRingMesh.renderOrder = 10;
    cameraPathGroup.add(targetRingMesh);

    const sightPositions = new Float32Array(12); // 4 vertices (2 segments: A->Target, B->Target)
    const sightGeo = new THREE.BufferGeometry();
    sightGeo.setAttribute('position', new THREE.BufferAttribute(sightPositions, 3));
    disposables.push(sightGeo);
    const sightSegments = new THREE.LineSegments(sightGeo, sightRayMat);
    sightSegments.renderOrder = 8;
    cameraPathGroup.add(sightSegments);

    const rebuildCameraPathLine = () => {
      const b = blockingRef.current;
      const visible = Boolean(b && showPathRef.current);
      cameraPathGroup.visible = visible;
      if (!b || !visible) return;

      // Sample 37 points along the interpolated camera movement curve
      const sampleCount = 36;
      const curvePoints: THREE.Vector3[] = [];
      for (let i = 0; i <= sampleCount; i++) {
        const u = i / sampleCount;
        const p = interpolateBlockingPose(b, u);
        curvePoints.push(mapBlockingPoseToViewport3D(p));
      }

      // Ensure non-degenerate curve even if State A and State B coincide
      if (curvePoints[0].distanceTo(curvePoints[curvePoints.length - 1]) < 0.02) {
        curvePoints[curvePoints.length - 1].x += 0.03;
      }

      const catmullCurve = new THREE.CatmullRomCurve3(curvePoints);

      if (pathTubeMesh) {
        cameraPathGroup.remove(pathTubeMesh);
        pathTubeMesh.geometry.dispose();
        pathTubeMesh = null;
      }
      if (pathCoreLine) {
        cameraPathGroup.remove(pathCoreLine);
        pathCoreLine.geometry.dispose();
        pathCoreLine = null;
      }

      const tubeGeo = new THREE.TubeGeometry(catmullCurve, 48, 0.014, 8, false);
      pathTubeMesh = new THREE.Mesh(tubeGeo, pathTubeMat);
      pathTubeMesh.renderOrder = 9;
      cameraPathGroup.add(pathTubeMesh);

      const lineGeo = new THREE.BufferGeometry().setFromPoints(
        catmullCurve.getPoints(64)
      );
      pathCoreLine = new THREE.Line(lineGeo, pathCoreLineMat);
      pathCoreLine.renderOrder = 10;
      cameraPathGroup.add(pathCoreLine);

      // Position 24 velocity-paced easing markers along the curve
      const smoothing =
        b.smoothingFactor ?? (b.easingStyle === 'linear_constant' ? 0 : 65);
      for (let i = 0; i < tickCount; i++) {
        const rawT = i / (tickCount - 1);
        const easedT = evaluatePathEasing(rawT, b.easingStyle, smoothing);
        const pt = catmullCurve.getPoint(THREE.MathUtils.clamp(easedT, 0, 1));
        _dummyTickObj.position.copy(pt);
        _dummyTickObj.rotation.set(0, 0, 0);
        _dummyTickObj.scale.setScalar(1);
        _dummyTickObj.updateMatrix();
        velocityTicksMesh.setMatrixAt(i, _dummyTickObj.matrix);
      }
      velocityTicksMesh.instanceMatrix.needsUpdate = true;
      velocityTicksMesh.computeBoundingSphere();

      // Update the 4 Keyframe Nodes (0%, 33%, 67%, 100%)
      [0, 1 / 3, 2 / 3, 1].forEach((frac, idx) => {
        const kfPose = interpolateBlockingPose(b, frac);
        const pos3D = mapBlockingPoseToViewport3D(kfPose);
        const anchor = keyframeAnchors[idx];
        anchor.group.position.copy(pos3D);

        _gateEuler.set(
          THREE.MathUtils.degToRad(kfPose.tiltDeg * 0.45),
          THREE.MathUtils.degToRad(kfPose.panDeg * 0.45),
          THREE.MathUtils.degToRad(kfPose.rollDeg)
        );
        anchor.gateLoop.quaternion.setFromEuler(_gateEuler);
        const focalScale = THREE.MathUtils.clamp(35 / Math.max(18, kfPose.focalMm), 0.65, 1.35);
        anchor.gateLoop.scale.setScalar(focalScale);
      });

      // Update Target Focal Point & Sightlines
      const target3D = new THREE.Vector3(
        THREE.MathUtils.clamp(b.targetPoint.x * 0.52, -3.5, 3.5),
        THREE.MathUtils.clamp((b.targetPoint.y - 1.52) * 0.85, -1.6, 1.6),
        0.28
      );
      targetRingMesh.position.copy(target3D);
      targetRingMesh.visible = b.lockFramingToTarget;
      sightSegments.visible = b.lockFramingToTarget;

      if (b.lockFramingToTarget) {
        const start3D = keyframeAnchors[0].group.position;
        const end3D = keyframeAnchors[3].group.position;
        const attr = sightGeo.getAttribute('position') as THREE.BufferAttribute;
        attr.setXYZ(0, start3D.x, start3D.y, start3D.z);
        attr.setXYZ(1, target3D.x, target3D.y, target3D.z);
        attr.setXYZ(2, end3D.x, end3D.y, end3D.z);
        attr.setXYZ(3, target3D.x, target3D.y, target3D.z);
        attr.needsUpdate = true;
        sightGeo.computeBoundingSphere();
      }
    };

    rebuildCameraPathLine();

    let frameId = 0;
    let idleTimerId = 0;
    let renderBusy = false;
    let renderDirty = false;
    const recentRenderTimestamps: number[] = [];
    let lastRenderTimestamp = 0;
    let lastHudUpdate = 0;
    let smoothedFps = isSoftwareGl ? 15 : 60;
    let lastRenderMs = 0;

    const writeFpsHud = (fps: number, ms: number, isIdle: boolean) => {
      if (fpsValueRef.current) {
        fpsValueRef.current.textContent = `${Math.max(1, Math.round(fps))} FPS`;
        fpsValueRef.current.style.color =
          fps >= 45 ? '#34d399' : fps >= 24 ? '#d4af37' : '#f87171';
      }
      if (fpsStatusRef.current) {
        fpsStatusRef.current.textContent = isIdle
          ? `· ${ms.toFixed(1)} ms · gotowy`
          : `· ${ms.toFixed(1)} ms`;
      }
    };

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync =
        gl && typeof gl.fenceSync === 'function'
          ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
          : null;
      if (gl) gl.flush();
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
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const t0 = performance.now();
        renderer.render(scene, camera);
        const t1 = performance.now();

        lastRenderMs = Math.max(0.1, t1 - t0);
        recentRenderTimestamps.push(t1);
        while (
          recentRenderTimestamps.length > 0 &&
          recentRenderTimestamps[0] < t1 - 1000
        ) {
          recentRenderTimestamps.shift();
        }

        if (lastRenderTimestamp > 0) {
          const delta = t1 - lastRenderTimestamp;
          if (delta > 0 && delta < 500) {
            const instantFps = Math.min(120, 1000 / Math.max(8.33, delta));
            smoothedFps = smoothedFps * 0.7 + instantFps * 0.3;
          } else {
            const theoreticalFps = Math.min(
              isSoftwareGl ? 30 : 60,
              1000 / Math.max(16.67, lastRenderMs)
            );
            smoothedFps = theoreticalFps;
          }
        } else {
          smoothedFps = Math.min(
            isSoftwareGl ? 30 : 60,
            1000 / Math.max(16.67, lastRenderMs)
          );
        }
        lastRenderTimestamp = t1;

        if (t1 - lastHudUpdate >= 160) {
          lastHudUpdate = t1;
          const displayFps =
            recentRenderTimestamps.length >= 6
              ? Math.max(recentRenderTimestamps.length, Math.round(smoothedFps))
              : smoothedFps;
          writeFpsHud(displayFps, lastRenderMs, false);
        }

        window.clearTimeout(idleTimerId);
        idleTimerId = window.setTimeout(() => {
          writeFpsHud(smoothedFps, lastRenderMs, true);
        }, 900);

        const done = () => {
          renderBusy = false;
          if (renderDirty) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    const applyLiveCameraPose = () => {
      const rig = liveRigRef.current;
      if (!rig || !rig.enabled) {
        camera.position.set(0, 0, 5.32);
        camera.rotation.order = 'YXZ';
        camera.rotation.set(0, 0, 0);
        if (Math.abs(camera.fov - 42) > 0.05) {
          camera.fov = 42;
          camera.updateProjectionMatrix();
        }
        return;
      }

      const sign = rig.invertAxes ? -1 : 1;
      const airX = rig.airX ?? 0;
      const airY = rig.airY ?? 0;
      const airZ = rig.airZ ?? 0;

      camera.position.set(
        THREE.MathUtils.clamp(rig.panX * 0.9 + airX * 0.72, -3.2, 3.2),
        THREE.MathUtils.clamp(rig.pitchDeg * 0.012 * sign + airY * 0.75, -1.5, 1.5),
        THREE.MathUtils.clamp(5.32 - rig.dollyZ * 1.15 + airZ * 0.85, 2.2, 8.2)
      );
      camera.rotation.order = 'YXZ';
      camera.rotation.set(
        THREE.MathUtils.degToRad(rig.pitchDeg * 0.55 * sign),
        THREE.MathUtils.degToRad(-rig.yawDeg * 0.65 * sign),
        THREE.MathUtils.degToRad(rig.rollDeg * sign)
      );
      const nextFov = THREE.MathUtils.clamp(42 - rig.fovOffset, 22, 74);
      if (Math.abs(camera.fov - nextFov) > 0.05) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
    };

    applyLiveCameraPose();

    viewportApiRef.current = {
      requestRender,
      rebuildCameraPathLine,
      applyLiveCameraPose,
    };

    textureLoaderRef.current.load(sceneAsset.imageUrl, (loadedTex) => {
      loadedTex.colorSpace = THREE.SRGBColorSpace;
      loadedTex.anisotropy = maxAniso;
      shaderMat.uniforms.uTexture.value = loadedTex;
      placeholderTex.dispose();
      requestRender();
    });

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    const onContextRestored = () => {
      rebuildCameraPathLine();
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };

    window.addEventListener('resize', onResize);
    requestRender();

    return () => {
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      clearTimeout(idleTimerId);
      if (pathTubeMesh) pathTubeMesh.geometry.dispose();
      if (pathCoreLine) pathCoreLine.geometry.dispose();
      const activeTex = shaderMat.uniforms.uTexture.value;
      if (activeTex) activeTex.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    };
  }, []);

  return (
    <>
      <div
        ref={canvasMountRef}
        className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#090a0d] z-0"
        aria-label="Widok studyjny głębi 3D, efektów wizualnych i linii ścieżki kamery 3D Bujok Medical"
      />
      <div className="fixed top-[62px] right-3 sm:right-6 z-10 pointer-events-none flex flex-col items-end gap-1.5">
        <div
          aria-label="Licznik wydajności renderingu 3D FPS"
          title="Wydajność renderingu WebGL (klatki na sekundę oraz czas klatki w ms)"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#090a0d]/85 border border-white/10 text-[11px] font-mono-tabular text-[#9e988c]"
        >
          <span ref={fpsValueRef} className="font-semibold text-[#34d399]">
            60 FPS
          </span>
          <span ref={fpsStatusRef}>· -- ms</span>
        </div>

        {liveCameraRig?.enabled && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#090a0d]/90 border border-[#d4af37]/45 text-[11px] font-mono-tabular text-[#e8ca64]">
            <span>
              {liveCameraRig.source === 'air_wand_6dof'
                ? '6DoF Przestrzeń'
                : liveCameraRig.source === 'vr_gyro'
                  ? 'VR Żyroskop'
                  : liveCameraRig.source === 'vr_simulator'
                    ? 'Symulacja VR'
                    : liveCameraRig.source === 'web_midi'
                      ? 'MIDI Potencjometry'
                      : liveCameraRig.source === 'hardware_gamepad'
                        ? 'Pad / Kontroler'
                        : 'Potencjometry'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {liveCameraRig.source === 'air_wand_6dof'
                ? `X ${(liveCameraRig.airX ?? 0).toFixed(1)} Y ${(liveCameraRig.airY ?? 0).toFixed(1)} Z ${(liveCameraRig.airZ ?? 0).toFixed(1)}m · `
                : ''}
              Y {liveCameraRig.yawDeg >= 0 ? '+' : ''}
              {Math.round(liveCameraRig.yawDeg)}° P {liveCameraRig.pitchDeg >= 0 ? '+' : ''}
              {Math.round(liveCameraRig.pitchDeg)}°
            </span>
          </div>
        )}
      </div>
    </>
  );
};
