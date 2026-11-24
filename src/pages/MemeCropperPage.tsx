import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Crop,
  Download,
  ImagePlus,
  RotateCcw,
} from 'lucide-react';
import { RouteId } from '../types/routes';
import { triggerBlobDownload } from '../utils/format';
import {
  generateClientTestImage,
  loadImageFromFile,
} from '../utils/imageProcessing';
import { AdSlot } from '../components/Layout';
import { ToolGuide } from '../components/ToolGuide';

interface MemeCropperPageProps {
  onNavigate: (route: RouteId) => void;
}

type AspectPresetId = '1:1' | '4:5' | '9:16' | '16:9' | 'free';

interface AspectPreset {
  id: AspectPresetId;
  label: string;
  sublabel: string;
  ratio: number | null; // width / height
}

const ASPECT_PRESETS: AspectPreset[] = [
  { id: '1:1', label: '1:1', sublabel: 'Square', ratio: 1 },
  { id: '4:5', label: '4:5', sublabel: 'Portrait', ratio: 4 / 5 },
  { id: '9:16', label: '9:16', sublabel: 'Story / Reel', ratio: 9 / 16 },
  { id: '16:9', label: '16:9', sublabel: 'Landscape', ratio: 16 / 9 },
  { id: 'free', label: 'Free', sublabel: 'Custom', ratio: null },
];

interface NormalizedRect {
  x: number; // 0..1 of image width
  y: number; // 0..1 of image height
  w: number; // 0..1 of image width
  h: number; // 0..1 of image height
}

function wrapMemeLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/);
  if (!words[0]) return [];
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${currentLine} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

function computeCenteredAspectRect(
  imgW: number,
  imgH: number,
  targetRatio: number | null
): NormalizedRect {
  if (!targetRatio) {
    return { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
  }
  const imgAspect = imgW / Math.max(1, imgH);
  let w = 0.88;
  let h = (w * imgAspect) / targetRatio;

  if (h > 0.88) {
    h = 0.88;
    w = (h * targetRatio) / imgAspect;
  }

  return {
    x: (1 - w) / 2,
    y: (1 - h) / 2,
    w,
    h,
  };
}

export const MemeCropperPage: React.FC<MemeCropperPageProps> = ({
  onNavigate,
}) => {
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);
  const [sourceName, setSourceName] = useState<string>('image');
  const [aspectId, setAspectId] = useState<AspectPresetId>('1:1');
  const [cropRect, setCropRect] = useState<NormalizedRect>({
    x: 0.1,
    y: 0.1,
    w: 0.8,
    h: 0.8,
  });

  // Meme text controls
  const [topText, setTopText] = useState<string>('');
  const [bottomText, setBottomText] = useState<string>('');
  const [fontSizePct, setFontSizePct] = useState<number>(8); // % of output shorter side
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [strokeColor, setStrokeColor] = useState<string>('#000000');
  const [strokeWidthPct, setStrokeWidthPct] = useState<number>(14); // % of font size
  const [uppercase, setUppercase] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const dragStateRef = useRef<{
    mode: 'move' | 'resize' | null;
    startClientX: number;
    startClientY: number;
    startRect: NormalizedRect;
  }>({
    mode: null,
    startClientX: 0,
    startClientY: 0,
    startRect: { x: 0, y: 0, w: 1, h: 1 },
  });

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const loadSelectedFile = useCallback(async (file: File) => {
    setErrorMsg(null);
    try {
      const { img, objectUrl } = await loadImageFromFile(file);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = objectUrl;
      setSourceImg(img);
      setSourceName(file.name.replace(/\.[^.]+$/, '') || 'image');

      const preset = ASPECT_PRESETS.find((p) => p.id === aspectId);
      setCropRect(
        computeCenteredAspectRect(
          img.naturalWidth || img.width,
          img.naturalHeight || img.height,
          preset?.ratio ?? null
        )
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to load image file.'
      );
    }
  }, [aspectId]);

  const handleLoadSample = async () => {
    const sample = await generateClientTestImage('localconvert-meme-base.png', false);
    setTopText('WHEN ALL YOUR IMAGES');
    setBottomText('STAY 100% ON YOUR DEVICE');
    await loadSelectedFile(sample);
  };

  const handleAspectChange = (newId: AspectPresetId) => {
    setAspectId(newId);
    if (!sourceImg) return;
    const preset = ASPECT_PRESETS.find((p) => p.id === newId);
    setCropRect(
      computeCenteredAspectRect(
        sourceImg.naturalWidth || sourceImg.width,
        sourceImg.naturalHeight || sourceImg.height,
        preset?.ratio ?? null
      )
    );
  };

  const renderMemeToCanvas = useCallback(
    (canvas: HTMLCanvasElement, targetMaxSide: number) => {
      if (!sourceImg) return;
      const imgW = sourceImg.naturalWidth || sourceImg.width;
      const imgH = sourceImg.naturalHeight || sourceImg.height;

      const sx = Math.round(cropRect.x * imgW);
      const sy = Math.round(cropRect.y * imgH);
      const sw = Math.max(1, Math.round(cropRect.w * imgW));
      const sh = Math.max(1, Math.round(cropRect.h * imgH));

      const scale =
        targetMaxSide > 0 && Math.max(sw, sh) > targetMaxSide
          ? targetMaxSide / Math.max(sw, sh)
          : 1;
      const outW = Math.max(1, Math.round(sw * scale));
      const outH = Math.max(1, Math.round(sh * scale));

      canvas.width = outW;
      canvas.height = outH;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceImg, sx, sy, sw, sh, 0, 0, outW, outH);

      const fontSize = Math.max(14, Math.round(Math.min(outW, outH) * (fontSizePct / 100)));
      const strokePx = Math.max(1, Math.round(fontSize * (strokeWidthPct / 100)));
      const lineHeight = fontSize * 1.15;
      const marginX = Math.round(outW * 0.05);
      const maxTextWidth = outW - marginX * 2;

      ctx.font = `900 ${fontSize}px Impact, "Arial Black", "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.fillStyle = textColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokePx;

      const formattedTop = uppercase ? topText.toUpperCase() : topText;
      const formattedBottom = uppercase ? bottomText.toUpperCase() : bottomText;

      if (formattedTop.trim()) {
        ctx.textBaseline = 'top';
        const lines = wrapMemeLines(ctx, formattedTop, maxTextWidth);
        const startY = Math.round(outH * 0.04);
        lines.forEach((line, i) => {
          const y = startY + i * lineHeight;
          ctx.strokeText(line, outW / 2, y);
          ctx.fillText(line, outW / 2, y);
        });
      }

      if (formattedBottom.trim()) {
        ctx.textBaseline = 'bottom';
        const lines = wrapMemeLines(ctx, formattedBottom, maxTextWidth);
        const endY = outH - Math.round(outH * 0.04);
        lines.forEach((line, i) => {
          const y = endY - (lines.length - 1 - i) * lineHeight;
          ctx.strokeText(line, outW / 2, y);
          ctx.fillText(line, outW / 2, y);
        });
      }
    },
    [
      sourceImg,
      cropRect,
      fontSizePct,
      strokeWidthPct,
      textColor,
      strokeColor,
      uppercase,
      topText,
      bottomText,
    ]
  );

  // Draw interactive Crop Editor Canvas + Live Preview Canvas
  useEffect(() => {
    if (!sourceImg) return;

    const editorCanvas = editorCanvasRef.current;
    if (editorCanvas) {
      const imgW = sourceImg.naturalWidth || sourceImg.width;
      const imgH = sourceImg.naturalHeight || sourceImg.height;

      // Fit editor canvas cleanly inside ~540px width
      const displayW = 540;
      const displayH = Math.round((imgH / Math.max(1, imgW)) * displayW);
      editorCanvas.width = displayW;
      editorCanvas.height = displayH;

      const ctx = editorCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(sourceImg, 0, 0, displayW, displayH);

        // Dim outer cropped-away area
        ctx.fillStyle = 'rgba(15, 23, 42, 0.58)';
        ctx.fillRect(0, 0, displayW, displayH);

        const rx = cropRect.x * displayW;
        const ry = cropRect.y * displayH;
        const rw = cropRect.w * displayW;
        const rh = cropRect.h * displayH;

        // Draw clear cropped window
        ctx.save();
        ctx.beginPath();
        ctx.rect(rx, ry, rw, rh);
        ctx.clip();
        ctx.drawImage(sourceImg, 0, 0, displayW, displayH);
        ctx.restore();

        // Rule-of-thirds guides
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        for (let k = 1; k <= 2; k++) {
          ctx.beginPath();
          ctx.moveTo(rx + (rw * k) / 3, ry);
          ctx.lineTo(rx + (rw * k) / 3, ry + rh);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(rx, ry + (rh * k) / 3);
          ctx.lineTo(rx + rw, ry + (rh * k) / 3);
          ctx.stroke();
        }

        // Crisp border around active crop region
        ctx.strokeStyle = '#14b8a6';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(rx, ry, rw, rh);

        // Bottom-right resize handle
        const handleSize = 14;
        ctx.fillStyle = '#14b8a6';
        ctx.fillRect(
          rx + rw - handleSize / 2,
          ry + rh - handleSize / 2,
          handleSize,
          handleSize
        );
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          rx + rw - handleSize / 2,
          ry + rh - handleSize / 2,
          handleSize,
          handleSize
        );
      }
    }

    const previewCanvas = previewCanvasRef.current;
    if (previewCanvas) {
      renderMemeToCanvas(previewCanvas, 720);
    }
  }, [sourceImg, cropRect, renderMemeToCanvas]);

  const handleEditorPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = editorCanvasRef.current;
    if (!canvas || !sourceImg) return;

    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    const handleX = cropRect.x + cropRect.w;
    const handleY = cropRect.y + cropRect.h;
    const nearHandle = Math.abs(nx - handleX) < 0.06 && Math.abs(ny - handleY) < 0.06;

    const insideCrop =
      nx >= cropRect.x &&
      nx <= cropRect.x + cropRect.w &&
      ny >= cropRect.y &&
      ny <= cropRect.y + cropRect.h;

    if (!nearHandle && !insideCrop) return;

    canvas.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      mode: nearHandle ? 'resize' : 'move',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startRect: { ...cropRect },
    };
  };

  const handleEditorPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = editorCanvasRef.current;
    const drag = dragStateRef.current;
    if (!canvas || !sourceImg || !drag.mode) return;

    const rect = canvas.getBoundingClientRect();
    const dx = (e.clientX - drag.startClientX) / rect.width;
    const dy = (e.clientY - drag.startClientY) / rect.height;

    if (drag.mode === 'move') {
      const nextX = Math.max(0, Math.min(1 - drag.startRect.w, drag.startRect.x + dx));
      const nextY = Math.max(0, Math.min(1 - drag.startRect.h, drag.startRect.y + dy));
      setCropRect({ ...drag.startRect, x: nextX, y: nextY });
      return;
    }

    if (drag.mode === 'resize') {
      const preset = ASPECT_PRESETS.find((p) => p.id === aspectId);
      const imgW = sourceImg.naturalWidth || sourceImg.width;
      const imgH = sourceImg.naturalHeight || sourceImg.height;
      const imgAspect = imgW / Math.max(1, imgH);

      let newW = Math.max(0.12, Math.min(1 - drag.startRect.x, drag.startRect.w + dx));

      if (preset?.ratio) {
        let newH = (newW * imgAspect) / preset.ratio;
        if (drag.startRect.y + newH > 1) {
          newH = 1 - drag.startRect.y;
          newW = (newH * preset.ratio) / imgAspect;
        }
        setCropRect({
          ...drag.startRect,
          w: Math.max(0.1, newW),
          h: Math.max(0.1, newH),
        });
      } else {
        const newH = Math.max(
          0.12,
          Math.min(1 - drag.startRect.y, drag.startRect.h + dy)
        );
        setCropRect({ ...drag.startRect, w: newW, h: newH });
      }
    }
  };

  const handleEditorPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragStateRef.current.mode) {
      dragStateRef.current.mode = null;
      editorCanvasRef.current?.releasePointerCapture(e.pointerId);
    }
  };

  const handleExport = (mime: 'image/png' | 'image/jpeg') => {
    if (!sourceImg) return;
    const exportCanvas = document.createElement('canvas');
    // Render at native cropped pixel dimensions (up to 2400px max edge for crispness)
    renderMemeToCanvas(exportCanvas, 2400);
    exportCanvas.toBlob(
      (blob) => {
        if (blob) {
          const ext = mime === 'image/png' ? 'png' : 'jpg';
          triggerBlobDownload(blob, `${sourceName}-cropped.${ext}`);
        }
      },
      mime,
      mime === 'image/jpeg' ? 0.92 : undefined
    );
  };

  const cropPixelW = sourceImg
    ? Math.round(cropRect.w * (sourceImg.naturalWidth || sourceImg.width))
    : 0;
  const cropPixelH = sourceImg
    ? Math.round(cropRect.h * (sourceImg.naturalHeight || sourceImg.height))
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-teal-700 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to All Tools</span>
        </button>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Social Media &amp; Meme Cropper
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Frame images to social aspect ratios, add outlined top/bottom meme captions, and export PNG or JPG locally.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              void loadSelectedFile(file);
              e.target.value = '';
            }
          }}
          className="hidden"
        />

        {!sourceImg ? (
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-10 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 text-teal-700 flex items-center justify-center mx-auto">
              <Crop className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="font-display text-base font-semibold text-slate-900">
                Upload an image to crop &amp; caption
              </p>
              <p className="text-xs text-slate-500">
                Supports JPG, PNG, and WebP. Drag the crop frame directly on the canvas.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                <ImagePlus className="w-4 h-4" aria-hidden="true" />
                <span>Choose Image</span>
              </button>
              <button
                type="button"
                onClick={() => void handleLoadSample()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span>Load Sample Meme Template</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Interactive Crop + Output Preview */}
            <div className="lg:col-span-7 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-600 font-mono tabular-nums">
                  Crop Output:{' '}
                  <strong className="text-slate-900">
                    {cropPixelW} × {cropPixelH} px
                  </strong>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const preset = ASPECT_PRESETS.find((p) => p.id === aspectId);
                      setCropRect(
                        computeCenteredAspectRect(
                          sourceImg.naturalWidth || sourceImg.width,
                          sourceImg.naturalHeight || sourceImg.height,
                          preset?.ratio ?? null
                        )
                      );
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Reset Frame</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                  >
                    <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Replace Image</span>
                  </button>
                </div>
              </div>

              {/* Aspect Ratio Preset Selector */}
              <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-100 rounded-lg">
                {ASPECT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleAspectChange(preset.id)}
                    className={`py-2 px-1 rounded-md text-center transition-colors ${
                      aspectId === preset.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="block text-xs font-bold font-mono">
                      {preset.label}
                    </span>
                    <span className="block text-[10px] text-slate-500 truncate">
                      {preset.sublabel}
                    </span>
                  </button>
                ))}
              </div>

              {/* Interactive Crop Canvas */}
              <div className="rounded-lg border border-slate-200 bg-slate-950 p-3 flex flex-col items-center">
                <canvas
                  ref={editorCanvasRef}
                  onPointerDown={handleEditorPointerDown}
                  onPointerMove={handleEditorPointerMove}
                  onPointerUp={handleEditorPointerUp}
                  onPointerCancel={handleEditorPointerUp}
                  className="max-w-full h-auto cursor-move touch-none rounded"
                />
                <p className="mt-2 text-[11px] text-slate-400">
                  Drag inside the green frame to move · Drag the bottom-right corner handle to resize
                </p>
              </div>
            </div>

            {/* Right: Meme Text Controls + Live Final Preview + Export */}
            <div className="lg:col-span-5 space-y-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                <h2 className="font-display text-sm font-bold text-slate-900">
                  Meme Caption Overlay (Optional)
                </h2>

                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="meme-top-text"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Top Caption
                    </label>
                    <input
                      id="meme-top-text"
                      type="text"
                      value={topText}
                      onChange={(e) => setTopText(e.target.value)}
                      placeholder="Optional top text…"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="meme-bottom-text"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Bottom Caption
                    </label>
                    <input
                      id="meme-bottom-text"
                      type="text"
                      value={bottomText}
                      onChange={(e) => setBottomText(e.target.value)}
                      placeholder="Optional bottom text…"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <label htmlFor="meme-font-size" className="font-medium text-slate-700">
                        Text Size
                      </label>
                      <span className="font-mono tabular-nums">{fontSizePct}%</span>
                    </div>
                    <input
                      id="meme-font-size"
                      type="range"
                      min={4}
                      max={16}
                      value={fontSizePct}
                      onChange={(e) => setFontSizePct(Number(e.target.value))}
                      className="w-full toolkit-slider"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <label htmlFor="meme-stroke-width" className="font-medium text-slate-700">
                        Outline Stroke
                      </label>
                      <span className="font-mono tabular-nums">{strokeWidthPct}%</span>
                    </div>
                    <input
                      id="meme-stroke-width"
                      type="range"
                      min={4}
                      max={28}
                      value={strokeWidthPct}
                      onChange={(e) => setStrokeWidthPct(Number(e.target.value))}
                      className="w-full toolkit-slider"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                      />
                      <span>Fill</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                      <input
                        type="color"
                        value={strokeColor}
                        onChange={(e) => setStrokeColor(e.target.value)}
                        className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                      />
                      <span>Outline</span>
                    </label>
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={uppercase}
                      onChange={(e) => setUppercase(e.target.checked)}
                      className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                    />
                    <span>ALL CAPS</span>
                  </label>
                </div>
              </div>

              {/* Live Final Output Preview */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">
                    Final Output Preview
                  </span>
                  <span className="font-mono tabular-nums">
                    {aspectId === 'free' ? 'Free Crop' : aspectId}
                  </span>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-100 p-2 flex items-center justify-center min-h-[180px] max-h-[300px]">
                  <canvas
                    ref={previewCanvasRef}
                    aria-label="Cropped meme output preview"
                    className="max-w-full max-h-[270px] w-auto h-auto rounded"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleExport('image/png')}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Download PNG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('image/jpeg')}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Download JPG</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {errorMsg}
          </div>
        )}
      </section>

      <AdSlot placement="mid" />

      <ToolGuide
        title="How It Works & Tips: Social Media & Meme Cropping"
        intro="Every social platform enforces strict aspect ratios—an unframed landscape photo gets awkwardly cropped inside Instagram Reels, LinkedIn feeds, or TikTok previews. LocalConvert's Social Media & Meme Cropper combines interactive HTML5 Canvas framing with crisp outlined caption typography directly inside your browser."
        sections={[
          {
            heading: 'Selecting the Best Social Aspect Ratio',
            body: 'Choose 1:1 Square for classic Instagram carousels, product thumbnails, and profile banners. Select 4:5 Portrait to capture maximum vertical screen real estate on Instagram and LinkedIn mobile feeds without automatic cropping. Pick 9:16 for TikTok, YouTube Shorts, and Instagram Stories, 16:9 for YouTube thumbnails and X/Twitter widescreen cards, or Free Crop for custom dimensions.',
          },
          {
            heading: 'High-Contrast Outlined Meme Typography',
            body: 'White Impact-style lettering paired with a dark outer stroke stays readable across bright skies, deep shadows, and detailed photographic textures. LocalConvert measures text width dynamically on the Canvas, wrapping long top and bottom lines cleanly inside a 5% horizontal safe margin while scaling stroke thickness proportionally with your output resolution.',
          },
          {
            heading: 'PNG vs. JPG Exports for Social Feeds',
            body: 'Download as PNG whenever your composition includes bold captions, flat vector graphics, or UI screenshots—PNG avoids compression halos around crisp lettering. Choose JPG at 92% quality when exporting pure photographic portraits where smaller upload sizes matter more than razor-sharp text edges.',
          },
          {
            heading: 'Watermark-Free & 100% Private Photo Framing',
            body: 'Many online meme generators publish uploaded photos to public galleries or stamp promotional watermarks across corners. LocalConvert renders every crop and caption locally inside volatile browser RAM, leaving zero watermarks, zero public logs, and zero remote copies.',
          },
        ]}
        tips={[
          'Use 4:5 Portrait instead of 1:1 Square to gain roughly 25% more vertical visibility in mobile feeds.',
          'Keep top and bottom captions concise—one or two punchy lines read fastest on small screens.',
          'Leave breathing room near top and bottom edges on 9:16 Stories so app UI buttons do not cover text.',
          'Export PNG before uploading captioned graphics to platforms that apply heavy feed recompression.',
        ]}
        faqs={[
          {
            question: 'Does LocalConvert add any watermark to exported images?',
            answer:
              'Never. Your downloaded PNG or JPG contains strictly your cropped photo and optional captions with zero branding marks.',
          },
          {
            question: 'Can I use this tool strictly as a clean aspect-ratio cropper without meme text?',
            answer:
              'Yes. Leave both Top Caption and Bottom Caption blank to export a pure, uncaptioned photograph framed to your chosen ratio.',
          },
          {
            question: 'Does dragging and resizing the crop box work on mobile touchscreens?',
            answer:
              'Yes. Pointer capture events let you drag the crop window or adjust the bottom-right corner handle smoothly on phones and tablets.',
          },
          {
            question: 'What output resolution does the cropper export?',
            answer:
              'Exports preserve the native cropped pixel dimensions of your source image (capped at 2400px on the longest edge) for sharp social uploads across Instagram, TikTok, LinkedIn, YouTube, and X without soft upscaling.',
          },
        ]}
      />
    </div>
  );
};
