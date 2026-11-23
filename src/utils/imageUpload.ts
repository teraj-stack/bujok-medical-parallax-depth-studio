import { SceneAsset } from '../types/studio';

const MAX_UPLOAD_EDGE = 2048;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Nie udało się odczytać pliku: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Nieprawidłowy format obrazu.'));
    img.src = src;
  });
}

/**
 * Optimizes uploaded images (downscales huge >2048px files to crisp WebGL/video-ready size)
 * and builds ready-to-use SceneAsset entries with zero UI blocking.
 */
export async function prepareUploadedSceneAssets(
  files: File[] | FileList,
  templateScene: SceneAsset
): Promise<SceneAsset[]> {
  const fileArray = Array.from(files).filter(
    (f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|avif|bmp|gif)$/i.test(f.name)
  );
  if (fileArray.length === 0) return [];

  const created: SceneAsset[] = [];

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    const objectUrl = URL.createObjectURL(file);
    let finalDataUrl = '';
    let width = 0;
    let height = 0;

    try {
      const img = await loadImage(objectUrl);
      width = img.naturalWidth || img.width;
      height = img.naturalHeight || img.height;

      const scale = Math.min(1, MAX_UPLOAD_EDGE / Math.max(width, height, 1));
      const targetW = Math.max(1, Math.round(width * scale));
      const targetH = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, targetW, targetH);
        finalDataUrl = canvas.toDataURL('image/webp', 0.9);
      } else {
        finalDataUrl = await readFileAsDataUrl(file);
      }
    } catch {
      finalDataUrl = await readFileAsDataUrl(file);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }

    const cleanName = file.name.replace(/\.[^.]+$/, '') || `Obraz ${i + 1}`;
    const dimTag = width && height ? `${width}×${height}` : 'Własny obraz';

    created.push({
      ...templateScene,
      id: `upload_${Date.now()}_${i}`,
      title: cleanName.slice(0, 32),
      subtitle: `Wgrany obraz (${dimTag}) · gotowy do ścieżki 3D i 4 kadrów`,
      imageUrl: finalDataUrl,
      defaultNarrative: {
        ...templateScene.defaultNarrative,
        title: cleanName,
      },
    });
  }

  return created;
}

/**
 * Creates a lightweight 240x135 thumbnail so remote tablet controllers display scene previews
 * cleanly without transferring full multi-megabyte images over WebSocket.
 */
export async function createLightSceneThumbnail(imageUrl: string): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = imageUrl;
    });

    const w = 240;
    const h = 135;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const srcRatio = img.width / Math.max(1, img.height);
    const dstRatio = w / h;
    let drawW = w;
    let drawH = h;
    if (srcRatio > dstRatio) {
      drawW = h * srcRatio;
    } else {
      drawH = w / srcRatio;
    }
    ctx.drawImage(img, (w - drawW) * 0.5, (h - drawH) * 0.5, drawW, drawH);
    return canvas.toDataURL('image/webp', 0.72);
  } catch {
    return '';
  }
}
