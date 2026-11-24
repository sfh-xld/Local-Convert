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
  getExtensionForMime,
  stripExtension,
  triggerBlobDownload,
} from '../utils/format';
import {
  CompressionFormat,
  compressImageFile,
  generateClientTestImage,
  ProcessedImageResult,
} from '../utils/imageProcessing';
import { AdSlot } from '../components/Layout';
import { ToolGuide } from '../components/ToolGuide';

interface BulkCompressorPageProps {
  onNavigate: (route: RouteId) => void;
}

interface CompressedItem {
  id: string;
  file: File;
  status: 'processing' | 'done' | 'error';
  error?: string;
  result?: ProcessedImageResult;
}

const DIMENSION_PRESETS = [
  { label: 'Original', width: '', height: '' },
  { label: '1920px', width: '1920', height: '1920' },
  { label: '1280px', width: '1280', height: '1280' },
  { label: '800px', width: '800', height: '800' },
];

export const BulkCompressorPage: React.FC<BulkCompressorPageProps> = ({
  onNavigate,
}) => {
  const [items, setItems] = useState<CompressedItem[]>([]);
  const [quality, setQuality] = useState<number>(80);
  const [outputFormat, setOutputFormat] = useState<CompressionFormat>('original');
  const [maxWidthInput, setMaxWidthInput] = useState<string>('');
  const [maxHeightInput, setMaxHeightInput] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<CompressedItem[]>([]);
  itemsRef.current = items;

  // Cleanup all generated object URLs on unmount
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        if (item.result?.previewUrl) {
          URL.revokeObjectURL(item.result.previewUrl);
        }
      });
    };
  }, []);

  const parsedMaxWidth = maxWidthInput ? Math.max(1, parseInt(maxWidthInput, 10) || 0) : null;
  const parsedMaxHeight = maxHeightInput ? Math.max(1, parseInt(maxHeightInput, 10) || 0) : null;

  const processSingleFile = useCallback(
    async (
      id: string,
      file: File,
      q: number,
      mw: number | null,
      mh: number | null,
      fmt: CompressionFormat
    ) => {
      try {
        const result = await compressImageFile(file, {
          quality: q,
          maxWidth: mw,
          maxHeight: mh,
          outputFormat: fmt,
        });
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
                  error: err instanceof Error ? err.message : 'Compression failed.',
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
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const filesArray = Array.from(incoming).filter((file) =>
        validTypes.includes(file.type)
      );

      if (filesArray.length === 0) {
        setErrorMsg('Please select valid JPG, PNG, or WebP image files.');
        return;
      }

      const newEntries: CompressedItem[] = filesArray.map((file) => ({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        status: 'processing',
      }));

      setItems((prev) => [...prev, ...newEntries]);

      newEntries.forEach((entry) => {
        void processSingleFile(
          entry.id,
          entry.file,
          quality,
          parsedMaxWidth,
          parsedMaxHeight,
          outputFormat
        );
      });
    },
    [outputFormat, parsedMaxHeight, parsedMaxWidth, processSingleFile, quality]
  );

  // Re-compress queued items when settings change (debounced 220ms)
  useEffect(() => {
    if (itemsRef.current.length === 0) return;

    const timer = window.setTimeout(() => {
      const snapshot = itemsRef.current;
      setItems((prev) =>
        prev.map((entry) => ({ ...entry, status: 'processing' }))
      );
      snapshot.forEach((entry) => {
        void processSingleFile(
          entry.id,
          entry.file,
          quality,
          parsedMaxWidth,
          parsedMaxHeight,
          outputFormat
        );
      });
    }, 220);

    return () => window.clearTimeout(timer);
  }, [quality, parsedMaxWidth, parsedMaxHeight, outputFormat, processSingleFile]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleLoadSample = async () => {
    const sampleFile = await generateClientTestImage('localconvert-sample-photo.png', false);
    addFiles([sampleFile]);
  };

  const handleRemoveItem = (id: string) => {
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

  const handleDownloadSingle = (item: CompressedItem) => {
    if (!item.result) return;
    const ext = getExtensionForMime(item.result.mimeType);
    const outName = `${stripExtension(item.file.name)}-compressed.${ext}`;
    triggerBlobDownload(item.result.blob, outName);
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
        const ext = getExtensionForMime(item.result.mimeType);
        const base = `${stripExtension(item.file.name)}-compressed`;
        const count = usedNames.get(base) || 0;
        usedNames.set(base, count + 1);
        const finalName = count === 0 ? `${base}.${ext}` : `${base}-${count + 1}.${ext}`;
        zip.file(finalName, item.result.blob);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(zipBlob, 'localconvert-compressed-images.zip');
    } finally {
      setIsZipping(false);
    }
  };

  const doneItems = items.filter((i) => i.status === 'done' && i.result);
  const totalOriginalBytes = doneItems.reduce((acc, i) => acc + i.file.size, 0);
  const totalCompressedBytes = doneItems.reduce(
    (acc, i) => acc + (i.result?.blob.size ?? 0),
    0
  );
  const totalSavingsPct = calculateSavingsPercent(
    totalOriginalBytes,
    totalCompressedBytes
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            Bulk Image Compressor
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Compress JPG, PNG, and WebP images locally with custom quality and dimension limits.
          </p>
        </div>
      </div>

      {/* Main Tool Workspace */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
        {/* Compression Settings Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6 border-b border-slate-200">
          {/* Quality Slider */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="compressor-quality"
                className="text-sm font-semibold text-slate-900"
              >
                Compression Quality
              </label>
              <span className="font-mono text-sm font-semibold text-teal-800 tabular-nums">
                {quality}%
              </span>
            </div>
            <input
              id="compressor-quality"
              type="range"
              min={10}
              max={100}
              step={1}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full toolkit-slider"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>10% (Smallest file)</span>
              <span>80% (Balanced)</span>
              <span>100% (Max)</span>
            </div>
          </div>

          {/* Output Format */}
          <div className="lg:col-span-4 space-y-2">
            <span className="block text-sm font-semibold text-slate-900">
              Output Format
            </span>
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'original', label: 'Original' },
                  { id: 'image/webp', label: 'WebP' },
                  { id: 'image/jpeg', label: 'JPG' },
                  { id: 'image/png', label: 'PNG' },
                ] as { id: CompressionFormat; label: string }[]
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setOutputFormat(fmt.id)}
                  className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    outputFormat === fmt.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              WebP or JPG yields the highest byte reduction for photographs.
            </p>
          </div>

          {/* Max Width / Height */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">
                Max Dimensions (px)
              </span>
              <div className="flex items-center gap-1">
                {DIMENSION_PRESETS.map((preset) => {
                  const active =
                    maxWidthInput === preset.width &&
                    maxHeightInput === preset.height;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setMaxWidthInput(preset.width);
                        setMaxHeightInput(preset.height);
                      }}
                      className={`px-2 py-0.5 text-[11px] font-medium rounded border transition-colors ${
                        active
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="max-width-input" className="sr-only">
                  Max Width in pixels
                </label>
                <input
                  id="max-width-input"
                  type="number"
                  min={16}
                  max={10000}
                  placeholder="Max width (auto)"
                  value={maxWidthInput}
                  onChange={(e) => setMaxWidthInput(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700 tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="max-height-input" className="sr-only">
                  Max Height in pixels
                </label>
                <input
                  id="max-height-input"
                  type="number"
                  min={16}
                  max={10000}
                  placeholder="Max height (auto)"
                  value={maxHeightInput}
                  onChange={(e) => setMaxHeightInput(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700 tabular-nums"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
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
            accept="image/jpeg,image/png,image/webp"
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
                Drop JPG, PNG, or WebP images here
              </p>
              <p className="text-xs text-slate-500">
                Select multiple files at once. All compression happens inside your browser tab.
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
                <span>Load Sample Image</span>
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

        {/* Batch Summary & Results */}
        {items.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg bg-slate-900 text-white px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="text-slate-400 text-xs block">Files Ready</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {doneItems.length} / {items.length}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Original Total</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatBytes(totalOriginalBytes)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Compressed Total</span>
                  <span className="font-mono font-semibold tabular-nums text-teal-300">
                    {formatBytes(totalCompressedBytes)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Total Savings</span>
                  <span className="font-mono font-semibold tabular-nums text-teal-300">
                    {totalSavingsPct >= 0 ? `-${totalSavingsPct}%` : `+${Math.abs(totalSavingsPct)}%`}
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
                  <span>Clear All</span>
                </button>
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
                  <span>{isZipping ? 'Creating ZIP…' : 'Download All (.zip)'}</span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
              {items.map((item) => {
                const res = item.result;
                const savings = res
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
                            alt={`Compressed preview of ${item.file.name}`}
                            className="w-full h-full object-cover"
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
                          {item.file.name}
                        </p>

                        {item.status === 'processing' && (
                          <p className="text-xs text-slate-500">
                            Compressing locally…
                          </p>
                        )}

                        {item.status === 'error' && (
                          <p className="text-xs text-red-700">{item.error}</p>
                        )}

                        {item.status === 'done' && res && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 font-mono tabular-nums">
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
                                savings > 0 ? 'text-teal-700' : 'text-amber-700'
                              }`}
                            >
                              {savings >= 0
                                ? `${savings}% smaller`
                                : `${Math.abs(savings)}% larger`}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span>
                              {res.originalWidth}×{res.originalHeight}
                              {(res.width !== res.originalWidth ||
                                res.height !== res.originalHeight) &&
                                ` → ${res.width}×${res.height}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        disabled={item.status !== 'done' || !res}
                        onClick={() => handleDownloadSingle(item)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Download</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
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
        title="How It Works & Tips: Bulk Image Compression"
        intro="Large, unoptimized images are the single biggest cause of slow-loading web pages, bounced email attachments, and bloated cloud backups. LocalConvert's Bulk Image Compressor shrinks JPG, PNG, and WebP files directly inside your browser tab using the native HTML5 Canvas API—so your photographs never touch a remote server and encounter zero artificial upload caps."
        sections={[
          {
            heading: 'Understanding Lossy vs. Lossless Compression',
            body: 'JPEG and WebP employ smart perceptual compression that discards subtle high-frequency color transitions the human eye rarely notices. Lowering the quality slider from 100% to 75–85% routinely cuts photograph file sizes by 60% to 80% with virtually indistinguishable visual fidelity. Standard PNG is lossless by design, so resizing dimensions, applying subtle bit-depth reduction, or switching photographic PNGs to WebP or JPG yields dramatic byte savings.',
          },
          {
            heading: 'Resizing Oversized Camera Dimensions',
            body: 'Modern smartphones and mirrorless cameras capture 4000×3000 pixel or 24-megapixel photos, which are far larger than most websites, slide decks, or CMS platforms ever display. Setting a Max Width of 1920px for full-bleed hero banners or 1280px for editorial blog articles eliminates millions of redundant pixels while automatically preserving your original aspect ratio without distortion.',
          },
          {
            heading: 'Choosing the Ideal Output Format',
            body: 'Keep Original when you need strict compatibility with legacy desktop software or print workflows. Choose WebP for modern websites, Core Web Vitals optimization, and transparent UI graphics—it supports alpha channels at a fraction of PNG file weight. Choose JPG when sharing portraits or product shots via email or uploading to forms that disallow WebP.',
          },
          {
            heading: '100% Client-Side Privacy & Instant ZIP Batching',
            body: 'Whether you are preparing unreleased product photography, compressing scanned tax receipts, or optimizing client deliverables under a non-disclosure agreement, LocalConvert decodes and re-encodes every pixel strictly inside your device RAM. Once compression completes, inspect exact before-and-after byte deltas, download individual files, or package the entire batch into a local ZIP archive.',
          },
        ]}
        tips={[
          'Use 75–82% quality as the ideal balance between crisp detail and fast web delivery.',
          'Cap blog and e-commerce gallery images at 1280px max width to improve Largest Contentful Paint.',
          'Switch large photographic PNG screenshots to WebP or JPG for 70%+ file size reductions.',
          'Keep PNG selected when exporting pixel-exact UI diagrams, logos, or transparent overlays.',
        ]}
        faqs={[
          {
            question: 'Are my photos uploaded to a cloud server during bulk compression?',
            answer:
              'No. All image decoding, scaling, and re-encoding run locally inside your browser using HTML5 Canvas and JavaScript. Your files never leave your computer, tablet, or smartphone.',
          },
          {
            question: 'Why did a PNG file barely shrink when set to "Original" format?',
            answer:
              'PNG is a lossless format built for flat graphics rather than camera photographs. To reduce photographic PNGs significantly, lower the Max Width/Height preset or switch Output Format to WebP or JPG.',
          },
          {
            question: 'How many images can I compress in a single batch?',
            answer:
              'LocalConvert imposes no artificial file count or megabyte limits because processing runs in your own device memory. Modern laptops and phones handle batches of 20–50+ standard photos smoothly.',
          },
          {
            question: 'Does compressing transparent PNGs to JPG keep transparency?',
            answer:
              'No. The JPEG specification does not support alpha transparency, so transparent pixels are cleanly filled with solid white. Keep WebP or PNG selected if you need transparent backgrounds preserved.',
          },
        ]}
      />
    </div>
  );
};
