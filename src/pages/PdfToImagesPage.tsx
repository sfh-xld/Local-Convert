import React, { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  Archive,
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Upload,
} from 'lucide-react';
import { RouteId } from '../types/routes';
import { formatBytes, stripExtension, triggerBlobDownload } from '../utils/format';
import {
  generateSamplePdfFile,
  getPdfPageCount,
  RenderedPdfPage,
  renderPdfPagesToImages,
} from '../utils/pdfClient';
import { AdSlot } from '../components/Layout';
import { ToolGuide } from '../components/ToolGuide';

interface PdfToImagesPageProps {
  onNavigate: (route: RouteId) => void;
}

const SCALE_OPTIONS = [
  { label: '1× (72 DPI)', value: 1 },
  { label: '1.5× (108 DPI)', value: 1.5 },
  { label: '2× (144 DPI)', value: 2 },
  { label: '3× (216 DPI)', value: 3 },
];

export const PdfToImagesPage: React.FC<PdfToImagesPageProps> = ({
  onNavigate,
}) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [format, setFormat] = useState<'image/png' | 'image/jpeg'>('image/png');
  const [scale, setScale] = useState<number>(2);
  const [jpgQuality, setJpgQuality] = useState<number>(90);
  const [renderedPages, setRenderedPages] = useState<RenderedPdfPage[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pagesRef = useRef<RenderedPdfPage[]>([]);
  pagesRef.current = renderedPages;

  useEffect(() => {
    return () => {
      pagesRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  const renderFile = async (
    file: File,
    targetFormat: 'image/png' | 'image/jpeg',
    targetScale: number,
    targetQuality: number
  ) => {
    setErrorMsg(null);
    setIsRendering(true);
    pagesRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setRenderedPages([]);

    try {
      const count = await getPdfPageCount(file);
      setPageCount(count);
      const pages = await renderPdfPagesToImages(file, {
        format: targetFormat,
        scale: targetScale,
        quality: targetQuality,
      });
      setRenderedPages(pages);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `Could not render PDF: ${err.message}`
          : 'Unable to render this PDF document.'
      );
      setPdfFile(null);
    } finally {
      setIsRendering(false);
    }
  };

  const handleSelectFile = async (file: File) => {
    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      setErrorMsg('Please select a valid PDF (.pdf) document.');
      return;
    }
    setPdfFile(file);
    await renderFile(file, format, scale, jpgQuality);
  };

  const handleLoadSample = async () => {
    const sample = await generateSamplePdfFile(
      'localconvert-sample-slides.pdf',
      'PDF to Images Rendering Sample'
    );
    await handleSelectFile(sample);
  };

  const handleDownloadSingle = (page: RenderedPdfPage) => {
    if (!pdfFile) return;
    const ext = format === 'image/png' ? 'png' : 'jpg';
    triggerBlobDownload(
      page.blob,
      `${stripExtension(pdfFile.name)}-page-${page.pageNumber}.${ext}`
    );
  };

  const handleDownloadAllZip = async () => {
    if (!pdfFile || renderedPages.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const base = stripExtension(pdfFile.name);
      const ext = format === 'image/png' ? 'png' : 'jpg';
      renderedPages.forEach((p) => {
        zip.file(`${base}-page-${p.pageNumber}.${ext}`, p.blob);
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(blob, `${base}-pages.zip`);
    } finally {
      setIsZipping(false);
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
          PDF to Images Converter
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Render PDF pages into crisp PNG or JPG images via PDF.js and HTML5 Canvas with single or ZIP download.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-6 border-b border-slate-200">
          <div className="space-y-1.5">
            <span className="block text-sm font-semibold text-slate-900">
              Output Format
            </span>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setFormat('image/png');
                  if (pdfFile) void renderFile(pdfFile, 'image/png', scale, jpgQuality);
                }}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  format === 'image/png'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                PNG (Crisp Text)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormat('image/jpeg');
                  if (pdfFile) void renderFile(pdfFile, 'image/jpeg', scale, jpgQuality);
                }}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  format === 'image/jpeg'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                JPG (Compact)
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-sm font-semibold text-slate-900">
              Render Resolution
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
              {SCALE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setScale(opt.value);
                    if (pdfFile) void renderFile(pdfFile, format, opt.value, jpgQuality);
                  }}
                  className={`py-1.5 px-1 text-[11px] font-mono font-semibold rounded-md transition-colors ${
                    scale === opt.value
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.value}×
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <label htmlFor="pdf-jpg-quality" className="font-semibold text-slate-900">
                JPG Quality
              </label>
              <span className="font-mono text-xs font-semibold text-teal-800 tabular-nums">
                {format === 'image/jpeg' ? `${jpgQuality}%` : 'Lossless PNG'}
              </span>
            </div>
            <input
              id="pdf-jpg-quality"
              type="range"
              min={30}
              max={100}
              disabled={format !== 'image/jpeg'}
              value={jpgQuality}
              onChange={(e) => setJpgQuality(Number(e.target.value))}
              onMouseUp={() => {
                if (pdfFile && format === 'image/jpeg') {
                  void renderFile(pdfFile, format, scale, jpgQuality);
                }
              }}
              onTouchEnd={() => {
                if (pdfFile && format === 'image/jpeg') {
                  void renderFile(pdfFile, format, scale, jpgQuality);
                }
              }}
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
            const file = e.dataTransfer.files?.[0];
            if (file) void handleSelectFile(file);
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
            accept="application/pdf,.pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleSelectFile(file);
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
                Drop a PDF here to render pages as images
              </p>
              <p className="text-xs text-slate-500">
                Every page renders locally on an HTML5 Canvas—zero cloud uploads.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" aria-hidden="true" />
                <span>Select PDF</span>
              </button>
              <button
                type="button"
                onClick={() => void handleLoadSample()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span>Load Sample PDF</span>
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

        {isRendering && (
          <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin text-teal-700" aria-hidden="true" />
            <span>Rendering PDF pages locally at {scale}× resolution…</span>
          </div>
        )}

        {pdfFile && renderedPages.length > 0 && !isRendering && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-slate-900 text-white px-5 py-4">
              <div className="text-sm font-mono tabular-nums">
                Rendered <strong>{renderedPages.length}</strong> of {pageCount} page
                {pageCount > 1 ? 's' : ''} as{' '}
                <strong className="text-teal-300">
                  {format === 'image/png' ? 'PNG' : 'JPG'}
                </strong>
              </div>
              <button
                type="button"
                disabled={isZipping}
                onClick={() => void handleDownloadAllZip()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-teal-400 hover:bg-teal-300 disabled:opacity-50 rounded-lg transition-colors"
              >
                {isZipping ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Archive className="w-4 h-4" aria-hidden="true" />
                )}
                <span>{isZipping ? 'Creating ZIP…' : 'Download All Pages (.zip)'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {renderedPages.map((page) => (
                <article
                  key={page.pageNumber}
                  className="rounded-lg border border-slate-200 bg-white overflow-hidden flex flex-col justify-between"
                >
                  <div className="h-56 bg-slate-100 border-b border-slate-200 p-2 flex items-center justify-center">
                    <img
                      src={page.previewUrl}
                      alt={`Rendered page ${page.pageNumber}`}
                      className="max-h-full max-w-full object-contain shadow-xs"
                    />
                  </div>
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="text-xs font-mono tabular-nums text-slate-600">
                      <p className="font-sans text-sm font-semibold text-slate-900">
                        Page {page.pageNumber}
                      </p>
                      <p>
                        {page.width}×{page.height} · {formatBytes(page.blob.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadSingle(page)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Save</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <AdSlot placement="mid" />

      <ToolGuide
        title="How It Works & Tips: Converting PDF Pages to Images"
        intro="Need to drop a slide from a PDF deck into a presentation, share a single invoice page in team chat, or post a report infographic on social media? LocalConvert renders each PDF page directly onto an HTML5 Canvas inside your browser and exports crisp PNG or JPG files with zero remote uploads."
        sections={[
          {
            heading: 'Understanding Render Scale & Output DPI',
            body: 'PDF coordinates default to 72 points per inch (1× scale), which can look soft on high-density Retina or 4K displays. Selecting 2× (144 DPI) produces sharp web embeds and social graphics, while 3× (216 DPI) captures fine financial tables, CAD linework, and dense charts cleanly for high-resolution slide decks.',
          },
          {
            heading: 'Choosing PNG vs. JPG for PDF Pages',
            body: 'Text-heavy PDFs, legal forms, spreadsheets, and technical blueprints look sharpest in PNG format because lossless encoding eliminates compression artifacts around crisp black lettering. Choose JPG at 85–90% quality when rendering photo-heavy catalogs or brochures to keep multi-page ZIP archives lightweight.',
          },
          {
            heading: 'Clean White Paper Backdrop Initialization',
            body: 'Many PDF documents omit an explicit background rectangle, assuming the PDF viewer supplies white paper. LocalConvert initializes every HTML5 Canvas surface with solid white before rendering PDF vector and text layers so exported PNGs never appear transparent or illegible inside dark-mode apps.',
          },
          {
            heading: 'Private On-Device Rendering via PDF.js Worker',
            body: 'Because Mozilla PDF.js executes inside a local browser Web Worker, confidential medical records, tax statements, and unreleased internal slide decks are rasterized strictly within your own device RAM and never leave your machine, even during multi-page batch exports or offline sessions.',
          },
        ]}
        tips={[
          'Use 2× PNG as your reliable default for crisp, readable document screenshots.',
          'Switch to JPG at 85–90% quality when exporting photo-rich magazines or lookbooks.',
          'Click Save on individual pages or Download All Pages (.zip) for full-document export.',
          'Open any saved page image in our Social & Meme Cropper if you need 1:1 or 4:5 framing.',
        ]}
        faqs={[
          {
            question: 'Can I convert a PDF with 20 or more pages to images?',
            answer:
              'Yes. LocalConvert renders pages sequentially onto local Canvas buffers and bundles every image into a single downloadable ZIP file with zero server timeouts or file-count caps.',
          },
          {
            question: 'Why does 3× scale take slightly longer than 1× scale?',
            answer:
              '3× resolution draws nine times as many pixels per page as 1×. For fast previews or long 30-page PDFs, 1.5× or 2× offers the best speed-to-sharpness ratio.',
          },
          {
            question: 'Are password-protected PDFs supported?',
            answer:
              'No. Locked PDFs must be decrypted or unlocked in your local viewer before browser-based rendering can access internal page streams and embedded font resources.',
          },
          {
            question: 'Does LocalConvert keep copies of rendered PDF page images?',
            answer:
              'Never. Temporary preview Object URLs live solely in browser memory and are automatically revoked when you navigate away or close the tab. Your documents never touch any external storage, CDN, or server queue.',
          },
        ]}
      />
    </div>
  );
};
