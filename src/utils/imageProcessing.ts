export type CompressionFormat = 'original' | 'image/jpeg' | 'image/webp' | 'image/png';

export interface CompressOptions {
  quality: number; // 10 to 100
  maxWidth: number | null;
  maxHeight: number | null;
  outputFormat: CompressionFormat;
}

export interface ProcessedImageResult {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  mimeType: string;
}

export async function loadImageFromFile(file: File | Blob): Promise<{
  img: HTMLImageElement;
  objectUrl: string;
}> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Unable to decode image file.'));
      element.src = objectUrl;
    });
    return { img, objectUrl };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

export function computeFitDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number | null,
  maxHeight: number | null
): { width: number; height: number } {
  let width = sourceWidth;
  let height = sourceHeight;

  if (maxWidth && maxWidth > 0 && width > maxWidth) {
    const ratio = maxWidth / width;
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  if (maxHeight && maxHeight > 0 && height > maxHeight) {
    const ratio = maxHeight / height;
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

function canvasToBlobAsync(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error(`Browser failed to encode ${mimeType}.`));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Compresses an image file completely client-side via HTML5 Canvas.
 * For JPEG/WebP, uses native quality encoding.
 * For PNG at quality < 100, applies subtle color-channel bit-depth quantization
 * so PNG outputs also achieve meaningful byte savings while keeping alpha.
 */
export async function compressImageFile(
  file: File,
  options: CompressOptions
): Promise<ProcessedImageResult> {
  const { img, objectUrl } = await loadImageFromFile(file);

  try {
    const originalWidth = img.naturalWidth || img.width;
    const originalHeight = img.naturalHeight || img.height;
    const { width, height } = computeFitDimensions(
      originalWidth,
      originalHeight,
      options.maxWidth,
      options.maxHeight
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('HTML5 Canvas 2D context is unavailable.');
    }

    let targetMime: string =
      options.outputFormat === 'original' ? file.type || 'image/jpeg' : options.outputFormat;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(targetMime)) {
      targetMime = 'image/jpeg';
    }

    // Fill white background if saving to JPEG (which has no alpha channel)
    if (targetMime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // Optional PNG color quantization when quality < 95 to reduce PNG entropy
    if (targetMime === 'image/png' && options.quality < 95) {
      const levels = Math.max(8, Math.round((options.quality / 100) * 64));
      const step = 255 / (levels - 1);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round(Math.round(data[i] / step) * step);
        data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
        data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
      }
      ctx.putImageData(imageData, 0, 0);
    }

    const qualityFraction = Math.min(1, Math.max(0.1, options.quality / 100));
    const blob = await canvasToBlobAsync(
      canvas,
      targetMime,
      targetMime === 'image/png' ? undefined : qualityFraction
    );

    const previewUrl = URL.createObjectURL(blob);
    return {
      blob,
      previewUrl,
      width,
      height,
      originalWidth,
      originalHeight,
      mimeType: targetMime,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function convertPngToWebP(
  file: File,
  quality: number
): Promise<ProcessedImageResult> {
  const { img, objectUrl } = await loadImageFromFile(file);

  try {
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('HTML5 Canvas 2D context is unavailable.');
    }

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const qualityFraction = Math.min(1, Math.max(0.1, quality / 100));
    const blob = await canvasToBlobAsync(canvas, 'image/webp', qualityFraction);
    const previewUrl = URL.createObjectURL(blob);

    return {
      blob,
      previewUrl,
      width,
      height,
      originalWidth: width,
      originalHeight: height,
      mimeType: 'image/webp',
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Generates a real PNG File in-memory via HTML5 Canvas so users can test
 * any tool immediately without needing external sample assets.
 */
export async function generateClientTestImage(
  filename = 'sample-photo.png',
  transparent = false
): Promise<File> {
  const width = 1280;
  const height = 854;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  if (!transparent) {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.55, '#134e4a');
    grad.addColorStop(1, '#0f766e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  // Draw crisp layered geometric shapes and subtle texture noise for realistic compression delta
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath();
  ctx.arc(width * 0.72, height * 0.35, 240, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(20, 184, 166, 0.32)';
  ctx.beginPath();
  ctx.arc(width * 0.3, height * 0.65, 290, 0, Math.PI * 2);
  ctx.fill();

  // Add fine photographic grain across canvas so lossless PNG is noticeably larger than WebP/JPG
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 0) {
      const noise = ((i * 2654435761) % 19) - 9;
      d[i] = Math.min(255, Math.max(0, d[i] + noise));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + noise));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + noise));
    }
  }
  ctx.putImageData(imgData, 0, 0);

  ctx.fillStyle = transparent ? '#0f172a' : '#ffffff';
  ctx.font = '700 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LocalConvert Sample Asset', width / 2, height / 2 - 12);
  ctx.fillStyle = transparent ? '#0f766e' : 'rgba(241, 245, 249, 0.85)';
  ctx.font = '500 22px system-ui, sans-serif';
  ctx.fillText('Generated 100% locally in your browser', width / 2, height / 2 + 34);

  const blob = await canvasToBlobAsync(canvas, 'image/png');
  return new File([blob], filename, { type: 'image/png' });
}
