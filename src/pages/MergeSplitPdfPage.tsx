import React, { useRef, useState } from 'react';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  FileText,
  Layers,
  Loader2,
  Scissors,
  Trash2,
  Upload,
} from 'lucide-react';
import { RouteId } from '../types/routes';
import { formatBytes, stripExtension, triggerBlobDownload } from '../utils/format';
import { generateSamplePdfFile, getPdfPageCount } from '../utils/pdfClient';
import { AdSlot } from '../components/Layout';
import { ToolGuide } from '../components/ToolGuide';

interface MergeSplitPdfPageProps {
  onNavigate: (route: RouteId) => void;
}

interface QueuedPdf {
  id: string;
  file: File;
  pageCount: number;
}

function parsePageRangeString(input: string, maxPages: number): number[] {
  const chosen = new Set<number>();
  const parts = input
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        const lo = Math.max(1, Math.min(start, end));
        const hi = Math.min(maxPages, Math.max(start, end));
        for (let p = lo; p <= hi; p++) chosen.add(p);
      }
    } else {
      const n = parseInt(part, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= maxPages) {
        chosen.add(n);
      }
    }
  }
  return Array.from(chosen).sort((a, b) => a - b);
}

function formatPagesAsRange(pages: number[]): string {
  if (pages.length === 0) return '';
  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
    } else {
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = sorted[i];
      prev = sorted[i];
    }
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return ranges.join(', ');
}

export const MergeSplitPdfPage: React.FC<MergeSplitPdfPageProps> = ({
  onNavigate,
}) => {
  const [mode, setMode] = useState<'merge' | 'split'>('merge');

  // Merge state
  const [mergeList, setMergeList] = useState<QueuedPdf[]>([]);
  const [isMerging, setIsMerging] = useState(false);

  // Split state
  const [splitPdf, setSplitPdf] = useState<QueuedPdf | null>(null);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [rangeInput, setRangeInput] = useState<string>('');
  const [isSplitting, setIsSplitting] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mergeInputRef = useRef<HTMLInputElement>(null);
  const splitInputRef = useRef<HTMLInputElement>(null);

  const addMergeFiles = async (incoming: FileList | File[]) => {
    setErrorMsg(null);
    const pdfs = Array.from(incoming).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdfs.length === 0) {
      setErrorMsg('Please select valid PDF (.pdf) files.');
      return;
    }

    const loaded: QueuedPdf[] = [];
    for (const file of pdfs) {
      try {
        const count = await getPdfPageCount(file);
        loaded.push({
          id: `${file.name}-${crypto.randomUUID()}`,
          file,
          pageCount: count,
        });
      } catch {
        setErrorMsg(
          `Could not read "${file.name}". Ensure it is a valid, unencrypted PDF.`
        );
      }
    }

    if (loaded.length > 0) {
      setMergeList((prev) => [...prev, ...loaded]);
    }
  };

  const loadSplitFile = async (file: File) => {
    setErrorMsg(null);
    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      setErrorMsg('Please select a valid PDF (.pdf) file.');
      return;
    }

    try {
      const count = await getPdfPageCount(file);
      const item: QueuedPdf = {
        id: `${file.name}-${crypto.randomUUID()}`,
        file,
        pageCount: count,
      };
      setSplitPdf(item);
      const all = Array.from({ length: count }, (_, i) => i + 1);
      setSelectedPages(all);
      setRangeInput(formatPagesAsRange(all));
    } catch {
      setErrorMsg(
        `Could not read "${file.name}". Ensure it is a valid, unencrypted PDF.`
      );
    }
  };

  const handleLoadSamples = async () => {
    if (mode === 'merge') {
      const f1 = await generateSamplePdfFile('document-part-1.pdf', 'Part 1 — Agreement');
      const f2 = await generateSamplePdfFile('document-part-2.pdf', 'Part 2 — Appendix');
      await addMergeFiles([f1, f2]);
    } else {
      const f = await generateSamplePdfFile('multi-page-sample.pdf', 'Multi-Page Split Sample');
      await loadSplitFile(f);
    }
  };

  const moveMergeItem = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= mergeList.length) return;
    setMergeList((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const handleMergeAndDownload = async () => {
    if (mergeList.length < 2) {
      setErrorMsg('Add at least two PDF files to merge.');
      return;
    }
    setIsMerging(true);
    setErrorMsg(null);
    try {
      const merged = await PDFDocument.create();
      for (const item of mergeList) {
        const bytes = await item.file.arrayBuffer();
        const src = await PDFDocument.load(bytes);
        const copied = await merged.copyPages(src, src.getPageIndices());
        copied.forEach((p) => merged.addPage(p));
      }
      const outBytes = await merged.save();
      triggerBlobDownload(
        new Blob([new Uint8Array(outBytes)], { type: 'application/pdf' }),
        'localconvert-merged.pdf'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to merge PDF documents.'
      );
    } finally {
      setIsMerging(false);
    }
  };

  const togglePageSelection = (pageNum: number) => {
    setSelectedPages((prev) => {
      const next = prev.includes(pageNum)
        ? prev.filter((p) => p !== pageNum)
        : [...prev, pageNum].sort((a, b) => a - b);
      setRangeInput(formatPagesAsRange(next));
      return next;
    });
  };

  const handleRangeChange = (val: string) => {
    setRangeInput(val);
    if (splitPdf) {
      setSelectedPages(parsePageRangeString(val, splitPdf.pageCount));
    }
  };

  const handleExtractSelected = async () => {
    if (!splitPdf || selectedPages.length === 0) return;
    setIsSplitting(true);
    setErrorMsg(null);
    try {
      const srcBytes = await splitPdf.file.arrayBuffer();
      const srcDoc = await PDFDocument.load(srcBytes);
      const outDoc = await PDFDocument.create();
      const zeroIndices = selectedPages.map((n) => n - 1);
      const pages = await outDoc.copyPages(srcDoc, zeroIndices);
      pages.forEach((p) => outDoc.addPage(p));
      const outBytes = await outDoc.save();
      triggerBlobDownload(
        new Blob([new Uint8Array(outBytes)], { type: 'application/pdf' }),
        `${stripExtension(splitPdf.file.name)}-extracted.pdf`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to extract pages.'
      );
    } finally {
      setIsSplitting(false);
    }
  };

  const handleSplitAllZip = async () => {
    if (!splitPdf) return;
    setIsSplitting(true);
    setErrorMsg(null);
    try {
      const srcBytes = await splitPdf.file.arrayBuffer();
      const srcDoc = await PDFDocument.load(srcBytes);
      const zip = new JSZip();
      const base = stripExtension(splitPdf.file.name);

      for (let i = 0; i < srcDoc.getPageCount(); i++) {
        const singleDoc = await PDFDocument.create();
        const [page] = await singleDoc.copyPages(srcDoc, [i]);
        singleDoc.addPage(page);
        const bytes = await singleDoc.save();
        zip.file(`${base}-page-${i + 1}.pdf`, new Uint8Array(bytes));
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(zipBlob, `${base}-all-pages.zip`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to split PDF into ZIP.'
      );
    } finally {
      setIsSplitting(false);
    }
  };

  const totalMergePages = mergeList.reduce((acc, item) => acc + item.pageCount, 0);

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
          Merge &amp; Split PDF
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Combine multiple PDFs into one file or extract specific pages and ranges directly inside your browser.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
        {/* Mode Switcher */}
        <div className="inline-flex p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setMode('merge');
              setErrorMsg(null);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors ${
              mode === 'merge'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" aria-hidden="true" />
            <span>Merge Multiple PDFs</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('split');
              setErrorMsg(null);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors ${
              mode === 'split'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scissors className="w-4 h-4" aria-hidden="true" />
            <span>Split / Extract Pages</span>
          </button>
        </div>

        {mode === 'merge' ? (
          <div className="space-y-6">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.length) void addMergeFiles(e.dataTransfer.files);
              }}
              className={`rounded-xl border-2 border-dashed p-7 text-center transition-colors ${
                isDragging
                  ? 'border-teal-700 bg-teal-50/70'
                  : 'border-slate-300 bg-slate-50/70 hover:border-slate-400'
              }`}
            >
              <input
                ref={mergeInputRef}
                type="file"
                multiple
                accept="application/pdf,.pdf"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    void addMergeFiles(e.target.files);
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
                    Drop 2 or more PDFs here to merge them
                  </p>
                  <p className="text-xs text-slate-500">
                    Reorder documents before combining them into a single PDF file.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => mergeInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
                  >
                    <FileText className="w-4 h-4" aria-hidden="true" />
                    <span>Add PDFs</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLoadSamples()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <span>Load 2 Sample PDFs</span>
                  </button>
                </div>
              </div>
            </div>

            {mergeList.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-slate-900 text-white px-5 py-4">
                  <div className="text-sm font-mono tabular-nums">
                    <strong>{mergeList.length}</strong> PDF file{mergeList.length > 1 ? 's' : ''} ·{' '}
                    <span className="text-teal-300">{totalMergePages} total pages</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setMergeList([])}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Clear</span>
                    </button>
                    <button
                      type="button"
                      disabled={mergeList.length < 2 || isMerging}
                      onClick={() => void handleMergeAndDownload()}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-teal-400 hover:bg-teal-300 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      {isMerging ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Download className="w-4 h-4" aria-hidden="true" />
                      )}
                      <span>{isMerging ? 'Merging…' : 'Merge & Download PDF'}</span>
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                  {mergeList.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-white flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs font-bold text-slate-500 w-7 text-center tabular-nums shrink-0">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {item.file.name}
                          </p>
                          <p className="text-xs font-mono tabular-nums text-slate-500">
                            {item.pageCount} page{item.pageCount > 1 ? 's' : ''} ·{' '}
                            {formatBytes(item.file.size)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveMergeItem(idx, -1)}
                          aria-label={`Move ${item.file.name} up`}
                          className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-35 transition-colors"
                        >
                          <ArrowUp className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === mergeList.length - 1}
                          onClick={() => moveMergeItem(idx, 1)}
                          aria-label={`Move ${item.file.name} down`}
                          className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-35 transition-colors"
                        >
                          <ArrowDown className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMergeList((prev) => prev.filter((p) => p.id !== item.id))
                          }
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
          </div>
        ) : (
          <div className="space-y-6">
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
                if (file) void loadSplitFile(file);
              }}
              className={`rounded-xl border-2 border-dashed p-7 text-center transition-colors ${
                isDragging
                  ? 'border-teal-700 bg-teal-50/70'
                  : 'border-slate-300 bg-slate-50/70 hover:border-slate-400'
              }`}
            >
              <input
                ref={splitInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void loadSplitFile(file);
                    e.target.value = '';
                  }
                }}
                className="hidden"
              />
              <div className="mx-auto max-w-md space-y-3">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 text-teal-700 flex items-center justify-center mx-auto">
                  <Scissors className="w-6 h-6" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="font-display text-base font-semibold text-slate-900">
                    Drop a PDF here to extract or split pages
                  </p>
                  <p className="text-xs text-slate-500">
                    Pick specific pages or split every page into individual PDFs inside a ZIP.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => splitInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
                  >
                    <FileText className="w-4 h-4" aria-hidden="true" />
                    <span>Select PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLoadSamples()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <span>Load Sample PDF</span>
                  </button>
                </div>
              </div>
            </div>

            {splitPdf && (
              <div className="space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {splitPdf.file.name}
                    </p>
                    <p className="text-xs font-mono tabular-nums text-slate-500">
                      {splitPdf.pageCount} pages · {formatBytes(splitPdf.file.size)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const all = Array.from(
                          { length: splitPdf.pageCount },
                          (_, i) => i + 1
                        );
                        setSelectedPages(all);
                        setRangeInput(formatPagesAsRange(all));
                      }}
                      className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-300 rounded-md hover:bg-slate-100"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPages([]);
                        setRangeInput('');
                      }}
                      className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-300 rounded-md hover:bg-slate-100"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="split-range-input"
                    className="block text-xs font-semibold text-slate-800"
                  >
                    Page Range (e.g., 1-2, 4) or click individual pages below:
                  </label>
                  <input
                    id="split-range-input"
                    type="text"
                    value={rangeInput}
                    onChange={(e) => handleRangeChange(e.target.value)}
                    placeholder={`1-${splitPdf.pageCount}`}
                    className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {Array.from(
                    { length: Math.min(splitPdf.pageCount, 80) },
                    (_, i) => i + 1
                  ).map((pageNum) => {
                    const active = selectedPages.includes(pageNum);
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => togglePageSelection(pageNum)}
                        className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-colors tabular-nums ${
                          active
                            ? 'bg-teal-700 text-white border-teal-700'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        P.{pageNum}
                      </button>
                    );
                  })}
                  {splitPdf.pageCount > 80 && (
                    <span className="text-xs text-slate-500 self-center">
                      Use the range input above for pages 81–{splitPdf.pageCount}.
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={selectedPages.length === 0 || isSplitting}
                    onClick={() => void handleExtractSelected()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 rounded-lg transition-colors"
                  >
                    {isSplitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="w-4 h-4" aria-hidden="true" />
                    )}
                    <span>
                      Extract {selectedPages.length} Page{selectedPages.length === 1 ? '' : 's'} (.pdf)
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={isSplitting}
                    onClick={() => void handleSplitAllZip()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 rounded-lg transition-colors"
                  >
                    <Archive className="w-4 h-4" aria-hidden="true" />
                    <span>Split All Pages to ZIP</span>
                  </button>
                </div>
              </div>
            )}
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
        title="How It Works & Tips: Merging and Splitting PDFs Locally"
        intro="Combining signed contracts with supporting exhibits—or pulling just three pages out of a 50-page financial packet—should never require uploading confidential paperwork to a cloud service. LocalConvert merges and splits PDF page trees directly inside your browser via pdf-lib with zero network transfers."
        sections={[
          {
            heading: 'Lossless Structural PDF Page Copying',
            body: 'Rather than rasterizing pages into heavy bitmaps, pdf-lib copies original PDF page objects—preserving crisp vector typography, embedded fonts, clickable hyperlinks, form annotations, and vector diagrams intact. Your merged or extracted PDF maintains full print quality at minimal file size.',
          },
          {
            heading: 'Flexible Page Range Extraction & Full-Document Bursting',
            body: 'In Split mode, type page expressions such as "1-3, 5, 8-12" or tap individual page buttons to extract selected pages into a clean standalone PDF. Need every page separated into individual files? Click "Split All Pages to ZIP" to generate single-page PDFs bundled into one convenient archive.',
          },
          {
            heading: 'Intuitive Ordering Before Merging Multiple PDFs',
            body: 'When assembling proposals, invoices, cover letters, and appendices, LocalConvert displays exact page counts for each loaded PDF and lets you reorder documents up or down in one click before generating the combined output. You can mix portrait and landscape documents freely without clipping page margins.',
          },
          {
            heading: 'Complete Confidentiality for Legal & Financial Files',
            body: 'Client agreements, tax returns, medical summaries, and HR packets remain exclusively in volatile browser memory. Even large multi-document merges complete in seconds on-device with zero cloud retention, making LocalConvert safe for NDA-protected workflows and regulated teams.',
          },
        ]}
        tips={[
          'Use comma-separated ranges like "1, 4-6" to extract non-adjacent pages into a clean executive summary.',
          'Verify each queued PDF page count in Merge mode before exporting the final packet.',
          'Unlock password-protected PDFs locally before loading them for merging or splitting.',
          'Use Split All Pages to ZIP whenever an online portal requires single-page PDF uploads.',
        ]}
        faqs={[
          {
            question: 'Does merging or splitting PDFs reduce text sharpness or image resolution?',
            answer:
              'No. LocalConvert copies pages structurally at the PDF object level via pdf-lib, preserving original vector fonts, graphics, and embedded image quality.',
          },
          {
            question: 'Can I extract a single page from a large multi-page PDF?',
            answer:
              'Yes. Switch to Split / Extract Pages, click Clear Selection, select the single page button (or type its number), and click Extract 1 Page (.pdf).',
          },
          {
            question: 'Why did an encrypted or password-locked PDF fail to open?',
            answer:
              'Client-side PDF engines cannot bypass user-password encryption without your credentials. Save an unencrypted copy using your desktop PDF reader or print-to-PDF workflow first if you are authorized to edit the document.',
          },
          {
            question: 'Are my merged or split PDFs uploaded to LocalConvert servers?',
            answer:
              'Never. Every byte of PDF parsing and reassembly executes locally in JavaScript inside your browser tab using pdf-lib. Even if you disconnect from Wi-Fi after loading this page, merging and page extraction continue working seamlessly on your device.',
          },
        ]}
      />
    </div>
  );
};
