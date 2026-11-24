import React, { useEffect, useRef, useState } from 'react';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Upload,
} from 'lucide-react';
import { RouteId } from '../types/routes';
import { formatBytes, stripExtension, triggerBlobDownload } from '../utils/format';
import {
  extractPdfTextClientSide,
  generateSamplePdfFile,
  PdfExtractionResult,
} from '../utils/pdfClient';
import { AdSlot } from '../components/Layout';
import { ToolGuide } from '../components/ToolGuide';

interface PdfToWordPageProps {
  onNavigate: (route: RouteId) => void;
}

export const PdfToWordPage: React.FC<PdfToWordPageProps> = ({ onNavigate }) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extraction, setExtraction] = useState<PdfExtractionResult | null>(null);
  const [editableText, setEditableText] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isBuildingDocx, setIsBuildingDocx] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      setPdfFile(null);
    };
  }, []);

  const handleProcessPdf = async (file: File) => {
    setErrorMsg(null);
    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      setErrorMsg('Please select a valid PDF (.pdf) document.');
      return;
    }

    setPdfFile(file);
    setIsExtracting(true);
    setExtraction(null);
    setEditableText('');

    try {
      const result = await extractPdfTextClientSide(file);
      setExtraction(result);
      setEditableText(result.fullText);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `Could not read PDF: ${err.message}`
          : 'Unable to parse this PDF. It may be password-protected or corrupted.'
      );
      setPdfFile(null);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleLoadSample = async () => {
    const sample = await generateSamplePdfFile(
      'localconvert-sample-report.pdf',
      'Client-Side PDF to Word Sample'
    );
    await handleProcessPdf(sample);
  };

  const handleDownloadDocx = async () => {
    if (!pdfFile || !editableText.trim()) return;
    setIsBuildingDocx(true);
    setErrorMsg(null);

    try {
      const sections = editableText.split(/\n\s*---\s*\n/);
      const children: Paragraph[] = [];

      sections.forEach((sectionText, sectionIdx) => {
        if (sectionIdx > 0) {
          children.push(
            new Paragraph({
              text: '',
              pageBreakBefore: true,
            })
          );
        }

        const blocks = sectionText
          .split(/\n{2,}/)
          .map((b) => b.trim())
          .filter(Boolean);

        blocks.forEach((block, idx) => {
          const isShortHeading =
            idx === 0 && block.length <= 80 && !/[.!?]$/.test(block);
          if (isShortHeading) {
            children.push(
              new Paragraph({
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 160, after: 120 },
                children: [new TextRun({ text: block, bold: true })],
              })
            );
          } else {
            children.push(
              new Paragraph({
                spacing: { after: 140 },
                children: [new TextRun({ text: block })],
              })
            );
          }
        });
      });

      const doc = new Document({
        creator: 'LocalConvert',
        title: stripExtension(pdfFile.name),
        sections: [{ children }],
      });

      const blob = await Packer.toBlob(doc);
      triggerBlobDownload(blob, `${stripExtension(pdfFile.name)}.docx`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to generate .docx file.'
      );
    } finally {
      setIsBuildingDocx(false);
    }
  };

  const wordCount = editableText.trim()
    ? editableText.trim().split(/\s+/).length
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
          PDF to Word (.docx) Converter
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Extract text and paragraph structure from PDFs via PDF.js, review or edit live, and export a clean .docx document locally.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
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
            if (file) void handleProcessPdf(file);
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
                void handleProcessPdf(file);
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
                Drop a PDF document here to extract text to Word
              </p>
              <p className="text-xs text-slate-500">
                Processed locally inside your browser—ideal for contracts, resumes, and reports.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" aria-hidden="true" />
                <span>Select PDF File</span>
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

        {isExtracting && (
          <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin text-teal-700" aria-hidden="true" />
            <span>Extracting text and paragraphs locally from PDF…</span>
          </div>
        )}

        {pdfFile && extraction && !isExtracting && (
          <div className="space-y-4">
            {extraction.likelyScanned && (
              <div
                role="status"
                className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex items-start gap-3 text-sm text-amber-950"
              >
                <AlertTriangle
                  className="w-5 h-5 text-amber-700 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <p className="font-semibold">
                    Scanned or Image-Only PDF Detected
                  </p>
                  <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
                    Very little selectable text was found in this document ({extraction.totalChars} characters across {extraction.pageCount} page{extraction.pageCount > 1 ? 's' : ''}). Browser-based PDF extraction reads embedded text layers without cloud OCR; scanned pages can be converted to PNG/JPG using our{' '}
                    <button
                      type="button"
                      onClick={() => onNavigate('pdf-to-images')}
                      className="font-semibold underline hover:text-amber-950"
                    >
                      PDF to Images
                    </button>{' '}
                    tool.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg bg-slate-900 text-white px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="text-slate-400 text-xs block">File</span>
                  <span className="font-medium truncate max-w-[200px] block">
                    {pdfFile.name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Pages</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {extraction.pageCount}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Words</span>
                  <span className="font-mono font-semibold tabular-nums text-teal-300">
                    {wordCount.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">PDF Size</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatBytes(pdfFile.size)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={isBuildingDocx || !editableText.trim()}
                onClick={() => void handleDownloadDocx()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-900 bg-teal-400 hover:bg-teal-300 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {isBuildingDocx ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="w-4 h-4" aria-hidden="true" />
                )}
                <span>{isBuildingDocx ? 'Building .docx…' : 'Download Word (.docx)'}</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="docx-editable-preview"
                  className="text-sm font-semibold text-slate-900"
                >
                  Live Editable Text Preview
                </label>
                <span className="text-xs text-slate-500">
                  Tip: Lines separated by <code className="font-mono bg-slate-100 px-1 rounded">---</code> insert a page break in Word.
                </span>
              </div>
              <textarea
                id="docx-editable-preview"
                rows={14}
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                className="w-full p-4 text-sm text-slate-800 leading-relaxed border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-teal-700 font-sans"
              />
            </div>
          </div>
        )}
      </section>

      <AdSlot placement="mid" />

      <ToolGuide
        title="How It Works & Tips: Client-Side PDF to Word (.docx)"
        intro="Converting confidential PDF contracts, resumes, financial statements, or academic drafts via traditional online converters usually uploads your entire document to unknown remote servers. LocalConvert parses PDF text layers locally using Mozilla's PDF.js engine and packages a clean Microsoft Word (.docx) file directly inside your browser tab."
        sections={[
          {
            heading: 'Reconstructing Paragraphs from PDF Text Coordinates',
            body: 'Unlike Word documents, PDFs store individual text fragments at fixed X/Y coordinates rather than flowing paragraphs. LocalConvert analyzes vertical baseline jumps, font transitions, and trailing punctuation to stitch broken lines back into coherent, editable paragraphs ready for Microsoft Word, Google Docs, Apple Pages, or LibreOffice Writer.',
          },
          {
            heading: 'Live Preview & Cleanup Before Downloading',
            body: 'Before generating your .docx file, use the live editable text editor above to fix stray line breaks, strip repeated page headers or footers, and refine wording. Section dividers marked with "---" automatically insert clean Word page breaks so multi-page structure stays organized without tedious manual reformatting.',
          },
          {
            heading: 'Text-Based PDFs vs. Scanned Image PDFs',
            body: 'Digital PDFs exported from Word, Google Docs, invoicing software, or web browsers extract cleanly in fractions of a second. If a PDF was created on a flatbed scanner or smartphone camera without an embedded OCR text layer, LocalConvert inspects character counts per page and alerts you immediately instead of generating a blank document.',
          },
          {
            heading: '100% Private OOXML Document Assembly',
            body: 'Sensitive legal agreements, payroll forms, and medical paperwork never cross the network. Both PDF.js text decoding and Office Open XML (.docx) ZIP packaging run entirely inside your device RAM with zero remote logging, cloud storage queues, or document retention.',
          },
        ]}
        tips={[
          'Trim repeated running headers, page numbers, or watermarks in the live preview before exporting.',
          'Keep "---" dividers between pages whenever you want formal page breaks in Microsoft Word.',
          'Test the workflow instantly using Load Sample PDF before converting large multi-chapter reports.',
          'For scanned image-only PDFs, use our PDF to Images tool to inspect or export each page as PNG/JPG.',
        ]}
        faqs={[
          {
            question: 'Does LocalConvert preserve complex multi-column magazine layouts?',
            answer:
              'This privacy-first browser converter prioritizes clean, editable headings and flowing paragraphs inside a standard .docx file rather than locking text inside rigid floating boxes.',
          },
          {
            question: 'Why did I see a "Scanned or Image-Only PDF Detected" warning?',
            answer:
              'Scanned PDFs contain flat photographs of pages with zero selectable text data. Because LocalConvert runs 100% locally without remote cloud OCR servers, it flags image-only documents automatically.',
          },
          {
            question: 'Can I convert password-protected or encrypted PDFs?',
            answer:
              'PDFs locked with an open password cannot be decoded without unlocking them first. Remove password protection locally in your PDF viewer before importing.',
          },
          {
            question: 'Will the downloaded .docx open cleanly in Google Docs and LibreOffice?',
            answer:
              'Yes. LocalConvert generates standard Office Open XML (.docx) documents compatible with Microsoft Word, Google Docs, LibreOffice Writer, and Apple Pages without proprietary lock-in.',
          },
        ]}
      />
    </div>
  );
};
