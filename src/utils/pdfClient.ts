import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Configure local bundled PDF.js worker once
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export interface ExtractedPdfPage {
  pageNumber: number;
  paragraphs: string[];
  charCount: number;
}

export interface PdfExtractionResult {
  pageCount: number;
  pages: ExtractedPdfPage[];
  fullText: string;
  totalChars: number;
  likelyScanned: boolean;
}

interface TextItemLike {
  str: string;
  transform: number[];
  hasEOL?: boolean;
}

/**
 * Extracts readable text and paragraph structure from a PDF completely client-side.
 */
export async function extractPdfTextClientSide(
  file: File
): Promise<PdfExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const pages: ExtractedPdfPage[] = [];
  let totalChars = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const lines: string[] = [];
    let currentLine = '';
    let lastY: number | null = null;
    const lineBreaksY: number[] = [];

    for (const rawItem of content.items) {
      const item = rawItem as Partial<TextItemLike>;
      if (typeof item.str !== 'string') continue;

      const y: number | null =
        Array.isArray(item.transform) && typeof item.transform[5] === 'number'
          ? item.transform[5]
          : lastY;

      if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
          lineBreaksY.push(Math.abs(y - lastY));
        }
        currentLine = item.str;
      } else {
        if (
          currentLine &&
          item.str &&
          !currentLine.endsWith(' ') &&
          !item.str.startsWith(' ')
        ) {
          currentLine += ' ';
        }
        currentLine += item.str;
      }

      if (item.hasEOL && currentLine.trim()) {
        lines.push(currentLine.trim());
        lineBreaksY.push(14);
        currentLine = '';
      }

      if (y !== null) {
        lastY = y;
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    // Group adjacent lines into paragraphs based on vertical spacing or punctuation
    const paragraphs: string[] = [];
    let currentPara = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const gap = lineBreaksY[i] ?? 14;
      const startsNewBullet = /^([•\-*]|\d+[.)])\s/.test(line);

      if (!currentPara) {
        currentPara = line;
      } else if (startsNewBullet || gap > 20 || /[.!?:]$/.test(currentPara)) {
        paragraphs.push(currentPara);
        currentPara = line;
      } else {
        currentPara = `${currentPara} ${line}`;
      }
    }

    if (currentPara.trim()) {
      paragraphs.push(currentPara.trim());
    }

    const pageChars = paragraphs.join(' ').trim().length;
    totalChars += pageChars;
    pages.push({
      pageNumber: pageNum,
      paragraphs,
      charCount: pageChars,
    });
  }

  const fullText = pages
    .map((p) =>
      p.paragraphs.length > 0
        ? p.paragraphs.join('\n\n')
        : `[Page ${p.pageNumber}: No selectable text detected]`
    )
    .join('\n\n---\n\n');

  // If average text per page is tiny (< 25 chars), flag as likely scanned/image-only
  const likelyScanned = totalChars < Math.max(20, pdf.numPages * 15);

  return {
    pageCount: pdf.numPages,
    pages,
    fullText,
    totalChars,
    likelyScanned,
  };
}

export interface RenderedPdfPage {
  pageNumber: number;
  width: number;
  height: number;
  blob: Blob;
  previewUrl: string;
}

export async function getPdfPageCount(file: File): Promise<number> {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
  return doc.getPageCount();
}

export async function renderPdfPagesToImages(
  file: File,
  options: {
    format: 'image/png' | 'image/jpeg';
    scale: number;
    quality: number;
    pageNumbers?: number[];
  }
): Promise<RenderedPdfPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const targetPages =
    options.pageNumbers && options.pageNumbers.length > 0
      ? options.pageNumbers.filter((n) => n >= 1 && n <= pdf.numPages)
      : Array.from({ length: pdf.numPages }, (_, i) => i + 1);

  const results: RenderedPdfPage[] = [];

  for (const pageNum of targetPages) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: options.scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');

    // Fill white page background before rendering PDF content
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error(`Failed to encode page ${pageNum}.`));
        },
        options.format,
        options.format === 'image/jpeg'
          ? Math.min(1, Math.max(0.1, options.quality / 100))
          : undefined
      );
    });

    results.push({
      pageNumber: pageNum,
      width: canvas.width,
      height: canvas.height,
      blob,
      previewUrl: URL.createObjectURL(blob),
    });
  }

  return results;
}

/**
 * Generates a real multi-page PDF completely client-side via pdf-lib for instant tool testing.
 */
export async function generateSamplePdfFile(
  filename = 'localconvert-sample-document.pdf',
  title = 'LocalConvert Client-Side PDF Sample'
): Promise<File> {
  const pdfDoc = await PDFDocument.create();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page1 = pdfDoc.addPage([612, 792]);
  page1.drawText(title, {
    x: 56,
    y: 720,
    size: 20,
    font: boldFont,
    color: rgb(0.06, 0.09, 0.16),
  });
  page1.drawText('Page 1 — Client-Side Privacy Architecture', {
    x: 56,
    y: 688,
    size: 13,
    font: boldFont,
    color: rgb(0.06, 0.46, 0.43),
  });
  const p1Lines = [
    'This sample PDF was generated directly inside your browser using pdf-lib.',
    'You can use it to test PDF to Word (.docx) extraction, page splitting,',
    'multi-file PDF merging, and PDF to PNG/JPG image rendering.',
    '',
    'Key Advantages of Local Browser Processing:',
    '1. Documents never travel to third-party cloud servers.',
    '2. Sensitive contracts, invoices, and reports remain strictly on your device.',
    '3. Conversion happens instantaneously using local memory and HTML5 Canvas.',
  ];
  let y1 = 648;
  for (const line of p1Lines) {
    page1.drawText(line, {
      x: 56,
      y: y1,
      size: 11.5,
      font: bodyFont,
      color: rgb(0.2, 0.25, 0.33),
    });
    y1 -= 22;
  }

  const page2 = pdfDoc.addPage([612, 792]);
  page2.drawText('Page 2 — Best Practices for Document Workflows', {
    x: 56,
    y: 720,
    size: 16,
    font: boldFont,
    color: rgb(0.06, 0.09, 0.16),
  });
  const p2Lines = [
    'When converting PDFs to editable Word (.docx) files, text-based PDFs preserve',
    'clean paragraphs and punctuation accurately. Scanned PDFs created from photos',
    'or flatbed scanners contain raster images rather than selectable text.',
    '',
    'For combining receipts or scanned images into a clean deliverable, try the',
    'Images to PDF tool with A4 or US Letter page sizing.',
  ];
  let y2 = 678;
  for (const line of p2Lines) {
    page2.drawText(line, {
      x: 56,
      y: y2,
      size: 11.5,
      font: bodyFont,
      color: rgb(0.2, 0.25, 0.33),
    });
    y2 -= 22;
  }

  const bytes = await pdfDoc.save();
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy], { type: 'application/pdf' });
  return new File([blob], filename, { type: 'application/pdf' });
}
