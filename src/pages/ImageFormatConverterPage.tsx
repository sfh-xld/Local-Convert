import React, { useCallback, useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  Archive,
  ArrowLeft,
  Download,
  ImagePlus,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { RouteId } from '../types/routes';
import {
  calculateSavingsPercent,
  formatBytes,
  stripExtension,
  triggerBlobDownload,
} from '../utils/format';
import {
  ConvertedImageOutput,
  convertImageToFormat,
  TARGET_IMAGE_FORMATS,
  TargetImageFormat,
} from '../utils/imageConverter';
import { generateClientTestImage } from '../utils/imageProcessing';
import { AdSlot } from '../components/Layout';
import { ToolGuide } from '../components/ToolGuide';

interface ImageFormatConverterPageProps {
  onNavigate: (route: RouteId) => void;
}

interface ConverterItem {
  id: string;
  file: File;
  status: 'processing' | 'done' | 'error';
  error?: string;
  result?: ConvertedImageOutput;
}

const ACCEPTED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/bmp',
  'image/x-ms-bmp',
  'image/avif',
]);

export const ImageFormatConverterPage: React.FC<ImageFormatConverterPageProps> = ({
  onNavigate,
}) => {
  const [items, setItems] = useState<ConverterItem[]>([]);
  const [targetFormat, setTargetFormat] = useState<TargetImageFormat>('png');
  const [quality, setQuality] = useState<number>(88);
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [isDragging, setIsDragging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<ConverterItem[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        if (item.result?.previewUrl) URL.revokeObjectURL(item.result.previewUrl);
      });
    };
  }, []);

  const selectedFormatMeta =
    TARGET_IMAGE_FORMATS.find((f) => f.id === targetFormat) ||
    TARGET_IMAGE_FORMATS[0];

  const convertSingle = useCallback(
    async (
      id: string,
      file: File,
      fmt: TargetImageFormat,
      q: number,
      bg: string
    ) => {
      try {
        const result = await convertImageToFormat(file, fmt, q, bg);
        setItems((prev) =>
          prev.map((entry) => {
            if (entry.id !== id) return entry;
            if (entry.result?.previewUrl) {
              URL.revokeObjectURL(entry.result.previewUrl);
            }
            return { ...entry, status: 'done', result, error: undefined };
          })
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  status: 'error',
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Image conversion failed.',
                }
              : entry
          )
        );
      }
    },
    []
  );

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      setErrorMsg(null);
      const valid = Array.from(incoming).filter(
        (file) =>
          ACCEPTED_MIME_TYPES.has(file.type) ||
          /\.(png|jpe?g|webp|gif|svg|bmp|avif)$/i.test(file.name)
      );

      if (valid.length === 0) {
        setErrorMsg(
          'Unsupported file type. Please choose PNG, JPG, WebP, GIF, SVG, or BMP images.'
        );
        return;
      }

      const entries: ConverterItem[] = valid.map((file) => ({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        status: 'processing',
      }));

      setItems((prev) => [...prev, ...entries]);
      entries.forEach((entry) => {
        void convertSingle(entry.id, entry.file, targetFormat, quality, bgColor);
      });
    },
    [bgColor, convertSingle, quality, targetFormat]
  );

  useEffect(() => {
    if (itemsRef.current.length === 0) return;

    const timer = window.setTimeout(() => {
      const snapshot = itemsRef.current;
      setItems((prev) =>
        prev.map((entry) => ({ ...entry, status: 'processing' }))
      );
      snapshot.forEach((entry) => {
        void convertSingle(entry.id, entry.file, targetFormat, quality, bgColor);
      });
    }, 200);

    return () => window.clearTimeout(timer);
  }, [targetFormat, quality, bgColor, convertSingle]);

  const handleLoadSample = async () => {
    const sample = await generateClientTestImage('transparent-sample.png', true);
    addFiles([sample]);
  };

  const handleRemove = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.result?.previewUrl) URL.revokeObjectURL(target.result.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleClearAll = () => {
    items.forEach((item) => {
      if (item.result?.previewUrl) URL.revokeObjectURL(item.result.previewUrl);
    });
    setItems([]);
    setErrorMsg(null);
  };

  const handleDownloadSingle = (item: ConverterItem) => {
    if (!item.result) return;
    const filename = `${stripExtension(item.file.name)}.${item.result.format.ext}`;
    triggerBlobDownload(item.result.blob, filename);
  };

  const handleDownloadZip = async () => {
    const completed = items.filter((i) => i.status === 'done' && i.result);
    if (completed.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const used = new Map<string, number>();
      completed.forEach((item) => {
        if (!item.result) return;
        const base = stripExtension(item.file.name);
        const ext = item.result.format.ext;
        const count = used.get(base) || 0;
        used.set(base, count + 1);
        const name = count === 0 ? `${base}.${ext}` : `${base}-${count + 1}.${ext}`;
        zip.file(name, item.result.blob);
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(blob, `localconvert-converted-${targetFormat}.zip`);
    } finally {
      setIsZipping(false);
    }
  };

  const doneItems = items.filter((i) => i.status === 'done' && i.result);

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
          Universal Image Format Converter
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Convert between PNG, JPG, WebP, GIF, SVG, and BMP directly in your browser using HTML5 Canvas.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
        {/* Controls Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6 border-b border-slate-200">
          <div className="lg:col-span-5 space-y-2">
            <span className="block text-sm font-semibold text-slate-900">
              Convert To Format
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 p-1 bg-slate-100 rounded-lg">
              {TARGET_IMAGE_FORMATS.map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setTargetFormat(fmt.id)}
                  className={`py-1.5 px-2 text-xs font-mono font-semibold rounded-md transition-colors ${
                    targetFormat === fmt.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              {selectedFormatMeta.supportsAlpha
                ? `${selectedFormatMeta.label} preserves transparent backgrounds.`
                : `${selectedFormatMeta.label} does not support transparency; transparent areas use your background fill color.`}
            </p>
          </div>

          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="converter-quality"
                className="text-sm font-semibold text-slate-900"
              >
                Quality {selectedFormatMeta.supportsQuality ? '' : '(N/A for lossless/indexed)'}
              </label>
              <span className="font-mono text-sm font-semibold text-teal-800 tabular-nums">
                {selectedFormatMeta.supportsQuality ? `${quality}%` : '—'}
              </span>
            </div>
            <input
              id="converter-quality"
              type="range"
              min={10}
              max={100}
              disabled={!selectedFormatMeta.supportsQuality}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full toolkit-slider disabled:opacity-40"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>10%</span>
              <span>Applies to JPG &amp; WebP</span>
              <span>100%</span>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-2">
            <label
              htmlFor="converter-bg-fill"
              className="block text-sm font-semibold text-slate-900"
            >
              Background Fill (JPG / BMP)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="converter-bg-fill"
                type="color"
                disabled={selectedFormatMeta.supportsAlpha}
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-10 h-10 p-0.5 rounded border border-slate-300 cursor-pointer disabled:opacity-40 shrink-0"
              />
              <input
                type="text"
                aria-label="Background fill hex color"
                disabled={selectedFormatMeta.supportsAlpha}
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            isDragging
              ? 'border-teal-700 bg-teal-50/70'
              : 'border-slate-300 bg-slate-50/70 hover:border-slate-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.svg,.bmp"
            onChange={(e) => {
              if (e.target.files?.length) {
                addFiles(e.target.files);
                e.target.value = '';
              }
            }}
            className="hidden"
          />
          <div className="mx-auto max-w-md space-y-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 text-teal-700 flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="font-display text-base font-semibold text-slate-900">
                Drop PNG, JPG, WebP, GIF, SVG, or BMP files here
              </p>
              <p className="text-xs text-slate-500">
                Batch convert multiple images locally without uploading to any server.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                <ImagePlus className="w-4 h-4" aria-hidden="true" />
                <span>Select Images</span>
              </button>
              <button
                type="button"
                onClick={() => void handleLoadSample()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span>Load Sample Asset</span>
              </button>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {errorMsg}
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-slate-900 text-white px-5 py-3.5">
              <div className="text-sm font-mono tabular-nums">
                Converted <strong>{doneItems.length}</strong> / {items.length} file(s) to{' '}
                <strong className="text-teal-300">{selectedFormatMeta.label}</strong>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear</span>
                </button>
                <button
                  type="button"
                  disabled={doneItems.length === 0 || isZipping}
                  onClick={() => void handleDownloadZip()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-teal-400 hover:bg-teal-300 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {isZipping ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Archive className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>{isZipping ? 'Creating ZIP…' : 'Download All (.zip)'}</span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
              {items.map((item) => {
                const res = item.result;
                const delta = res
                  ? calculateSavingsPercent(item.file.size, res.blob.size)
                  : 0;
                return (
                  <div
                    key={item.id}
                    className="p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-16 h-16 rounded-lg border border-slate-200 checkerboard-bg overflow-hidden shrink-0 flex items-center justify-center">
                        {res ? (
                          <img
                            src={res.previewUrl}
                            alt={`Converted preview of ${item.file.name}`}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Loader2
                            className="w-5 h-5 text-slate-400 animate-spin"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {stripExtension(item.file.name)}.{selectedFormatMeta.ext}
                        </p>
                        {item.status === 'done' && res ? (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono tabular-nums text-slate-600">
                            <span>
                              {formatBytes(item.file.size)} →{' '}
                              <strong className="text-slate-900">
                                {formatBytes(res.blob.size)}
                              </strong>
                            </span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span
                              className={`font-semibold ${
                                delta >= 0 ? 'text-teal-700' : 'text-amber-700'
                              }`}
                            >
                              {delta >= 0
                                ? `${delta}% smaller`
                                : `${Math.abs(delta)}% larger`}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span>
                              {res.width}×{res.height}
                            </span>
                          </div>
                        ) : item.status === 'error' ? (
                          <p className="text-xs text-red-700">{item.error}</p>
                        ) : (
                          <p className="text-xs text-slate-500">Converting locally…</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        disabled={item.status !== 'done' || !res}
                        onClick={() => handleDownloadSingle(item)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 rounded-lg transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Download {selectedFormatMeta.label}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        aria-label={`Remove ${item.file.name}`}
                        className="inline-flex items-center justify-center w-9 h-9 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <AdSlot placement="mid" />

      <ToolGuide
        title="How It Works & Tips: Universal Image Format Conversion"
        intro="Different software tools and upload portals demand specific image formats—an older form may reject WebP, Windows utilities may require BMP or JPG, and modern design tools expect PNG or SVG wrappers. LocalConvert converts smoothly across six major formats directly inside browser memory with zero remote uploads."
        sections={[
          {
            heading: 'Flattening Transparency Safely for JPG & BMP',
            body: 'Formats such as PNG, WebP, GIF, and SVG support transparent backgrounds, whereas JPG and 24-bit BMP store opaque pixels only. When converting a transparent logo or product cutout to JPG or BMP, use the Background Fill color picker to select the exact solid backdrop (clean white by default, or any custom hex color) before encoding.',
          },
          {
            heading: 'Dedicated Client-Side Encoders for GIF, BMP & SVG',
            body: 'Standard browser Canvas APIs only encode PNG, JPG, and WebP natively. To ensure every output is authentic, LocalConvert includes built-in JavaScript binary encoders that write genuine 24-bit BMP headers and LZW-compressed GIF89a files, alongside clean XML SVG wrappers with embedded lossless pixel data.',
          },
          {
            heading: 'Choosing Between PNG, JPG, WebP, GIF, SVG & BMP',
            body: 'Pick WebP for modern websites where compact file size and transparency both matter. Pick JPG for camera photographs with smooth tonal gradients when broad compatibility is essential. Pick PNG for crisp UI screenshots and pixel-accurate diagrams, GIF for 256-color web graphics, or BMP for uncompressed bitmap workflows.',
          },
          {
            heading: 'Private Batch Processing & Instant ZIP Export',
            body: 'Because every image buffer stays exclusively in local browser RAM, you can convert confidential design mockups, scanned documents, or product catalogs in bulk and download the entire batch as a single ZIP archive without uploading a single byte.',
          },
        ]}
        tips={[
          'Match your destination page background in Background Fill before converting transparent PNGs to JPG.',
          'Set quality to 85–90% when converting high-resolution photos to JPG or WebP.',
          'Use PNG or WebP rather than BMP whenever sharing graphics over email or messaging apps.',
          'Download batches with one click via Download All (.zip) when converting multi-file folders.',
        ]}
        faqs={[
          {
            question: 'Does converting a raster PNG or JPG to SVG trace it into editable vector paths?',
            answer:
              'Canvas-based SVG export embeds your full-resolution raster image inside a standards-compliant SVG container so it drops cleanly into SVG-only pipelines without distorting pixel details.',
          },
          {
            question: 'Why did my PNG file grow larger after converting to BMP?',
            answer:
              'BMP is an uncompressed raw bitmap format storing 24 bits for every pixel. Use WebP, JPG, or PNG when compact file size is your priority.',
          },
          {
            question: 'How does the converter handle animated GIFs?',
            answer:
              'HTML5 Canvas captures the first frame cleanly when converting animated GIFs into static PNG, JPG, WebP, BMP, SVG, or single-frame GIF outputs.',
          },
          {
            question: 'Are any converted images stored on LocalConvert servers?',
            answer:
              'Never. All decoding and binary encoding execute strictly inside your browser tab memory and vanish as soon as you clear the queue or close the page.',
          },
        ]}
      />
    </div>
  );
};
