import React, { useState } from 'react';
import {
  ArrowRight,
  Crop,
  FileImage,
  FileSpreadsheet,
  FileText,
  Images,
  Layers,
  Minimize2,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Zap,
} from 'lucide-react';
import { RouteId } from '../types/routes';
import { AdSlot } from '../components/Layout';

interface HomePageProps {
  onNavigate: (route: RouteId) => void;
}

type ToolCategory = 'all' | 'image' | 'pdf';

interface ToolCardDef {
  id: RouteId;
  category: 'image' | 'pdf';
  title: string;
  meta: string;
  description: string;
  cta: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TOOL_CARDS: ToolCardDef[] = [
  {
    id: 'compress',
    category: 'image',
    title: 'Bulk Image Compressor',
    meta: 'JPG · PNG · WebP · ZIP Export',
    description:
      'Shrink dozens of images simultaneously with a 10–100% quality slider, max width/height resizing, before-and-after size metrics, and one-click ZIP archiving.',
    cta: 'Open Compressor',
    icon: Minimize2,
  },
  {
    id: 'image-converter',
    category: 'image',
    title: 'Universal Image Converter',
    meta: 'PNG · JPG · WebP · GIF · SVG · BMP',
    description:
      'Convert images seamlessly across six formats using HTML5 Canvas and client-side encoders, with quality sliders, background fill colors, and ZIP download.',
    cta: 'Convert Formats',
    icon: RefreshCw,
  },
  {
    id: 'png-to-webp',
    category: 'image',
    title: 'PNG to WebP Converter',
    meta: 'Alpha Preserved · Batch Ready',
    description:
      'Convert heavy PNG graphics into modern WebP assets while preserving transparency, comparing exact byte savings, and downloading individually or as a ZIP.',
    cta: 'Convert PNG to WebP',
    icon: FileImage,
  },
  {
    id: 'exif-remover',
    category: 'image',
    title: 'EXIF Metadata Viewer & Remover',
    meta: 'GPS · Camera · Strip Metadata',
    description:
      'Inspect hidden GPS coordinates, camera models, and timestamps embedded inside photos—then export a verified clean copy with all metadata stripped.',
    cta: 'Inspect & Strip EXIF',
    icon: ShieldAlert,
  },
  {
    id: 'qr-generator',
    category: 'image',
    title: 'QR Code Generator with Logo',
    meta: 'Custom Colors · Center Logo · High-Res PNG',
    description:
      'Generate crisp scannable QR codes for URLs or text, customize foreground and background contrast, embed a centered brand logo safely, and export up to 2048px PNG.',
    cta: 'Create QR Code',
    icon: QrCode,
  },
  {
    id: 'meme-cropper',
    category: 'image',
    title: 'Social Media & Meme Cropper',
    meta: '1:1 · 4:5 · 9:16 · 16:9 · Free Crop',
    description:
      'Frame photos for Instagram, TikTok, Reels, or YouTube with interactive canvas cropping and optional bold outlined top/bottom meme captions for PNG or JPG export.',
    cta: 'Launch Cropper',
    icon: Crop,
  },
  {
    id: 'pdf-to-word',
    category: 'pdf',
    title: 'PDF to Word (.docx) Converter',
    meta: 'PDF.js · Editable Preview · .docx Export',
    description:
      'Extract text and paragraph structure from PDFs completely client-side, edit the extracted text live, detect scanned PDFs, and download a .docx Word document.',
    cta: 'Convert PDF to Word',
    icon: FileSpreadsheet,
  },
  {
    id: 'images-to-pdf',
    category: 'pdf',
    title: 'Images to PDF Converter',
    meta: 'A4 · Letter · Fit to Image · Reorder',
    description:
      'Combine multiple JPG, PNG, or WebP images into one ordered PDF document with customizable page size, orientation, and margins.',
    cta: 'Combine Images to PDF',
    icon: Images,
  },
  {
    id: 'merge-split-pdf',
    category: 'pdf',
    title: 'Merge & Split PDF',
    meta: 'Combine PDFs · Extract Pages · ZIP Split',
    description:
      'Merge multiple PDF files in your preferred order or extract specific pages and page ranges into a standalone PDF without uploading documents.',
    cta: 'Merge or Split PDF',
    icon: Layers,
  },
  {
    id: 'pdf-to-images',
    category: 'pdf',
    title: 'PDF to Images Converter',
    meta: 'PNG · JPG · Up to 3× DPI · ZIP Export',
    description:
      'Render PDF pages directly to high-resolution PNG or JPG images in your browser and download individual pages or a complete ZIP archive.',
    cta: 'Render PDF Pages',
    icon: FileText,
  },
];

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [filter, setFilter] = useState<ToolCategory>('all');

  const visibleCards =
    filter === 'all'
      ? TOOL_CARDS
      : TOOL_CARDS.filter((card) => card.category === filter);

  return (
    <div className="space-y-10">
      {/* Welcoming Hero Section */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-teal-800">
              <span>100% Browser-Based Privacy</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>Zero File Size Limits</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>Instant Local Speed</span>
            </div>

            <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 text-balance leading-[1.12]">
              Private image &amp; PDF tools that run entirely on your device.
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
              Welcome to LocalConvert. Compress images in bulk, convert between formats, strip hidden GPS metadata, convert PDFs to Word or images, and crop social graphics—with zero server uploads, zero queues, and zero artificial file limits.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('compress')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <span>Compress Images Now</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('pdf-to-word')}
                className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Convert PDF to Word
              </button>
            </div>
          </div>

          <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
            <h2 className="font-display text-sm font-bold text-slate-900">
              Built for Complete File Privacy
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
                <dt className="text-slate-600">Server Uploads</dt>
                <dd className="font-mono font-semibold text-teal-800 tabular-nums">0 Bytes</dd>
              </div>
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
                <dt className="text-slate-600">Upload Size Caps</dt>
                <dd className="font-mono font-semibold text-slate-900">None (Local RAM)</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-600">Processing Speed</dt>
                <dd className="font-mono font-semibold text-slate-900">Instant On-Device</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Tool Grid with Category Filter Tabs */}
      <section aria-labelledby="tools-heading" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2
              id="tools-heading"
              className="font-display text-2xl font-bold tracking-tight text-slate-900"
            >
              Privacy-First Toolkit
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Select any utility below. Every operation executes locally inside your browser tab.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Filter toolkit by category"
            className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start sm:self-auto"
          >
            {(
              [
                { id: 'all', label: `All Tools (${TOOL_CARDS.length})` },
                { id: 'image', label: 'Image & Privacy (6)' },
                { id: 'pdf', label: 'PDF Tools (4)' },
              ] as { id: ToolCategory; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  filter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleCards.map((tool) => {
            const Icon = tool.icon;
            return (
              <article
                key={tool.id}
                className="group rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between gap-6 hover:border-teal-600/60 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-11 h-11 rounded-lg bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                  </div>

                  <div>
                    <h3 className="font-display text-xl font-bold text-slate-900">
                      {tool.title}
                    </h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">
                      {tool.meta}
                    </p>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed">
                    {tool.description}
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => onNavigate(tool.id)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-teal-800 bg-teal-50 hover:bg-teal-700 hover:text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>{tool.cta}</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <AdSlot placement="mid" />

      {/* Why Client-Side Processing Matters */}
      <section
        aria-labelledby="why-local-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6"
      >
        <div className="max-w-2xl">
          <h2
            id="why-local-heading"
            className="font-display text-2xl font-bold tracking-tight text-slate-900"
          >
            Why Client-Side Processing Matters
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-2 leading-relaxed">
            Traditional online converters upload your personal photos, contracts, IDs, and financial PDFs to remote servers. LocalConvert replaces server queues with native browser engines.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Complete Data Ownership
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your images and PDFs are decoded into local memory using standard browser APIs and never cross the network—keeping contracts, receipts, and EXIF coordinates private.
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
              <Zap className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Instant Hardware Speed
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Skip slow upload bars and server wait times. HTML5 Canvas, PDF.js, and pdf-lib process images and documents immediately using your own CPU and memory.
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
              <Sliders className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Live Interactive Control
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Edit extracted PDF text before downloading Word files, inspect EXIF tags before stripping, check QR contrast, and preview every export before saving.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
