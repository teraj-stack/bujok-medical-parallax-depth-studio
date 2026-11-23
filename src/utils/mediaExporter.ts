import { computeOpticalPathProjection } from '../data/cinematicShotsLibrary';
import {
  CameraBlockingConfig,
  KeyframeItem,
  KeyframePathTransform,
  VisualEffectSettings,
} from '../types/studio';

export interface ExportResultInfo {
  filename: string;
  format: 'webp' | 'mp4';
  sizeBytes: number;
  url: string;
  durationSec?: number;
}

export type FourFrameTransitionMode =
  | 'smooth_camera_path'
  | 'cross_dissolve'
  | 'light_sweep'
  | 'editorial_cut';

/**
 * Exports the current WebGL canvas or a 4-frame sequence sheet as an ultra-lightweight WebP file.
 */
export async function exportCanvasToWebP(
  canvas: HTMLCanvasElement,
  quality = 0.86,
  filenamePrefix = 'bujok-medical-depth'
): Promise<ExportResultInfo> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Nie udało się wygenerować pliku WebP z widoku 3D.'));
          return;
        }
        const url = URL.createObjectURL(blob);
        const filename = `${filenamePrefix}-${Date.now().toString().slice(-5)}.webp`;
        triggerDownload(url, filename);
        resolve({
          filename,
          format: 'webp',
          sizeBytes: blob.size,
          url,
        });
      },
      'image/webp',
      quality
    );
  });
}

/**
 * Renders a 2x2 storyboard grid of the 4 generated & rendered video frames into a single lightweight WebP file.
 */
export async function exportFourFrameSequenceWebP(
  keyframes: KeyframeItem[],
  quality = 0.84
): Promise<ExportResultInfo> {
  const offscreen = document.createElement('canvas');
  offscreen.width = 1920;
  offscreen.height = 1080;
  const ctx = offscreen.getContext('2d');
  if (!ctx) {
    throw new Error('Brak kontekstu 2D do wygenerowania arkusza WebP.');
  }

  ctx.fillStyle = '#090a0d';
  ctx.fillRect(0, 0, offscreen.width, offscreen.height);

  const cellW = 945;
  const cellH = 520;
  const positions = [
    { x: 10, y: 10 },
    { x: 965, y: 10 },
    { x: 10, y: 550 },
    { x: 965, y: 550 },
  ];

  for (let i = 0; i < Math.min(4, keyframes.length); i++) {
    const item = keyframes[i];
    const pos = positions[i];
    const img = await loadImageElement(item.imageUrl);
    ctx.drawImage(img, pos.x, pos.y, cellW, cellH);

    ctx.fillStyle = 'rgba(9, 10, 13, 0.82)';
    ctx.fillRect(pos.x, pos.y + cellH - 36, cellW, 36);
    ctx.fillStyle = '#d4af37';
    ctx.font = '600 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      `0${i + 1} · ${item.phaseTitle} (${item.cameraOffsetLabel})`,
      pos.x + 14,
      pos.y + cellH - 13
    );
  }

  return exportCanvasToWebP(offscreen, quality, 'bujok-sekwencja-4-kadrow');
}

/**
 * Compiles and renders a video (.mp4) directly from the 4 generated and rendered keyframes.
 * When `transitionMode === 'smooth_camera_path'` and `cameraBlocking` is provided, generates a
 * continuous 30fps interpolated camera movement animation from Camera State A (0%) to State B (100%)
 * smoothly blending across all 4 sequence frames.
 */
export async function renderVideoFromFourKeyframes(
  keyframes: KeyframeItem[],
  options: {
    durationSec?: number;
    targetKbps?: number;
    aspectRatio?: '16:9' | '9:16';
    transitionMode?: FourFrameTransitionMode;
    cameraBlocking?: CameraBlockingConfig;
    captions?: string[];
    includeCaptions?: boolean;
    autoDownload?: boolean;
    onProgress?: (progressPct: number, activeFrameNumber: number) => void;
  } = {}
): Promise<ExportResultInfo> {
  const {
    durationSec = 6,
    targetKbps = 2200,
    aspectRatio = '16:9',
    transitionMode = 'smooth_camera_path',
    cameraBlocking,
    captions = [],
    includeCaptions = false,
    autoDownload = false,
    onProgress,
  } = options;

  if (!keyframes || keyframes.length === 0) {
    throw new Error('Brak wygenerowanych 4 kadrów do utworzenia wideo.');
  }

  const frameImages: HTMLImageElement[] = [];
  for (let i = 0; i < 4; i++) {
    const kf = keyframes[i] || keyframes[keyframes.length - 1];
    const loaded = await loadImageElement(kf.imageUrl);
    frameImages.push(loaded);
  }

  const width = aspectRatio === '9:16' ? 720 : 1280;
  const height = aspectRatio === '9:16' ? 1280 : 720;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const stream = (canvas as any).captureStream ? (canvas as any).captureStream(30) : null;
  if (!stream) {
    throw new Error('Twoja przeglądarka nie obsługuje kompilacji strumienia wideo z 4 kadrów.');
  }

  const candidateMimeTypes = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=h264',
    'video/webm;codecs=vp9',
    'video/webm',
  ];

  let selectedMime = 'video/webm';
  for (const mime of candidateMimeTypes) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      selectedMime = mime;
      break;
    }
  }

  const useSmoothPath = Boolean(cameraBlocking && transitionMode === 'smooth_camera_path');

  return new Promise((resolve, reject) => {
    const chunks: BlobPart[] = [];
    let recorder: MediaRecorder;

    try {
      recorder = new MediaRecorder(stream, {
        mimeType: selectedMime,
        videoBitsPerSecond: targetKbps * 1000,
      });
    } catch {
      recorder = new MediaRecorder(stream);
    }

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        chunks.push(ev.data);
      }
    };

    let animFrameId = 0;
    const startTime = performance.now();
    const totalMs = durationSec * 1000;

    const getCoverSize = (img: HTMLImageElement) => {
      const imgAspect = img.width / img.height;
      const targetAspect = width / height;
      if (imgAspect > targetAspect) {
        return { drawH: height, drawW: height * imgAspect };
      }
      return { drawW: width, drawH: width / imgAspect };
    };

    const drawCoverImage = (img: HTMLImageElement, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      const { drawW, drawH } = getCoverSize(img);
      ctx.drawImage(img, (width - drawW) * 0.5, (height - drawH) * 0.5, drawW, drawH);
      ctx.restore();
    };

    /**
     * Aligns Keyframe `frameIdx` seamlessly onto the live interpolated 3D Camera Path pose at `progress`.
     * Uses exact inverse-relative transform so consecutive keyframes align without ghosting during cross-blends.
     */
    const drawPathInterpolatedFrame = (
      frameIdx: number,
      targetProj: ReturnType<typeof computeOpticalPathProjection>,
      alpha = 1
    ) => {
      const img = frameImages[frameIdx];
      const kf = keyframes[frameIdx];
      const { drawW, drawH } = getCoverSize(img);

      // Reference transform baked into this keyframe (or neutral overscan if AI-generated)
      const baked: KeyframePathTransform | undefined = kf?.pathTransform;
      const refShiftX = baked ? baked.shiftXNorm : 0;
      const refShiftY = baked ? baked.shiftYNorm : 0;
      const refScale = baked ? baked.zoomScale : 1.0;
      const refRoll = baked ? baked.rollRad : 0;

      // Safety cushion so relative pan/rotation between adjacent keyframes never exposes canvas border
      const safetyOverscan = baked ? 1.06 : 1.16;
      const relScale = (targetProj.zoomScale / Math.max(0.5, refScale)) * safetyOverscan;
      const deltaX = (targetProj.shiftXNorm - refShiftX) * width;
      const deltaY = (targetProj.shiftYNorm - refShiftY) * height;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(width * 0.5, height * 0.5);
      ctx.rotate(targetProj.rollRad);
      ctx.scale(relScale, relScale);
      ctx.translate(deltaX, deltaY);
      ctx.rotate(-refRoll);
      ctx.drawImage(img, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
      ctx.restore();
    };

    const renderTick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / totalMs);
      const pct = Math.min(99, Math.round(progress * 100));

      ctx.fillStyle = '#090a0d';
      ctx.fillRect(0, 0, width, height);

      if (useSmoothPath && cameraBlocking) {
        const smoothingNorm =
          Math.max(
            0,
            Math.min(
              100,
              cameraBlocking.smoothingFactor ??
                (cameraBlocking.easingStyle === 'linear_constant' ? 0 : 65)
            )
          ) / 100;
        const liveProj = computeOpticalPathProjection(cameraBlocking, progress);
        // Align keyframe transitions to the eased path position so keyframe cross-fades match camera easing intensity
        const easedProgress = liveProj.pose.easedT;
        const intervalPos = easedProgress * 3;
        const idxA = Math.min(2, Math.floor(intervalPos));
        const idxB = Math.min(3, idxA + 1);
        const rawLocal = Math.max(0, Math.min(1, intervalPos - idxA));
        const blendExp = 1 + smoothingNorm * 1.6;
        const smoothBlend =
          rawLocal < 0.5
            ? 0.5 * Math.pow(2 * rawLocal, blendExp)
            : 1 - 0.5 * Math.pow(2 * (1 - rawLocal), blendExp);

        const activeDisplayIdx = Math.min(3, Math.round(easedProgress * 3));
        onProgress?.(pct, activeDisplayIdx + 1);

        drawPathInterpolatedFrame(idxA, liveProj, 1);
        if (smoothBlend > 0.002 && idxB !== idxA) {
          drawPathInterpolatedFrame(idxB, liveProj, smoothBlend);
        }

        // Subtle cinema viewfinder telemetry badge
        ctx.save();
        ctx.fillStyle = 'rgba(9, 10, 13, 0.74)';
        ctx.fillRect(24, 24, 465, 34);
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.48)';
        ctx.lineWidth = 1;
        ctx.strokeRect(24, 24, 465, 34);
        ctx.fillStyle = '#d4af37';
        ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(
          `ŚCIEŻKA 3D A→B (${Math.round(easedProgress * 100)}% · Smooth ${Math.round(smoothingNorm * 100)}%) · KADR 0${activeDisplayIdx + 1}/04 · ${Math.round(liveProj.pose.focalMm)}mm`,
          36,
          45
        );
        ctx.restore();

        if (includeCaptions && captions[activeDisplayIdx]) {
          const captionText = captions[activeDisplayIdx];
          ctx.save();
          const barH = 54;
          const barY = height - barH - 28;
          ctx.fillStyle = 'rgba(9, 10, 13, 0.80)';
          ctx.fillRect(width * 0.08, barY, width * 0.84, barH);
          ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
          ctx.strokeRect(width * 0.08, barY, width * 0.84, barH);
          ctx.fillStyle = '#f4f1ea';
          ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(captionText.slice(0, 95), width * 0.5, barY + 33);
          ctx.restore();
        }
      } else {
        // Classic 4-slot transition modes (cross_dissolve, light_sweep, editorial_cut)
        const exactSegment = progress * 4;
        const currentIdx = Math.min(3, Math.floor(exactSegment));
        const nextIdx = Math.min(3, currentIdx + 1);
        const localT = exactSegment - currentIdx;

        onProgress?.(pct, currentIdx + 1);

        const blendStart = transitionMode === 'editorial_cut' ? 0.88 : 0.62;
        const rawBlend =
          currentIdx < 3 && localT > blendStart
            ? (localT - blendStart) / (1 - blendStart)
            : 0;
        const smoothBlend = 0.5 - 0.5 * Math.cos(rawBlend * Math.PI);

        drawCoverImage(frameImages[currentIdx], 1);

        if (smoothBlend > 0.001 && currentIdx < 3) {
          drawCoverImage(frameImages[nextIdx], smoothBlend);

          if (transitionMode === 'light_sweep') {
            const bloomIntensity = Math.sin(rawBlend * Math.PI) * 0.22;
            const sweepX = width * rawBlend;
            const lightGrad = ctx.createRadialGradient(
              sweepX,
              height * 0.45,
              width * 0.05,
              sweepX,
              height * 0.45,
              width * 0.65
            );
            lightGrad.addColorStop(0, `rgba(255, 218, 148, ${bloomIntensity})`);
            lightGrad.addColorStop(0.5, `rgba(212, 175, 55, ${bloomIntensity * 0.45})`);
            lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = lightGrad;
            ctx.fillRect(0, 0, width, height);
          }
        }

        const activeKf = keyframes[currentIdx] || keyframes[0];
        ctx.save();
        ctx.fillStyle = 'rgba(9, 10, 13, 0.72)';
        ctx.fillRect(24, 24, 310, 34);
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
        ctx.lineWidth = 1;
        ctx.strokeRect(24, 24, 310, 34);
        ctx.fillStyle = '#d4af37';
        ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(
          `KADR 0${currentIdx + 1}/04 · ${activeKf.phaseTitle.slice(0, 26)}`,
          36,
          45
        );
        ctx.restore();

        if (includeCaptions && captions[currentIdx]) {
          const captionText = captions[currentIdx];
          ctx.save();
          const barH = 54;
          const barY = height - barH - 28;
          ctx.fillStyle = 'rgba(9, 10, 13, 0.80)';
          ctx.fillRect(width * 0.08, barY, width * 0.84, barH);
          ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
          ctx.strokeRect(width * 0.08, barY, width * 0.84, barH);
          ctx.fillStyle = '#f4f1ea';
          ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(captionText.slice(0, 95), width * 0.5, barY + 33);
          ctx.restore();
        }
      }

      if (elapsed < totalMs) {
        animFrameId = requestAnimationFrame(renderTick);
      } else if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    };

    recorder.onstop = () => {
      cancelAnimationFrame(animFrameId);
      onProgress?.(100, 4);
      const mp4Blob = new Blob(chunks, { type: 'video/mp4' });
      const url = URL.createObjectURL(mp4Blob);
      const filename = useSmoothPath
        ? `bujok-sciezka-kamery-4-kadry-${durationSec}s.mp4`
        : `bujok-wideo-4-kadry-${durationSec}s.mp4`;
      if (autoDownload) {
        triggerDownload(url, filename);
      }
      resolve({
        filename,
        format: 'mp4',
        sizeBytes: mp4Blob.size,
        url,
        durationSec,
      });
    };

    recorder.onerror = (err) => {
      cancelAnimationFrame(animFrameId);
      reject(err);
    };

    recorder.start(150);
    animFrameId = requestAnimationFrame(renderTick);
  });
}

/**
 * Generates and renders 4 photorealistic keyframes from the scene image, Visual FX settings,
 * and (when provided) the 3D Camera Path (State A -> State B) sampled at 0%, 33%, 67%, and 100%.
 */
export async function generateInstantFourKeyframes(
  imageUrl: string,
  settings: VisualEffectSettings,
  _windowBounds: { xMin: number; xMax: number; yMin: number; yMax: number },
  customPrompts?: string[],
  cameraBlocking?: CameraBlockingConfig
): Promise<KeyframeItem[]> {
  const img = await loadImageElement(imageUrl);
  const width = 1280;
  const height = 720;

  const phases = [
    {
      id: 1,
      label: 'Kadr 01',
      phaseTitle: cameraBlocking
        ? 'Stan Kamery A · Otwarcie Ścieżki (0%)'
        : 'Ekspozycja Bazowa · Klarowność 3D',
      cameraOffsetLabel: 'Faza 1/4 · Naturalne Światło Dzienne',
      contrastAdd: 0,
      saturateAdd: 0,
      dofScale: 0.5,
      warmthAdd: -0.02,
      windowBloom: 0.04,
      defaultPrompt:
        'Kadr 1 (Stan A · 0%): Otwierający kadr ścieżki kamery w nowoczesnym lobby kliniki Bujok Medical, naturalna głębia optyczna 35mm, klarowna panorama Warszawy za oknem.',
    },
    {
      id: 2,
      label: 'Kadr 02',
      phaseTitle: cameraBlocking
        ? 'Interpolacja Ścieżki · Faza 33%'
        : 'Plastyka Światła · Głębia Optyczna DOF',
      cameraOffsetLabel: 'Faza 2/4 · Selektywna Ostrość f/2.0',
      contrastAdd: 4,
      saturateAdd: 4,
      dofScale: 1.0,
      warmthAdd: 0.03,
      windowBloom: 0.12,
      defaultPrompt:
        'Kadr 2 (Ścieżka 33%): Płynna faza ruchu kamery z naturalnym światłem dziennym wpadającym przez przeszklenia i selektywną głębią ostrości na marmurowej recepcji.',
    },
    {
      id: 3,
      label: 'Kadr 03',
      phaseTitle: cameraBlocking
        ? 'Interpolacja Ścieżki · Faza 67%'
        : 'Refleksy PBR · Marmur Calacatta i Szkło',
      cameraOffsetLabel: 'Faza 3/4 · Połysk Materiałów PBR',
      contrastAdd: 8,
      saturateAdd: 6,
      dofScale: 1.15,
      warmthAdd: 0.08,
      windowBloom: 0.18,
      defaultPrompt:
        'Kadr 3 (Ścieżka 67%): Rozwinięcie ruchu kamery eksponujące odbicia światła na polerowanej posadzce, marmurowej ladzie i 4 podświetlonych panelach specjalizacji.',
    },
    {
      id: 4,
      label: 'Kadr 04',
      phaseTitle: cameraBlocking
        ? 'Stan Kamery B · Domknięcie Ścieżki (100%)'
        : 'Złota Godzina · Kinowy Grading i Winieta',
      cameraOffsetLabel: 'Faza 4/4 · Iluminacja 2700K',
      contrastAdd: 12,
      saturateAdd: 10,
      dofScale: 1.35,
      warmthAdd: 0.14,
      windowBloom: 0.24,
      defaultPrompt:
        'Kadr 4 (Stan B · 100%): Docelowy stan końcowy kamery w ciepłej poświacie zachodzącego słońca nad Warszawą, pełna korekcja barwna LUT i optyczna winieta.',
    },
  ];

  const imgAspect = img.width / img.height;
  const targetAspect = width / height;
  let baseDrawW = width;
  let baseDrawH = height;
  if (imgAspect > targetAspect) {
    baseDrawH = height;
    baseDrawW = height * imgAspect;
  } else {
    baseDrawW = width;
    baseDrawH = width / imgAspect;
  }

  const results: KeyframeItem[] = [];

  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    const pathT = i / 3; // 0, 0.333, 0.667, 1.0
    const pathProj = cameraBlocking
      ? computeOpticalPathProjection(cameraBlocking, pathT)
      : null;

    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d')!;

    const contrastPct =
      100 + p.contrastAdd + Math.round(((settings.colorGrading ?? 62) / 100) * 16);
    const baseSat =
      settings.activeFxPreset === 'nordic_clean'
        ? 92
        : settings.activeFxPreset === 'vivid_hdr'
          ? 120
          : 106;
    const saturatePct = baseSat + p.saturateAdd;
    const blurPx = ((settings.blurIntensity ?? 18) / 100) * 1.5 * p.dofScale;

    const drawTransformedScene = () => {
      ctx.save();
      ctx.translate(width * 0.5, height * 0.5);
      if (pathProj) {
        ctx.rotate(pathProj.rollRad);
        ctx.scale(pathProj.zoomScale, pathProj.zoomScale);
        ctx.translate(pathProj.shiftXNorm * width, pathProj.shiftYNorm * height);
      }
      ctx.drawImage(img, -baseDrawW * 0.5, -baseDrawH * 0.5, baseDrawW, baseDrawH);
      ctx.restore();
    };

    ctx.filter = `contrast(${contrastPct}%) saturate(${saturatePct}%)`;
    drawTransformedScene();

    if (blurPx > 0.3) {
      ctx.save();
      ctx.filter = `blur(${(blurPx * 2.1).toFixed(1)}px) contrast(${contrastPct}%)`;
      ctx.globalAlpha = Math.min(0.45, (settings.blurIntensity / 100) * 0.45 * p.dofScale);
      drawTransformedScene();
      ctx.restore();
    }

    ctx.filter = 'none';

    // Window daylight & golden hour atmospheric pass
    const grad = ctx.createLinearGradient(0, height * 0.1, width * 0.88, height * 0.95);
    const warmAlpha = Math.max(0.03, (settings.warmGlow / 100) * 0.14 + p.warmthAdd);
    grad.addColorStop(0, `rgba(255, 212, 138, ${warmAlpha + p.windowBloom * 0.35})`);
    grad.addColorStop(0.55, `rgba(212, 175, 55, ${warmAlpha * 0.5})`);
    grad.addColorStop(1, 'rgba(10, 12, 18, 0.14)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Optical vignette
    const vigAmt = ((settings.vignetteIntensity ?? 34) / 100) * (0.85 + i * 0.08);
    if (vigAmt > 0.02) {
      const vigGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        width * 0.25,
        width * 0.5,
        height * 0.5,
        width * 0.65
      );
      vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vigGrad.addColorStop(1, `rgba(5, 6, 9, ${Math.min(0.78, vigAmt * 0.68)})`);
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, width, height);
    }

    const offsetLabel = pathProj
      ? `Ścieżka ${Math.round(pathT * 100)}% · Pan ${pathProj.pose.panDeg.toFixed(0)}° · ${Math.round(pathProj.pose.focalMm)}mm`
      : p.cameraOffsetLabel;

    const dataUrl = c.toDataURL('image/webp', 0.88);
    results.push({
      id: p.id,
      label: p.label,
      phaseTitle: p.phaseTitle,
      cameraOffsetLabel: offsetLabel,
      prompt: customPrompts?.[i] || p.defaultPrompt,
      imageUrl: dataUrl,
      sourceType: 'realtime_shader',
      pathTransform: pathProj
        ? {
            t: pathT,
            shiftXNorm: pathProj.shiftXNorm,
            shiftYNorm: pathProj.shiftYNorm,
            zoomScale: pathProj.zoomScale,
            rollRad: pathProj.rollRad,
          }
        : undefined,
    });
  }

  return results;
}

/**
 * Renders a high-resolution image in the exact target aspect ratio with real-time Visual FX applied.
 */
export async function renderStyledAspectRatioImage(
  imageUrl: string,
  settings: VisualEffectSettings,
  aspectRatio = '16:9',
  phaseIndex = 0
): Promise<string> {
  const img = await loadImageElement(imageUrl);
  const ratioMap: Record<string, [number, number]> = {
    '16:9': [1280, 720],
    '9:16': [720, 1280],
    '21:9': [1470, 630],
    '4:3': [1200, 900],
    '3:2': [1260, 840],
    '1:1': [1024, 1024],
    '3:4': [900, 1200],
    '2:3': [840, 1260],
  };
  const [width, height] = ratioMap[aspectRatio] || [1280, 720];

  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;

  const contrastPct =
    102 + phaseIndex * 3 + Math.round(((settings.colorGrading ?? 62) / 100) * 18);
  const saturatePct =
    settings.activeFxPreset === 'nordic_clean'
      ? 92
      : settings.activeFxPreset === 'vivid_hdr'
        ? 124
        : 108 + phaseIndex * 3;
  ctx.filter = `contrast(${contrastPct}%) saturate(${saturatePct}%)`;

  const imgAspect = img.width / img.height;
  const targetAspect = width / height;

  let drawW = width;
  let drawH = height;
  if (imgAspect > targetAspect) {
    drawH = height;
    drawW = drawH * imgAspect;
  } else {
    drawW = width;
    drawH = drawW / imgAspect;
  }

  const offsetX = (width - drawW) * 0.5;
  const offsetY = (height - drawH) * 0.5;
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  ctx.filter = 'none';

  const warmAlpha = Math.max(0.05, (settings.warmGlow / 100) * 0.16 + phaseIndex * 0.035);
  const grad = ctx.createLinearGradient(0, height * 0.1, width * 0.9, height * 0.95);
  grad.addColorStop(0, `rgba(255, 212, 136, ${warmAlpha})`);
  grad.addColorStop(0.6, `rgba(212, 175, 55, ${warmAlpha * 0.45})`);
  grad.addColorStop(1, 'rgba(8, 10, 16, 0.15)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const vigAmt = (settings.vignetteIntensity ?? 34) / 100;
  if (vigAmt > 0.02) {
    const vigGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.25,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.65
    );
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vigGrad.addColorStop(1, `rgba(5, 6, 9, ${vigAmt * 0.7})`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, width, height);
  }

  return c.toDataURL('image/webp', 0.88);
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function renderMobileGraphicAsset(options: {
  imageUrl: string;
  settings: VisualEffectSettings;
  format: '9:16_story' | '9:16_wallpaper' | '4:5_feed' | '1:1_square';
  cameraBlocking?: CameraBlockingConfig;
  pathProgress?: number; // 0..1 along cameraBlocking path
  headline?: string;
  subheadline?: string;
  ctaLabel?: string;
  includeTypography?: boolean;
  autoDownload?: boolean;
}): Promise<{ dataUrl: string; width: number; height: number; filename: string }> {
  const {
    imageUrl,
    settings,
    format,
    cameraBlocking,
    pathProgress = 0.5,
    headline = '',
    subheadline = '',
    ctaLabel = '',
    includeTypography = true,
    autoDownload = false,
  } = options;

  const img = await loadImageElement(imageUrl);
  const dims: Record<typeof format, [number, number]> = {
    '9:16_story': [1080, 1920],
    '9:16_wallpaper': [1080, 1920],
    '4:5_feed': [1080, 1350],
    '1:1_square': [1080, 1080],
  };
  const [width, height] = dims[format];

  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;

  const pathProj = cameraBlocking
    ? computeOpticalPathProjection(cameraBlocking, pathProgress)
    : null;

  const imgAspect = img.width / img.height;
  const targetAspect = width / height;
  let drawW = width;
  let drawH = height;
  if (imgAspect > targetAspect) {
    drawH = height;
    drawW = height * imgAspect;
  } else {
    drawW = width;
    drawH = width / imgAspect;
  }

  const contrastPct = 104 + Math.round(((settings.colorGrading ?? 62) / 100) * 18);
  const saturatePct =
    settings.activeFxPreset === 'nordic_clean'
      ? 94
      : settings.activeFxPreset === 'vivid_hdr'
        ? 122
        : 108;

  ctx.save();
  ctx.filter = `contrast(${contrastPct}%) saturate(${saturatePct}%)`;
  ctx.translate(width * 0.5, height * 0.5);
  if (pathProj) {
    ctx.rotate(pathProj.rollRad);
    ctx.scale(pathProj.zoomScale, pathProj.zoomScale);
    ctx.translate(pathProj.shiftXNorm * width, pathProj.shiftYNorm * height);
  }
  ctx.drawImage(img, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
  ctx.restore();

  // Golden hour atmospheric light pass
  const warmAlpha = Math.max(0.05, (settings.warmGlow / 100) * 0.18);
  const warmGrad = ctx.createLinearGradient(0, 0, width * 0.85, height);
  warmGrad.addColorStop(0, `rgba(255, 214, 142, ${warmAlpha})`);
  warmGrad.addColorStop(0.55, `rgba(212, 175, 55, ${warmAlpha * 0.4})`);
  warmGrad.addColorStop(1, 'rgba(9, 10, 14, 0.22)');
  ctx.fillStyle = warmGrad;
  ctx.fillRect(0, 0, width, height);

  // Vignette
  const vigAmt = (settings.vignetteIntensity ?? 34) / 100;
  if (vigAmt > 0.02) {
    const vigGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.46,
      width * 0.22,
      width * 0.5,
      height * 0.5,
      height * 0.68
    );
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vigGrad.addColorStop(1, `rgba(6, 7, 11, ${Math.min(0.82, vigAmt * 0.72)})`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, width, height);
  }

  // Optional Editorial Mobile Typography Overlay (measured contrast scrim >= 4.5:1)
  if (includeTypography && format !== '9:16_wallpaper') {
    const scrimGrad = ctx.createLinearGradient(0, height * 0.52, 0, height);
    scrimGrad.addColorStop(0, 'rgba(9, 10, 13, 0)');
    scrimGrad.addColorStop(0.45, 'rgba(9, 10, 13, 0.68)');
    scrimGrad.addColorStop(1, 'rgba(9, 10, 13, 0.92)');
    ctx.fillStyle = scrimGrad;
    ctx.fillRect(0, height * 0.52, width, height * 0.48);

    // Top subtle brand wordmark
    ctx.fillStyle = 'rgba(244, 241, 234, 0.9)';
    ctx.font = '600 28px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('BUJOK MEDICAL · WARSZAWA', 72, format === '1:1_square' ? 78 : 136);

    const baseBottomY =
      format === '9:16_story'
        ? height - 250
        : format === '4:5_feed'
          ? height - 180
          : height - 150;

    if (headline.trim()) {
      ctx.fillStyle = '#f4f1ea';
      ctx.font = '600 58px "Cormorant Garamond", Georgia, serif';
      const words = headline.trim().split(/\s+/);
      const lines: string[] = [];
      let currentLine = '';
      for (const w of words) {
        const test = currentLine ? `${currentLine} ${w}` : w;
        if (ctx.measureText(test).width > width - 144 && currentLine) {
          lines.push(currentLine);
          currentLine = w;
        } else {
          currentLine = test;
        }
      }
      if (currentLine) lines.push(currentLine);

      lines.slice(0, 3).forEach((ln, idx) => {
        ctx.fillText(ln, 72, baseBottomY - (lines.slice(0, 3).length - 1 - idx) * 66 - 96);
      });
    }

    if (subheadline.trim()) {
      ctx.fillStyle = '#d3cdc0';
      ctx.font = '400 27px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(subheadline.trim().slice(0, 68), 72, baseBottomY - 34);
    }

    if (ctaLabel.trim()) {
      const btnText = ctaLabel.trim();
      ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
      const btnW = Math.min(width - 144, Math.max(290, ctx.measureText(btnText).width + 84));
      const btnH = 68;
      const btnY = baseBottomY + 12;

      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.roundRect(72, btnY, btnW, btnH, 16);
      ctx.fill();

      ctx.fillStyle = '#090a0d';
      ctx.textAlign = 'center';
      ctx.fillText(btnText, 72 + btnW * 0.5, btnY + 43);
      ctx.textAlign = 'left';
    }
  }

  const dataUrl = c.toDataURL('image/webp', 0.9);
  const filename = `bujok-mobile-${format.replace('_', '-')}-${Math.round(pathProgress * 100)}pct.webp`;
  if (autoDownload) {
    triggerDownload(dataUrl, filename);
  }
  return { dataUrl, width, height, filename };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}
