import React, { useCallback, useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  Archive,
  ArrowLeft,
  Download,
  FileImage,
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
  convertPngToWebP,
  generateClientTestImage,
  ProcessedImageResult,
} from '../utils/imageProcessing';
import { AdSlot } from '../components/Layout';
import { ToolGuide } from '../components/ToolGuide';

interface PngToWebpPageProps {
  onNavigate: (route: RouteId) => void;
}

interface WebpItem {
  id: string;
  file: File;
  status: 'processing' | 'done' | 'error';
  error?: string;
  result?: ProcessedImageResult;
}

export const PngToWebpPage: React.FC<PngToWebpPageProps> = ({ onNavigate }) => {
  const [items, setItems] = useState<WebpItem[]>([]);
  const [quality, setQuality] = useState<number>(85);
  const [isDragging, setIsDragging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<WebpItem[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        if (item.result?.previewUrl) {
          URL.revokeObjectURL(item.result.previewUrl);
        }
      });
    };
  }, []);

  const processItem = useCallback(
    async (id: string, file: File, q: number) => {
      try {
        const result = await convertPngToWebP(file, q);
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
                    err instanceof Error ? err.message : 'WebP conversion failed.',
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
      const pngFiles = Array.from(incoming).filter(
        (file) =>
          file.type === 'image/png' ||
          file.name.toLowerCase().endsWith('.png')
      );

      if (pngFiles.length === 0) {
        setErrorMsg('Please select one or more PNG (.png) image files.');
        return;
      }

      const newEntries: WebpItem[] = pngFiles.map((file) => ({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        status: 'processing',
      }));

      setItems((prev) => [...prev, ...newEntries]);
      newEntries.forEach((entry) => {
        void processItem(entry.id, entry.file, quality);
      });
    },
    [processItem, quality]
  );

  useEffect(() => {
    if (itemsRef.current.length === 0) return;

    const timer = window.setTimeout(() => {
      const snapshot = itemsRef.current;
      setItems((prev) =>
        prev.map((entry) => ({ ...entry, status: 'processing' }))
      );
      snapshot.forEach((entry) => {
        void processItem(entry.id, entry.file, quality);
      });
    }, 220);

    return () => window.clearTimeout(timer);
  }, [quality, processItem]);

  const handleLoadSample = async () => {
    const sampleFile = await generateClientTestImage(
      'transparent-graphic-sample.png',
      true
    );
    addFiles([sampleFile]);
  };

  const handleRemove = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.result?.previewUrl) {
        URL.revokeObjectURL(target.result.previewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleClearAll = () => {
    items.forEach((item) => {
      if (item.result?.previewUrl) {
        URL.revokeObjectURL(item.result.previewUrl);
      }
    });
    setItems([]);
    setErrorMsg(null);
  };

  const handleDownloadSingle = (item: WebpItem) => {
    if (!item.result) return;
    const filename = `${stripExtension(item.file.name)}.webp`;
    triggerBlobDownload(item.result.blob, filename);
  };

  const handleDownloadAllZip = async () => {
    const completed = items.filter((i) => i.status === 'done' && i.result);
    if (completed.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      const usedNames = new Map<string, number>();

      completed.forEach((item) => {
        if (!item.result) return;
        const base = stripExtension(item.file.name);
        const count = usedNames.get(base) || 0;
        usedNames.set(base, count + 1);
        const finalName = count === 0 ? `${base}.webp` : `${base}-${count + 1}.webp`;
        zip.file(finalName, item.result.blob);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(zipBlob, 'localconvert-webp-images.zip');
    } finally {
      setIsZipping(false);
    }
  };

  const doneItems = items.filter((i) => i.status === 'done' && i.result);
  const totalPngBytes = doneItems.reduce((acc, i) => acc + i.file.size, 0);
  const totalWebpBytes = doneItems.reduce(
    (acc, i) => acc + (i.result?.blob.size ?? 0),
    0
  );
  const totalSavings = calculateSavingsPercent(totalPngBytes, totalWebpBytes);

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
          PNG to WebP Converter
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Convert single or multiple PNG files to compact WebP format using HTML5 Canvas with alpha transparency preserved.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
        {/* Quality Slider */}
        <div className="max-w-md space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="webp-quality"
              className="text-sm font-semibold text-slate-900"
            >
              WebP Encoding Quality
            </label>
            <span className="font-mono text-sm font-semibold text-teal-800 tabular-nums">
              {quality}%
            </span>
          </div>
          <input
            id="webp-quality"
            type="range"
            min={10}
            max={100}
            step={1}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="w-full toolkit-slider"
          />
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>10% (Smallest)</span>
            <span>85% (Recommended)</span>
            <span>100% (Crispest)</span>
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
            if (e.dataTransfer.files?.length) {
              addFiles(e.dataTransfer.files);
            }
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
            accept="image/png,.png"
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
                Drop PNG files here to convert to WebP
              </p>
              <p className="text-xs text-slate-500">
                Supports transparent logos, UI screenshots, and high-resolution PNG graphics.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                <FileImage className="w-4 h-4" aria-hidden="true" />
                <span>Select PNG Files</span>
              </button>
              <button
                type="button"
                onClick={() => void handleLoadSample()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span>Load Transparent Sample</span>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg bg-slate-900 text-white px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="text-slate-400 text-xs block">Converted</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {doneItems.length} / {items.length}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Original PNGs</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatBytes(totalPngBytes)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">WebP Total</span>
                  <span className="font-mono font-semibold tabular-nums text-teal-300">
                    {formatBytes(totalWebpBytes)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Size Savings</span>
                  <span className="font-mono font-semibold tabular-nums text-teal-300">
                    {totalSavings >= 0 ? `-${totalSavings}%` : `+${Math.abs(totalSavings)}%`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear</span>
                </button>
                {items.length > 1 && (
                  <button
                    type="button"
                    disabled={doneItems.length === 0 || isZipping}
                    onClick={() => void handleDownloadAllZip()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-teal-400 hover:bg-teal-300 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                  >
                    {isZipping ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Archive className="w-4 h-4" aria-hidden="true" />
                    )}
                    <span>{isZipping ? 'Zipping…' : 'Download All (.zip)'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => {
                const res = item.result;
                const savings = res
                  ? calculateSavingsPercent(item.file.size, res.blob.size)
                  : 0;

                return (
                  <article
                    key={item.id}
                    className="rounded-lg border border-slate-200 bg-white overflow-hidden flex flex-col justify-between"
                  >
                    <div className="h-40 checkerboard-bg border-b border-slate-200 flex items-center justify-center p-2">
                      {res ? (
                        <img
                          src={res.previewUrl}
                          alt={`WebP preview of ${item.file.name}`}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <Loader2
                          className="w-6 h-6 text-slate-400 animate-spin"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {stripExtension(item.file.name)}.webp
                        </p>
                        {item.status === 'done' && res ? (
                          <div className="mt-1 space-y-0.5 text-xs font-mono tabular-nums text-slate-600">
                            <p>
                              {formatBytes(item.file.size)} →{' '}
                              <strong className="text-slate-900">
                                {formatBytes(res.blob.size)}
                              </strong>
                            </p>
                            <p
                              className={`font-semibold ${
                                savings > 0 ? 'text-teal-700' : 'text-amber-700'
                              }`}
                            >
                              {savings >= 0
                                ? `${savings}% smaller`
                                : `${Math.abs(savings)}% larger`}{' '}
                              · {res.width}×{res.height}
                            </p>
                          </div>
                        ) : item.status === 'error' ? (
                          <p className="text-xs text-red-700 mt-1">{item.error}</p>
                        ) : (
                          <p className="text-xs text-slate-500 mt-1">
                            Converting to WebP…
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={item.status !== 'done' || !res}
                          onClick={() => handleDownloadSingle(item)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 rounded-lg transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Download WebP</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.id)}
                          aria-label={`Remove ${item.file.name}`}
                          className="inline-flex items-center justify-center w-9 h-9 border border-slate-200 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <AdSlot placement="mid" />

      <ToolGuide
        title="How It Works & Tips: Converting PNG to WebP"
        intro="WebP is a modern web image format engineered specifically to replace heavy PNG and JPEG files without sacrificing visual clarity. Using LocalConvert's browser-based HTML5 Canvas encoder, you can convert transparent icons, product cutouts, and high-DPI screenshots into lightweight WebP assets instantaneously with zero server transfers."
        sections={[
          {
            heading: 'Why WebP Outperforms Legacy PNG on the Web',
            body: 'Traditional PNG files store every pixel losslessly using DEFLATE compression, which often produces multi-megabyte downloads for retina screenshots, hero illustrations, and transparent graphics. WebP employs predictive block coding across neighboring pixels, routinely shrinking PNG file sizes by 55% to 85% while keeping sharp vector-like edges and smooth gradients crisp.',
          },
          {
            heading: 'Full 8-Bit Alpha Transparency Preservation',
            body: 'Unlike JPEG—which flattens transparent pixels onto a solid backdrop—WebP natively supports full 8-bit alpha transparency including soft drop shadows and anti-aliased edges. Check the subtle checkerboard pattern behind your converted thumbnails above: any transparent pixels in your source PNG remain cleanly transparent in the exported WebP file.',
          },
          {
            heading: 'SEO, Page Speed & Core Web Vitals Gains',
            body: 'Search engines measure Largest Contentful Paint (LCP) and total page weight when ranking websites. Replacing oversized PNG assets with WebP slashes image transfer payloads dramatically, helping mobile visitors load pages faster, lowering hosting bandwidth costs, and boosting Lighthouse performance audits.',
          },
          {
            heading: 'Zero-Upload Browser Canvas Encoding',
            body: 'When you drop a PNG into LocalConvert, your browser decodes the file into an off-screen HTML5 Canvas buffer and encodes the output directly via canvas.toBlob("image/webp"). No image bytes ever cross the internet, making this converter safe for confidential UI mockups, unreleased logos, and proprietary design deliverables.',
          },
        ]}
        tips={[
          'Set quality to 80–90% for crisp UI screenshots, app mockups, and transparent product cutouts.',
          'Choose 95–100% quality when converting thin 1px typography, charts, or technical schematics.',
          'Inspect converted transparent WebPs against both light and dark UI backgrounds before publishing.',
          'Export batches together as a single ZIP archive when migrating an entire website asset folder.',
        ]}
        faqs={[
          {
            question: 'Do all modern web browsers support WebP images?',
            answer:
              'Yes. Chrome, Safari, Firefox, Edge, iOS Safari, and Android browsers all natively support WebP with full alpha transparency, covering over 97% of global web traffic.',
          },
          {
            question: 'Will my PNG transparency be lost after converting to WebP?',
            answer:
              'No. The HTML5 Canvas pipeline clears the alpha buffer before drawing and encodes the WebP transparency channel directly, preserving soft shadows and cutouts cleanly.',
          },
          {
            question: 'Why is a tiny 8 KB icon occasionally slightly larger at 100% WebP quality?',
            answer:
              'Already-optimized 8-bit indexed PNG icons can sometimes be smaller than a 100%-quality WebP file. Lowering the quality slider to 80–85% usually yields immediate savings.',
          },
          {
            question: 'Can I convert confidential product mockups safely here?',
            answer:
              'Yes. Because all conversion happens strictly inside your browser tab memory with zero backend APIs, confidential files never leave your computer or phone.',
          },
        ]}
      />
    </div>
  );
};
