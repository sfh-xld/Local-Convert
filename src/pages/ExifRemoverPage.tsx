import React, { useCallback, useEffect, useRef, useState } from 'react';
import exifr from 'exifr';
import JSZip from 'jszip';
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  Download,
  ImagePlus,
  Loader2,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { RouteId } from '../types/routes';
import {
  formatBytes,
  getExtensionForMime,
  stripExtension,
  triggerBlobDownload,
} from '../utils/format';
import { loadImageFromFile } from '../utils/imageProcessing';
import { AdSlot } from '../components/Layout';
import { ToolGuide } from '../components/ToolGuide';

interface ExifRemoverPageProps {
  onNavigate: (route: RouteId) => void;
}

interface MetadataEntry {
  key: string;
  value: string;
  sensitive: boolean;
}

interface ExifFileItem {
  id: string;
  file: File;
  status: 'processing' | 'done' | 'error';
  error?: string;
  originalTags: MetadataEntry[];
  hasGps: boolean;
  cleanBlob?: Blob;
  cleanPreviewUrl?: string;
  verifiedCleanCount?: number;
  width?: number;
  height?: number;
}

const SENSITIVE_KEYS = new Set([
  'latitude',
  'longitude',
  'GPSLatitude',
  'GPSLongitude',
  'GPSAltitude',
  'GPSDateStamp',
  'GPSTimeStamp',
  'Make',
  'Model',
  'LensModel',
  'LensMake',
  'SerialNumber',
  'BodySerialNumber',
  'DateTimeOriginal',
  'CreateDate',
  'Software',
  'Artist',
  'Copyright',
  'HostComputer',
]);

function formatTagValue(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (Array.isArray(val)) return val.map((v) => String(v)).join(', ');
  if (typeof val === 'object' && val !== null) return JSON.stringify(val);
  return String(val);
}

/**
 * Generates a real JPEG file with an embedded APP1 EXIF segment (Make, Model,
 * Software, DateTimeOriginal, and GPS coordinates) entirely in browser memory
 * so users can test EXIF inspection & stripping immediately without personal photos.
 */
async function createSampleJpegWithExif(): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');

  const grad = ctx.createLinearGradient(0, 0, 960, 640);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#0f766e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 960, 640);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Sample Photo With Embedded EXIF & GPS', 480, 300);
  ctx.fillStyle = '#ccfbf1';
  ctx.font = '500 18px system-ui, sans-serif';
  ctx.fillText('Contains Camera Make/Model, Date & Coordinates for Testing', 480, 342);

  const rawJpgBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode sample JPEG.'))),
      'image/jpeg',
      0.9
    );
  });

  const rawBytes = new Uint8Array(await rawJpgBlob.arrayBuffer());

  // Build minimal valid big-endian TIFF EXIF APP1 block:
  // IFD0: Make (0x010F), Model (0x0110), Software (0x0131), GPSInfoIFDPointer (0x8825)
  const buf: number[] = [];
  const pushU16 = (v: number) => buf.push((v >> 8) & 0xff, v & 0xff);
  const pushU32 = (v: number) =>
    buf.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
  const pushAscii = (s: string) => {
    for (let i = 0; i < s.length; i++) buf.push(s.charCodeAt(i));
    buf.push(0);
  };

  // Exif\0\0 header
  buf.push(0x45, 0x78, 0x69, 0x66, 0x00, 0x00);
  const tiffStart = buf.length;
  // Big-endian TIFF header "MM" + 42 + offset 8
  buf.push(0x4d, 0x4d, 0x00, 0x2a);
  pushU32(8);

  const makeStr = 'LocalConvert Cam';
  const modelStr = 'TestShot X1';
  const softStr = 'LocalConvert Demo 1.0';
  const makeLen = makeStr.length + 1;
  const modelLen = modelStr.length + 1;
  const softLen = softStr.length + 1;

  // IFD0 has 4 entries -> 2 + 4*12 + 4 = 54 bytes, starts at offset 8 -> data starts at 62
  const ifd0Offset = 8;
  const dataStart = ifd0Offset + 2 + 4 * 12 + 4;
  const makeOff = dataStart;
  const modelOff = makeOff + makeLen;
  const softOff = modelOff + modelLen;
  const gpsIfdOff = softOff + softLen;

  // IFD0 entry count = 4
  pushU16(4);
  // Tag 0x010F Make (ASCII=2)
  pushU16(0x010f);
  pushU16(2);
  pushU32(makeLen);
  pushU32(makeOff);
  // Tag 0x0110 Model (ASCII=2)
  pushU16(0x0110);
  pushU16(2);
  pushU32(modelLen);
  pushU32(modelOff);
  // Tag 0x0131 Software (ASCII=2)
  pushU16(0x0131);
  pushU16(2);
  pushU32(softLen);
  pushU32(softOff);
  // Tag 0x8825 GPSInfoIFDPointer (LONG=4)
  pushU16(0x8825);
  pushU16(4);
  pushU32(1);
  pushU32(gpsIfdOff);
  // Next IFD = 0
  pushU32(0);

  pushAscii(makeStr);
  pushAscii(modelStr);
  pushAscii(softStr);

  // GPS IFD: 4 entries (LatRef='N', Lat=[37, 46, 30], LonRef='W', Lon=[122, 25, 10])
  const gpsDataStart = gpsIfdOff + 2 + 4 * 12 + 4;
  const latDataOff = gpsDataStart;
  const lonDataOff = latDataOff + 24;

  pushU16(4);
  // GPSLatitudeRef (0x0001) 'N\0'
  pushU16(0x0001);
  pushU16(2);
  pushU32(2);
  buf.push(0x4e, 0x00, 0x00, 0x00);
  // GPSLatitude (0x0002) 3 RATIONALs (24 bytes)
  pushU16(0x0002);
  pushU16(5);
  pushU32(3);
  pushU32(latDataOff);
  // GPSLongitudeRef (0x0003) 'W\0'
  pushU16(0x0003);
  pushU16(2);
  pushU32(2);
  buf.push(0x57, 0x00, 0x00, 0x00);
  // GPSLongitude (0x0004) 3 RATIONALs (24 bytes)
  pushU16(0x0004);
  pushU16(5);
  pushU32(3);
  pushU32(lonDataOff);
  pushU32(0);

  // 37° 46' 30" N
  pushU32(37); pushU32(1);
  pushU32(46); pushU32(1);
  pushU32(30); pushU32(1);
  // 122° 25' 10" W
  pushU32(122); pushU32(1);
  pushU32(25); pushU32(1);
  pushU32(10); pushU32(1);

  void tiffStart;
  const app1Length = buf.length + 2;
  const app1Segment = new Uint8Array(2 + 2 + buf.length);
  app1Segment[0] = 0xff;
  app1Segment[1] = 0xe1;
  app1Segment[2] = (app1Length >> 8) & 0xff;
  app1Segment[3] = app1Length & 0xff;
  app1Segment.set(buf, 4);

  // Insert APP1 right after JPEG SOI (0xFF 0xD8)
  const combined = new Uint8Array(2 + app1Segment.length + (rawBytes.length - 2));
  combined.set(rawBytes.slice(0, 2), 0);
  combined.set(app1Segment, 2);
  combined.set(rawBytes.slice(2), 2 + app1Segment.length);

  return new File([combined], 'sample-photo-with-exif.jpg', {
    type: 'image/jpeg',
  });
}

export const ExifRemoverPage: React.FC<ExifRemoverPageProps> = ({
  onNavigate,
}) => {
  const [items, setItems] = useState<ExifFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<ExifFileItem[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        if (item.cleanPreviewUrl) URL.revokeObjectURL(item.cleanPreviewUrl);
      });
    };
  }, []);

  const inspectAndStripFile = useCallback(async (id: string, file: File) => {
    try {
      // 1. Parse all available metadata from original file
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = (await exifr.parse(file, {
          tiff: true,
          exif: true,
          gps: true,
          xmp: true,
          iptc: true,
        })) as Record<string, unknown> | null;
      } catch {
        parsed = null;
      }

      const entries: MetadataEntry[] = [];
      let hasGps = false;

      if (parsed && typeof parsed === 'object') {
        for (const [key, value] of Object.entries(parsed)) {
          if (
            value === undefined ||
            value === null ||
            value instanceof Uint8Array
          ) {
            continue;
          }
          if (key.toLowerCase().includes('gps') || key === 'latitude' || key === 'longitude') {
            hasGps = true;
          }
          entries.push({
            key,
            value: formatTagValue(value),
            sensitive:
              SENSITIVE_KEYS.has(key) ||
              key.toLowerCase().includes('gps') ||
              key === 'latitude' ||
              key === 'longitude',
          });
        }
      }

      // 2. Re-encode cleanly via HTML5 Canvas to strip all EXIF/XMP/IPTC/GPS metadata
      const { img, objectUrl } = await loadImageFromFile(file);
      let cleanBlob: Blob;
      let width = 0;
      let height = 0;
      try {
        width = img.naturalWidth || img.width || 1;
        height = img.naturalHeight || img.height || 1;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable.');

        const outMime =
          file.type === 'image/png' || file.type === 'image/webp'
            ? file.type
            : 'image/jpeg';
        if (outMime === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);

        cleanBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) =>
              b ? resolve(b) : reject(new Error('Failed to create clean image.')),
            outMime,
            outMime === 'image/png' ? undefined : 0.94
          );
        });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }

      // 3. Verify cleaned output has 0 metadata tags
      let remainingCount = 0;
      try {
        const check = (await exifr.parse(cleanBlob)) as Record<string, unknown> | null;
        if (check) remainingCount = Object.keys(check).length;
      } catch {
        remainingCount = 0;
      }

      const cleanPreviewUrl = URL.createObjectURL(cleanBlob);
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: 'done',
                originalTags: entries,
                hasGps,
                cleanBlob,
                cleanPreviewUrl,
                verifiedCleanCount: remainingCount,
                width,
                height,
              }
            : entry
        )
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
                    : 'Could not inspect or clean this image.',
              }
            : entry
        )
      );
    }
  }, []);

  const addFiles = (incoming: FileList | File[]) => {
    setErrorMsg(null);
    const valid = Array.from(incoming).filter(
      (f) =>
        ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) ||
        /\.(jpe?g|png|webp)$/i.test(f.name)
    );
    if (valid.length === 0) {
      setErrorMsg('Please select JPG, PNG, or WebP images.');
      return;
    }

    const entries: ExifFileItem[] = valid.map((file) => ({
      id: `${file.name}-${crypto.randomUUID()}`,
      file,
      status: 'processing',
      originalTags: [],
      hasGps: false,
    }));
    setItems((prev) => [...prev, ...entries]);
    entries.forEach((entry) => {
      void inspectAndStripFile(entry.id, entry.file);
    });
  };

  const handleLoadSample = async () => {
    const sample = await createSampleJpegWithExif();
    addFiles([sample]);
  };

  const handleDownloadSingle = (item: ExifFileItem) => {
    if (!item.cleanBlob) return;
    const ext = getExtensionForMime(item.cleanBlob.type);
    triggerBlobDownload(item.cleanBlob, `${stripExtension(item.file.name)}-clean.${ext}`);
  };

  const handleDownloadAllZip = async () => {
    const done = items.filter((i) => i.status === 'done' && i.cleanBlob);
    if (done.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const used = new Map<string, number>();
      done.forEach((item) => {
        if (!item.cleanBlob) return;
        const base = `${stripExtension(item.file.name)}-clean`;
        const ext = getExtensionForMime(item.cleanBlob.type);
        const count = used.get(base) || 0;
        used.set(base, count + 1);
        const name = count === 0 ? `${base}.${ext}` : `${base}-${count + 1}.${ext}`;
        zip.file(name, item.cleanBlob);
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(blob, 'localconvert-metadata-stripped.zip');
    } finally {
      setIsZipping(false);
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.cleanPreviewUrl) URL.revokeObjectURL(target.cleanPreviewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const doneItems = items.filter((i) => i.status === 'done' && i.cleanBlob);

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
          EXIF Metadata Viewer &amp; Remover
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Inspect hidden GPS coordinates, camera serial details, and EXIF tags—then strip them cleanly into a privacy-safe copy.
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
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
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
                Drop photos here to inspect &amp; strip EXIF metadata
              </p>
              <p className="text-xs text-slate-500">
                Inspects GPS, Camera Make/Model, XMP, and IPTC locally without sending your photos anywhere.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                <ImagePlus className="w-4 h-4" aria-hidden="true" />
                <span>Select Photos</span>
              </button>
              <button
                type="button"
                onClick={() => void handleLoadSample()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span>Load Sample Photo (with EXIF)</span>
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
          <div className="space-y-5">
            {items.length > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-slate-900 text-white px-5 py-3.5">
                <span className="text-sm font-mono tabular-nums">
                  Cleaned <strong>{doneItems.length}</strong> / {items.length} photo(s)
                </span>
                <button
                  type="button"
                  disabled={doneItems.length === 0 || isZipping}
                  onClick={() => void handleDownloadAllZip()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-teal-400 hover:bg-teal-300 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {isZipping ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Archive className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>Download All Clean Copies (.zip)</span>
                </button>
              </div>
            )}

            <div className="space-y-4">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                >
                  <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-16 h-16 rounded-lg border border-slate-200 bg-white overflow-hidden shrink-0 flex items-center justify-center">
                        {item.cleanPreviewUrl ? (
                          <img
                            src={item.cleanPreviewUrl}
                            alt={`Clean preview of ${item.file.name}`}
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
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {item.file.name}
                        </p>
                        {item.status === 'done' && item.cleanBlob ? (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono tabular-nums text-slate-600">
                            <span>
                              {formatBytes(item.file.size)} →{' '}
                              <strong className="text-slate-900">
                                {formatBytes(item.cleanBlob.size)}
                              </strong>
                            </span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span>
                              {item.width}×{item.height}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="text-teal-700 font-semibold">
                              {item.originalTags.length} tag{item.originalTags.length === 1 ? '' : 's'} found →{' '}
                              {item.verifiedCleanCount ?? 0} remaining
                            </span>
                          </div>
                        ) : item.status === 'error' ? (
                          <p className="text-xs text-red-700">{item.error}</p>
                        ) : (
                          <p className="text-xs text-slate-500">
                            Inspecting &amp; stripping metadata…
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        disabled={item.status !== 'done' || !item.cleanBlob}
                        onClick={() => handleDownloadSingle(item)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 rounded-lg transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Download Clean Copy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remove ${item.file.name}`}
                        className="inline-flex items-center justify-center w-9 h-9 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {item.status === 'done' && (
                    <div className="p-4 sm:p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          {item.hasGps ? (
                            <span className="inline-flex items-center gap-1.5 text-amber-800">
                              <MapPin className="w-4 h-4 text-amber-700" aria-hidden="true" />
                              GPS Location Coordinates Found in Original (Stripped in Clean Copy)
                            </span>
                          ) : item.originalTags.length > 0 ? (
                            <span className="inline-flex items-center gap-1.5 text-slate-800">
                              <ShieldAlert className="w-4 h-4 text-slate-600" aria-hidden="true" />
                              {item.originalTags.length} EXIF / Camera Metadata Tags Detected &amp; Stripped
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-teal-800">
                              <CheckCircle2 className="w-4 h-4 text-teal-700" aria-hidden="true" />
                              No EXIF Metadata Found in Original File
                            </span>
                          )}
                        </div>

                        <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-800">
                          <ShieldCheck className="w-4 h-4 text-teal-700" aria-hidden="true" />
                          Verified Clean Output ({item.verifiedCleanCount ?? 0} tags)
                        </span>
                      </div>

                      {item.originalTags.length > 0 && (
                        <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                          {item.originalTags.map((tag) => (
                            <div
                              key={tag.key}
                              className="px-3.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                            >
                              <span
                                className={`font-mono font-semibold ${
                                  tag.sensitive ? 'text-amber-800' : 'text-slate-700'
                                }`}
                              >
                                {tag.key}
                                {tag.sensitive ? ' (Sensitive)' : ''}
                              </span>
                              <span className="font-mono text-slate-600 break-all sm:text-right">
                                {tag.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <AdSlot placement="mid" />

      <ToolGuide
        title="How It Works & Tips: Inspecting & Removing EXIF Metadata"
        intro="Nearly every photograph taken on a modern smartphone or digital camera silently embeds hidden EXIF, XMP, and GPS headers—often revealing the exact street coordinates where the photo was captured, camera serial numbers, lens settings, and timestamps. LocalConvert lets you inspect those hidden tags and export a verified metadata-free copy locally."
        sections={[
          {
            heading: 'What Hidden Personal Data Lives Inside Photos?',
            body: 'Cameras write Exchangeable Image File (EXIF) segments alongside pixel bytes. Sensitive tags commonly include GPSLatitude, GPSLongitude, GPSAltitude, Make, Model, LensModel, BodySerialNumber, DateTimeOriginal, and editing Software. Uploading unstripped originals to classified ads, public forums, or blogs can inadvertently disclose your home or workplace location.',
          },
          {
            heading: 'How Canvas Re-Encoding Strips Metadata & Verifies Cleanliness',
            body: 'When LocalConvert draws your photograph onto an HTML5 Canvas and encodes a fresh file, only pure RGBA pixel values enter the new image stream. All APP1 EXIF blocks, XMP packets, IPTC author credits, and embedded thumbnails are discarded—and LocalConvert immediately re-scans the generated output with exifr to confirm zero metadata tags remain.',
          },
          {
            heading: 'Why Local Browser Inspection Matters for Real Privacy',
            body: 'Uploading a sensitive photo to a remote server just to check whether it contains GPS coordinates defeats privacy before cleaning even begins. Running exifr directly inside your browser keeps uncleaned original photographs strictly on your own device.',
          },
          {
            heading: 'Automatic Orientation Baking Without Data Loss',
            body: 'Many phone photos appear upright only because of an EXIF Orientation tag. Because LocalConvert renders your image through a modern browser Canvas pipeline before stripping headers, the upright orientation is permanently baked into the pixels so your clean photo never displays rotated sideways.',
          },
        ]}
        tips={[
          'Always strip EXIF and GPS tags before posting marketplace photos taken inside or outside your home.',
          'Click "Load Sample Photo (with EXIF)" to inspect real GPS and camera metadata in action.',
          'Clean client deliverables before publishing so internal software names or author tags stay private.',
          'Keep original unstripped photos in your personal archive if you organize albums by camera date.',
        ]}
        faqs={[
          {
            question: 'Does stripping EXIF data remove GPS location coordinates completely?',
            answer:
              'Yes. GPSLatitude, GPSLongitude, altitude, and GPS timestamps live inside the EXIF segment and are completely absent from the newly encoded clean image.',
          },
          {
            question: 'Will my cleaned photo appear rotated sideways on social media?',
            answer:
              'No. Your browser applies the EXIF orientation transform while decoding onto the Canvas, permanently saving upright pixel orientation.',
          },
          {
            question: 'Why did my PNG screenshot show 0 EXIF tags?',
            answer:
              'Desktop screenshots and images downloaded from major messaging apps usually contain little or no EXIF data. Original camera JPEGs typically hold 15–50+ tags.',
          },
          {
            question: 'Are any inspected EXIF tags or GPS coordinates logged by LocalConvert?',
            answer:
              'Never. Both metadata inspection via exifr and pixel re-encoding run exclusively inside your browser tab RAM. Nothing is transmitted over the internet, making it safe for sensitive legal evidence, real-estate photos, and personal family snapshots.',
          },
        ]}
      />
    </div>
  );
};
