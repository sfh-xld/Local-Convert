import { loadImageFromFile } from './imageProcessing';

export type TargetImageFormat = 'png' | 'jpg' | 'webp' | 'gif' | 'svg' | 'bmp';

export interface FormatOption {
  id: TargetImageFormat;
  label: string;
  ext: string;
  mime: string;
  supportsQuality: boolean;
  supportsAlpha: boolean;
}

export const TARGET_IMAGE_FORMATS: FormatOption[] = [
  {
    id: 'png',
    label: 'PNG',
    ext: 'png',
    mime: 'image/png',
    supportsQuality: false,
    supportsAlpha: true,
  },
  {
    id: 'jpg',
    label: 'JPG',
    ext: 'jpg',
    mime: 'image/jpeg',
    supportsQuality: true,
    supportsAlpha: false,
  },
  {
    id: 'webp',
    label: 'WebP',
    ext: 'webp',
    mime: 'image/webp',
    supportsQuality: true,
    supportsAlpha: true,
  },
  {
    id: 'gif',
    label: 'GIF',
    ext: 'gif',
    mime: 'image/gif',
    supportsQuality: false,
    supportsAlpha: true,
  },
  {
    id: 'svg',
    label: 'SVG',
    ext: 'svg',
    mime: 'image/svg+xml',
    supportsQuality: false,
    supportsAlpha: true,
  },
  {
    id: 'bmp',
    label: 'BMP',
    ext: 'bmp',
    mime: 'image/bmp',
    supportsQuality: false,
    supportsAlpha: false,
  },
];

export interface ConvertedImageOutput {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  format: FormatOption;
}

function encodeCanvasToBmpBlob(canvas: HTMLCanvasElement): Blob {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  const imgData = ctx.getImageData(0, 0, width, height).data;
  const rowStride = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowStride * height;
  const fileSize = 54 + pixelArraySize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // BITMAPFILEHEADER
  view.setUint8(0, 0x42); // 'B'
  view.setUint8(1, 0x4d); // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, 54, true);

  // BITMAPINFOHEADER
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive = bottom-up
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true); // 24-bit BGR
  view.setUint32(30, 0, true);
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  view.setUint32(46, 0, true);
  view.setUint32(50, 0, true);

  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y;
    const dstRowOffset = 54 + y * rowStride;
    for (let x = 0; x < width; x++) {
      const srcIdx = (srcRow * width + x) * 4;
      const dstIdx = dstRowOffset + x * 3;
      bytes[dstIdx] = imgData[srcIdx + 2]; // B
      bytes[dstIdx + 1] = imgData[srcIdx + 1]; // G
      bytes[dstIdx + 2] = imgData[srcIdx]; // R
    }
  }

  return new Blob([buffer], { type: 'image/bmp' });
}

/**
 * Encodes a Canvas frame into a valid 256-color GIF89a binary Blob using
 * a 6x6x6 RGB web palette + transparent index 216 and standard LZW encoding.
 */
function encodeCanvasToGifBlob(canvas: HTMLCanvasElement): Blob {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  const rgba = ctx.getImageData(0, 0, width, height).data;
  const pixelCount = width * height;
  const indexed = new Uint8Array(pixelCount);

  // Build 256-color table: 216 RGB cube (6*6*6) + 39 grays + index 255 reserved for transparency
  const colorTable = new Uint8Array(256 * 3);
  let idx = 0;
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        colorTable[idx++] = r * 51;
        colorTable[idx++] = g * 51;
        colorTable[idx++] = b * 51;
      }
    }
  }
  for (let i = 216; i < 255; i++) {
    const gray = Math.round(((i - 216) / 38) * 255);
    colorTable[idx++] = gray;
    colorTable[idx++] = gray;
    colorTable[idx++] = gray;
  }
  colorTable[255 * 3] = 0;
  colorTable[255 * 3 + 1] = 0;
  colorTable[255 * 3 + 2] = 0;

  let hasTransparency = false;
  for (let p = 0; p < pixelCount; p++) {
    const off = p * 4;
    if (rgba[off + 3] < 128) {
      indexed[p] = 255;
      hasTransparency = true;
    } else {
      const r = Math.round((rgba[off] / 255) * 5);
      const g = Math.round((rgba[off + 1] / 255) * 5);
      const b = Math.round((rgba[off + 2] / 255) * 5);
      indexed[p] = r * 36 + g * 6 + b;
    }
  }

  // LZW Compression (minCodeSize = 8)
  const out: number[] = [];
  const pushU16 = (v: number) => {
    out.push(v & 0xff, (v >> 8) & 0xff);
  };
  const pushStr = (s: string) => {
    for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
  };

  // Header & Logical Screen Descriptor
  pushStr('GIF89a');
  pushU16(width);
  pushU16(height);
  out.push(0xf7, 0x00, 0x00); // Global color table flag (1), 8-bit color, size 256 (2^(7+1))

  // Global Color Table
  for (let i = 0; i < colorTable.length; i++) {
    out.push(colorTable[i]);
  }

  // Graphic Control Extension (for transparency if needed)
  if (hasTransparency) {
    out.push(0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0xff, 0x00);
  }

  // Image Descriptor
  out.push(0x2c);
  pushU16(0);
  pushU16(0);
  pushU16(width);
  pushU16(height);
  out.push(0x00);

  // LZW Image Data
  const minCodeSize = 8;
  out.push(minCodeSize);
  const clearCode = 1 << minCodeSize; // 256
  const eoiCode = clearCode + 1; // 257

  const compressedBlocks: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;

  const writeBits = (code: number, size: number) => {
    bitBuffer |= code << bitCount;
    bitCount += size;
    while (bitCount >= 8) {
      compressedBlocks.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  let codeSize = minCodeSize + 1; // 9
  let nextCode = eoiCode + 1; // 258
  let dict = new Map<string, number>();

  const resetDict = () => {
    dict = new Map<string, number>();
    codeSize = minCodeSize + 1;
    nextCode = eoiCode + 1;
  };

  writeBits(clearCode, codeSize);

  let prefix = String(indexed[0] ?? 0);
  for (let i = 1; i < indexed.length; i++) {
    const k = indexed[i];
    const combined = `${prefix},${k}`;
    if (dict.has(combined)) {
      prefix = combined;
    } else {
      const code = prefix.includes(',')
        ? dict.get(prefix)!
        : Number(prefix);
      writeBits(code, codeSize);

      if (nextCode < 4096) {
        dict.set(combined, nextCode++);
        if (nextCode > 1 << codeSize && codeSize < 12) {
          codeSize++;
        }
      } else {
        writeBits(clearCode, codeSize);
        resetDict();
      }
      prefix = String(k);
    }
  }

  const lastCode = prefix.includes(',') ? dict.get(prefix)! : Number(prefix);
  writeBits(lastCode, codeSize);
  writeBits(eoiCode, codeSize);
  if (bitCount > 0) {
    compressedBlocks.push(bitBuffer & 0xff);
  }

  // Emit sub-blocks (max 255 bytes each)
  for (let i = 0; i < compressedBlocks.length; i += 255) {
    const chunk = compressedBlocks.slice(i, i + 255);
    out.push(chunk.length, ...chunk);
  }
  out.push(0x00); // Block terminator
  out.push(0x3b); // GIF Trailer

  return new Blob([new Uint8Array(out)], { type: 'image/gif' });
}

export async function convertImageToFormat(
  file: File,
  targetFormatId: TargetImageFormat,
  quality: number,
  bgColor: string
): Promise<ConvertedImageOutput> {
  const format =
    TARGET_IMAGE_FORMATS.find((f) => f.id === targetFormatId) ||
    TARGET_IMAGE_FORMATS[0];

  const { img, objectUrl } = await loadImageFromFile(file);

  try {
    const width = img.naturalWidth || img.width || 1;
    const height = img.naturalHeight || img.height || 1;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('HTML5 Canvas 2D context is unavailable.');

    if (!format.supportsAlpha) {
      ctx.fillStyle = bgColor || '#ffffff';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    let blob: Blob;
    if (format.id === 'bmp') {
      blob = encodeCanvasToBmpBlob(canvas);
    } else if (format.id === 'gif') {
      blob = encodeCanvasToGifBlob(canvas);
    } else if (format.id === 'svg') {
      const pngDataUrl = canvas.toDataURL('image/png');
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n  <image href="${pngDataUrl}" width="${width}" height="${height}" />\n</svg>`;
      blob = new Blob([svgContent], { type: 'image/svg+xml' });
    } else {
      const q = Math.min(1, Math.max(0.1, quality / 100));
      blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error(`Browser failed to encode ${format.label}.`));
          },
          format.mime,
          format.supportsQuality ? q : undefined
        );
      });
    }

    const previewUrl = URL.createObjectURL(blob);
    return { blob, previewUrl, width, height, format };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
