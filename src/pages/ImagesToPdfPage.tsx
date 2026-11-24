import React, { useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  FilePlus2,
  ImagePlus,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { RouteId } from '../types/routes';
import { formatBytes, triggerBlobDownload } from '../utils/format';
import { generateClientTestImage, loadImageFromFile } from '../utils/imageProcessing';
import { AdSlot } from '../components/Layout';
import { ToolGuide } from '../components/ToolGuide';

interface ImagesToPdfPageProps {
  onNavigate: (route: RouteId) => void;
}

type PageSizeOption = 'a4' | 'letter' | 'fit';
type OrientationOption = 'auto' | 'portrait' | 'landscape';

interface QueuedImage {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
}

const PAGE_DIMENSIONS: Record<'a4' | 'letter', [number, number]> = {
  a4: [595.28, 841.89], // points (72 dpi)
  letter: [612, 792],
};

async function fileToNormalizedBytes(
  file: File
): Promise<{ bytes: Uint8Array; kind: 'png' | 'jpg' }> {
  const rawBytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === 'image/png') return { bytes: rawBytes, kind: 'png' };
  if (file.type === 'image/jpeg') return { bytes: rawBytes, kind: 'jpg' };

  // Convert WebP / GIF / BMP / SVG to PNG via HTML5 Canvas so pdf-lib embeds any image cleanly
  const { img, objectUrl } = await loadImageFromFile(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width || 1;
    canvas.height = img.naturalHeight || img.height || 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable.');
    ctx.drawImage(img, 0, 0);
    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to encode image for PDF.'))),
        'image/png'
      );
    });
    return { bytes: new Uint8Array(await pngBlob.arrayBuffer()), kind: 'png' };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export const ImagesToPdfPage: React.FC<ImagesToPdfPageProps> = ({
  onNavigate,
}) => {
  const [images, setImages] = useState<QueuedImage[]>([]);
  const [pageSize, setPageSize] = useState<PageSizeOption>('a4');
  const [orientation, setOrientation] = useState<OrientationOption>('auto');
  const [marginPt, setMarginPt] = useState<number>(24);
  const [isDragging, setIsDragging] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<QueuedImage[]>([]);
  imagesRef.current = images;

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  const addFiles = async (incoming: FileList | File[]) => {
    setErrorMsg(null);
    const valid = Array.from(incoming).filter(
      (f) =>
        f.type.startsWith('image/') ||
        /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(f.name)
    );

    if (valid.length === 0) {
      setErrorMsg('Please choose valid JPG, PNG, WebP, or GIF image files.');
      return;
    }

    const loaded: QueuedImage[] = [];
    for (const file of valid) {
      try {
        const { img, objectUrl } = await loadImageFromFile(file);
        loaded.push({
          id: `${file.name}-${crypto.randomUUID()}`,
          file,
          previewUrl: objectUrl,
          width: img.naturalWidth || img.width || 1,
          height: img.naturalHeight || img.height || 1,
        });
      } catch {
        setErrorMsg(`Could not decode ${file.name} as an image.`);
      }
    }

    if (loaded.length > 0) {
      setImages((prev) => [...prev, ...loaded]);
    }
  };

  const handleLoadSamples = async () => {
    const f1 = await generateClientTestImage('page-1-cover.png', false);
    const f2 = await generateClientTestImage('page-2-appendix.png', false);
    await addFiles([f1, f2]);
  };

  const moveItem = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    setImages((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const removeItem = (id: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const clearAll = () => {
    images.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setImages([]);
    setErrorMsg(null);
  };

  const handleGeneratePdf = async () => {
    if (images.length === 0) return;
    setIsBuilding(true);
    setErrorMsg(null);

    try {
      const pdfDoc = await PDFDocument.create();

      for (const item of images) {
        const { bytes, kind } = await fileToNormalizedBytes(item.file);
        const embedded =
          kind === 'jpg'
            ? await pdfDoc.embedJpg(bytes)
            : await pdfDoc.embedPng(bytes);

        const imgW = embedded.width;
        const imgH = embedded.height;

        if (pageSize === 'fit') {
          const page = pdfDoc.addPage([imgW, imgH]);
          page.drawImage(embedded, { x: 0, y: 0, width: imgW, height: imgH });
          continue;
        }

        const [baseShort, baseLong] = PAGE_DIMENSIONS[pageSize];
        let isLandscape = false;
        if (orientation === 'landscape') isLandscape = true;
        else if (orientation === 'portrait') isLandscape = false;
        else isLandscape = imgW > imgH;

        const pageW = isLandscape ? baseLong : baseShort;
        const pageH = isLandscape ? baseShort : baseLong;

        const availW = Math.max(10, pageW - marginPt * 2);
        const availH = Math.max(10, pageH - marginPt * 2);
        const scale = Math.min(availW / imgW, availH / imgH);

        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const drawX = (pageW - drawW) / 2;
        const drawY = (pageH - drawH) / 2;

        const page = pdfDoc.addPage([pageW, pageH]);
        page.drawImage(embedded, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      triggerBlobDownload(blob, 'localconvert-images.pdf');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to build PDF document.'
      );
    } finally {
      setIsBuilding(false);
    }
  };

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
          Images to PDF Converter
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Combine multiple JPG, PNG, or WebP images into a single ordered PDF with A4, US Letter, or exact-fit pages.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-6 border-b border-slate-200">
          <div className="space-y-1.5">
            <span className="block text-sm font-semibold text-slate-900">
              Page Size
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'a4', label: 'A4' },
                  { id: 'letter', label: 'Letter' },
                  { id: 'fit', label: 'Fit Image' },
                ] as { id: PageSizeOption; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPageSize(opt.id)}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                    pageSize === opt.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-sm font-semibold text-slate-900">
              Orientation
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'auto', label: 'Auto' },
                  { id: 'portrait', label: 'Portrait' },
                  { id: 'landscape', label: 'Landscape' },
                ] as { id: OrientationOption; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={pageSize === 'fit'}
                  onClick={() => setOrientation(opt.id)}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 ${
                    orientation === opt.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <label htmlFor="pdf-margin" className="font-semibold text-slate-900">
                Page Margin
              </label>
              <span className="font-mono text-xs font-semibold text-teal-800 tabular-nums">
                {pageSize === 'fit' ? '0 pt' : `${marginPt} pt`}
              </span>
            </div>
            <input
              id="pdf-margin"
              type="range"
              min={0}
              max={64}
              step={4}
              disabled={pageSize === 'fit'}
              value={marginPt}
              onChange={(e) => setMarginPt(Number(e.target.value))}
              className="w-full toolkit-slider disabled:opacity-40"
            />
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
            if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
          }}
          className={`rounded-xl border-2 border-dashed p-7 text-center transition-colors ${
            isDragging
              ? 'border-teal-700 bg-teal-50/70'
              : 'border-slate-300 bg-slate-50/70 hover:border-slate-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => {
              if (e.target.files?.length) {
                void addFiles(e.target.files);
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
                Drop images here to assemble a PDF
              </p>
              <p className="text-xs text-slate-500">
                Add JPG, PNG, WebP, or GIF pages and reorder them before exporting.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                <ImagePlus className="w-4 h-4" aria-hidden="true" />
                <span>Add Images</span>
              </button>
              <button
                type="button"
                onClick={() => void handleLoadSamples()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span>Load 2 Sample Pages</span>
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

        {images.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-slate-900 text-white px-5 py-4">
              <div className="text-sm font-mono tabular-nums">
                <strong>{images.length}</strong> page{images.length > 1 ? 's' : ''} queued ·{' '}
                <span className="text-teal-300">
                  {pageSize === 'fit' ? 'Fit to Image' : pageSize.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add More</span>
                </button>
                <button
                  type="button"
                  disabled={isBuilding}
                  onClick={() => void handleGeneratePdf()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-teal-400 hover:bg-teal-300 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {isBuilding ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>{isBuilding ? 'Building PDF…' : 'Create & Download PDF'}</span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
              {images.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-white flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="font-mono text-xs font-bold text-slate-500 w-7 text-center tabular-nums shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="w-12 h-12 rounded border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                      <img
                        src={item.previewUrl}
                        alt={`Page ${idx + 1}: ${item.file.name}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {item.file.name}
                      </p>
                      <p className="text-xs font-mono tabular-nums text-slate-500">
                        {item.width}×{item.height} px · {formatBytes(item.file.size)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveItem(idx, -1)}
                      aria-label={`Move ${item.file.name} up`}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-35 transition-colors"
                    >
                      <ArrowUp className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === images.length - 1}
                      onClick={() => moveItem(idx, 1)}
                      aria-label={`Move ${item.file.name} down`}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-35 transition-colors"
                    >
                      <ArrowDown className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remove ${item.file.name}`}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <AdSlot placement="mid" />

      <ToolGuide
        title="How It Works & Tips: Combining Images into a PDF"
        intro="Whether you are bundling photographed expense receipts, compiling scanned identity pages, or packaging design portfolio boards, sending personal files to cloud PDF builders exposes sensitive documents. LocalConvert assembles crisp, ordered multi-page PDFs locally inside your browser using pdf-lib."
        sections={[
          {
            heading: 'Choosing Between A4, US Letter & Fit to Image',
            body: 'Select A4 (210×297 mm) for international office printing or US Letter (8.5×11 in) for North American printers so every page shares uniform physical dimensions and clean margins. Choose Fit to Image when sharing digital slide decks, screenshots, or comic panels on screen so each PDF page matches the exact pixel aspect ratio of its source image.',
          },
          {
            heading: 'Automatic Per-Page Portrait & Landscape Orientation',
            body: 'Real-world batches frequently mix tall portrait smartphone scans with wide landscape charts. When Orientation is set to Auto, LocalConvert evaluates each image aspect ratio individually and assigns Portrait or Landscape to that specific page so content fills the printable area cleanly without awkward whitespace.',
          },
          {
            heading: 'Lossless PNG & Direct JPEG Stream Embedding',
            body: 'Standard JPG and PNG files are embedded directly into the PDF binary stream without extra lossy recompression, keeping text scans and photographs sharp. Modern formats such as WebP, SVG, GIF, or BMP are normalized cleanly via an off-screen HTML5 Canvas buffer before embedding.',
          },
          {
            heading: 'Zero-Upload Privacy for Receipts, Passports & Forms',
            body: 'Tax receipts, medical bills, signed leases, and identity documents remain strictly inside your browser memory from start to finish. Nothing is uploaded, cached, or stored on any external server.',
          },
        ]}
        tips={[
          'Use the Up and Down buttons in the queue to arrange cover sheets and appendices before building the PDF.',
          'Keep a 24pt margin on A4 or Letter PDFs so desktop inkjet and laser printers do not clip edge text.',
          'Compress oversized 12-megapixel camera photos first in Bulk Image Compressor if you need a compact email attachment.',
          'Pick Fit to Image for digital-only mood boards or multi-screenshot bug reports.',
        ]}
        faqs={[
          {
            question: 'Is there a limit on how many images I can combine into a single PDF?',
            answer:
              'LocalConvert imposes no server upload limits because the PDF is constructed inside your own browser RAM. Most devices handle dozens of photos effortlessly.',
          },
          {
            question: 'Can I mix JPG, PNG, and WebP images inside the same PDF?',
            answer:
              'Yes. You can add any combination of JPG, PNG, WebP, GIF, BMP, and SVG images and reorder them freely before exporting.',
          },
          {
            question: 'Why did a PDF made from raw smartphone photos turn out very large?',
            answer:
              'High-resolution camera photos are embedded at full detail. To shrink total PDF weight under 5 MB for email portals, run your photos through LocalConvert Bulk Image Compressor first.',
          },
          {
            question: 'Does LocalConvert add watermarks, ads, or branding footers to my PDF?',
            answer:
              'No. Every generated PDF page contains strictly your images and selected margins.',
          },
        ]}
      />
    </div>
  );
};
