import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ImagePlus,
  Trash2,
} from 'lucide-react';
import { RouteId } from '../types/routes';
import { getContrastRatio, triggerBlobDownload } from '../utils/format';
import { AdSlot } from '../components/Layout';
import { ToolGuide } from '../components/ToolGuide';

interface QrGeneratorPageProps {
  onNavigate: (route: RouteId) => void;
}

const SIZE_OPTIONS = [256, 512, 1024, 2048];

export const QrGeneratorPage: React.FC<QrGeneratorPageProps> = ({
  onNavigate,
}) => {
  const [text, setText] = useState<string>('https://purepixel.xyz');
  const [fgColor, setFgColor] = useState<string>('#0f172a');
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [qrSize, setQrSize] = useState<number>(512);
  const [errorCorrection, setErrorCorrection] = useState<'L' | 'M' | 'Q' | 'H'>('H');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [logoScale, setLogoScale] = useState<number>(20); // % of QR width (12% - 26%)
  const [logoPadding, setLogoPadding] = useState<number>(8);
  const [renderError, setRenderError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const contrastRatio = getContrastRatio(fgColor, bgColor);
  const hasLowContrast = contrastRatio < 3.5;

  // Whenever user uploads a logo, enforce High ('H') error correction automatically for reliable scanning
  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoDataUrl(reader.result);
        setLogoName(file.name);
        setErrorCorrection('H');
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    let cancelled = false;

    const renderQrToCanvas = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const value = text.trim() || ' ';
      setRenderError(null);

      try {
        canvas.width = qrSize;
        canvas.height = qrSize;

        await QRCode.toCanvas(canvas, value, {
          width: qrSize,
          margin: 3,
          errorCorrectionLevel: errorCorrection,
          color: {
            dark: fgColor,
            light: bgColor,
          },
        });

        if (cancelled || !logoDataUrl) return;

        const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Could not decode center logo image.'));
          img.src = logoDataUrl;
        });

        if (cancelled) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const maxLogoBox = Math.round(qrSize * (logoScale / 100));
        const imgAspect = logoImg.width / Math.max(1, logoImg.height);
        let drawW = maxLogoBox;
        let drawH = maxLogoBox;
        if (imgAspect > 1) {
          drawH = Math.round(maxLogoBox / imgAspect);
        } else {
          drawW = Math.round(maxLogoBox * imgAspect);
        }

        const padPx = Math.round((logoPadding / 512) * qrSize);
        const plateW = drawW + padPx * 2;
        const plateH = drawH + padPx * 2;
        const plateX = Math.round((qrSize - plateW) / 2);
        const plateY = Math.round((qrSize - plateH) / 2);
        const radius = Math.round(Math.min(plateW, plateH) * 0.16);

        // Draw clean background knockout plate so QR modules don't collide with logo edges
        ctx.save();
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(plateX, plateY, plateW, plateH, radius);
        ctx.fill();
        ctx.restore();

        const drawX = Math.round((qrSize - drawW) / 2);
        const drawY = Math.round((qrSize - drawH) / 2);
        ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
      } catch (err) {
        if (!cancelled) {
          setRenderError(
            err instanceof Error
              ? err.message
              : 'Unable to encode QR data. Try shortening the text.'
          );
        }
      }
    };

    void renderQrToCanvas();

    return () => {
      cancelled = true;
    };
  }, [text, fgColor, bgColor, qrSize, errorCorrection, logoDataUrl, logoScale, logoPadding]);

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) {
        triggerBlobDownload(blob, `localconvert-qr-${qrSize}px.png`);
      }
    }, 'image/png');
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
          QR Code Generator with Custom Logo
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Create high-resolution scannable QR codes with custom brand colors and a centered logo overlay.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Content Input */}
            <div className="space-y-2">
              <label
                htmlFor="qr-text-input"
                className="block text-sm font-semibold text-slate-900"
              >
                URL or Text Content
              </label>
              <textarea
                id="qr-text-input"
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="https://example.com or any text"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500">Quick fill:</span>
                <button
                  type="button"
                  onClick={() => setText('https://example.com')}
                  className="px-2.5 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Website URL
                </button>
                <button
                  type="button"
                  onClick={() => setText('WIFI:T:WPA;S:GuestNetwork;P:SecurePass123;;')}
                  className="px-2.5 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Wi-Fi Credentials
                </button>
                <button
                  type="button"
                  onClick={() => setText('mailto:hello@example.com?subject=Hello')}
                  className="px-2.5 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Email Link
                </button>
              </div>
            </div>

            {/* Colors & Contrast */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div className="space-y-1.5">
                <label
                  htmlFor="qr-fg-color"
                  className="block text-sm font-semibold text-slate-900"
                >
                  Foreground Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="qr-fg-color"
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="w-10 h-10 p-0.5 rounded border border-slate-300 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    aria-label="Foreground color hex"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="qr-bg-color"
                  className="block text-sm font-semibold text-slate-900"
                >
                  Background Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="qr-bg-color"
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-10 h-10 p-0.5 rounded border border-slate-300 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    aria-label="Background color hex"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>
            </div>

            {/* Contrast Indicator */}
            <div
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs border ${
                hasLowContrast
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-teal-50 border-teal-200 text-teal-900'
              }`}
            >
              {hasLowContrast ? (
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
              )}
              <span>
                Contrast ratio{' '}
                <strong className="font-mono tabular-nums">
                  {contrastRatio.toFixed(1)}:1
                </strong>{' '}
                —{' '}
                {hasLowContrast
                  ? 'Low contrast may prevent phone cameras from scanning reliably.'
                  : 'Excellent contrast for fast camera recognition.'}
              </span>
            </div>

            {/* Size & Error Correction */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div className="space-y-1.5">
                <span className="block text-sm font-semibold text-slate-900">
                  Export Resolution
                </span>
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
                  {SIZE_OPTIONS.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setQrSize(size)}
                      className={`py-1.5 text-xs font-mono font-medium rounded-md transition-colors ${
                        qrSize === size
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {size}px
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="block text-sm font-semibold text-slate-900">
                  Error Correction
                </span>
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
                  {(['L', 'M', 'Q', 'H'] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setErrorCorrection(level)}
                      className={`py-1.5 text-xs font-mono font-medium rounded-md transition-colors ${
                        errorCorrection === level
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">
                  Level H (30% recovery) is recommended when adding a center logo.
                </p>
              </div>
            </div>

            {/* Center Logo Overlay */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Center Logo Overlay (Optional)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Overlays cleanly in the center with a protective margin plate.
                  </p>
                </div>

                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleLogoUpload(file);
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <ImagePlus className="w-4 h-4" aria-hidden="true" />
                    <span>{logoDataUrl ? 'Change Logo' : 'Upload Logo'}</span>
                  </button>
                  {logoDataUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoDataUrl(null);
                        setLogoName(null);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>

              {logoDataUrl && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg bg-slate-50 border border-slate-200 p-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <label htmlFor="logo-scale" className="font-medium text-slate-700">
                        Logo Size ({logoName || 'Uploaded'})
                      </label>
                      <span className="font-mono tabular-nums text-slate-900">
                        {logoScale}%
                      </span>
                    </div>
                    <input
                      id="logo-scale"
                      type="range"
                      min={12}
                      max={26}
                      value={logoScale}
                      onChange={(e) => setLogoScale(Number(e.target.value))}
                      className="w-full toolkit-slider"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <label htmlFor="logo-padding" className="font-medium text-slate-700">
                        Logo Margin Plate
                      </label>
                      <span className="font-mono tabular-nums text-slate-900">
                        {logoPadding}px
                      </span>
                    </div>
                    <input
                      id="logo-padding"
                      type="range"
                      min={0}
                      max={20}
                      value={logoPadding}
                      onChange={(e) => setLogoPadding(Number(e.target.value))}
                      className="w-full toolkit-slider"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Preview Column */}
          <div className="lg:col-span-5 flex flex-col items-center space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6">
            <div className="w-full flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Live QR Preview</span>
              <span className="font-mono tabular-nums">
                {qrSize}×{qrSize} px · ECC {errorCorrection}
              </span>
            </div>

            {renderError ? (
              <div
                role="alert"
                className="w-full aspect-square max-w-[320px] rounded-lg border border-red-200 bg-red-50 flex items-center justify-center p-6 text-center text-sm text-red-800"
              >
                {renderError}
              </div>
            ) : (
              <div className="w-full max-w-[320px] aspect-square rounded-lg border border-slate-200 bg-white p-3 flex items-center justify-center shadow-xs">
                <canvas
                  ref={canvasRef}
                  aria-label="Live QR code preview"
                  className="max-w-full max-h-full w-auto h-auto"
                />
              </div>
            )}

            <button
              type="button"
              disabled={!text.trim() || Boolean(renderError)}
              onClick={handleDownloadPng}
              className="w-full max-w-[320px] inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Download PNG ({qrSize}×{qrSize})</span>
            </button>
          </div>
        </div>
      </section>

      <AdSlot placement="mid" />

      <ToolGuide
        title="How It Works & Tips: Custom Logo QR Codes"
        intro="QR codes connect physical print materials—packaging, business cards, event badges, Wi-Fi cards, and restaurant menus—directly to digital experiences. Unfortunately, many online QR builders inject tracking redirects that expire unless you pay a monthly fee. LocalConvert encodes clean, permanent QR codes with optional brand logos completely inside your browser."
        sections={[
          {
            heading: 'How Center Logos Stay 100% Scannable',
            body: 'The ISO/IEC 18004 QR standard embeds Reed-Solomon error correction blocks across the matrix. At Level H (High), up to 30% of the symbol area can be covered or damaged and still decode reliably. Whenever you upload a logo into LocalConvert, error correction automatically locks to Level H and draws a rounded protective margin plate behind your icon so neighboring finder patterns and data modules never collide.',
          },
          {
            heading: 'Luminance Contrast & Camera Recognition',
            body: 'Smartphone cameras locate QR squares by measuring contrast between dark foreground modules and the bright quiet zone border. Always aim for a contrast ratio above 4.0:1—LocalConvert calculates your live WCAG contrast score automatically and warns you if colors are too close. Avoid light-colored dots on dark paper, as older barcode readers struggle with inverted polarity.',
          },
          {
            heading: 'Selecting the Right PNG Resolution for Screen vs. Print',
            body: 'Use 256px or 512px PNG exports for websites, mobile onboarding screens, email signatures, and slide decks. Switch to 1024px or 2048px when placing codes onto flyers, product labels, exhibition banners, or print brochures so every module edge remains crisp without blurry upscaling.',
          },
          {
            heading: 'Zero Tracking Redirects & Private Payload Encoding',
            body: 'Whether you encode a public website URL, a private guest Wi-Fi password (WIFI:T:WPA;...), or an internal onboarding link, your text is computed directly into a Canvas QR matrix inside local memory. Nothing is sent to a URL shortener or analytics tracker, and your QR code never expires.',
          },
        ]}
        tips={[
          'Keep center logos between 15% and 22% of the QR width for fastest camera autofocus.',
          'Always pair a dark foreground color with a clean light background and generous quiet zone.',
          'Test printed QR codes with both iOS and Android cameras under indoor lighting before bulk printing.',
          'Shorter URLs generate sparser module grids that scan reliably from further away.',
        ]}
        faqs={[
          {
            question: 'Will QR codes created with LocalConvert ever expire?',
            answer:
              'Never. Static QR codes encode your exact text or URL directly into the matrix pattern with zero third-party redirect servers. As long as your destination link works, the code works forever.',
          },
          {
            question: 'Why does uploading a logo switch Error Correction to Level H?',
            answer:
              'A centered brand mark covers modules in the middle of the symbol. Level H embeds 30% redundant recovery data so phone cameras reconstruct the obscured area instantaneously.',
          },
          {
            question: 'What image format works best for the center logo overlay?',
            answer:
              'Transparent PNG or SVG marks with bold, simple silhouettes perform best. Avoid fine multi-line text inside tiny center logos that may blur at small print sizes.',
          },
          {
            question: 'Is my Wi-Fi password or private text transmitted to a server?',
            answer:
              'No. The entire QR matrix and logo composition are rendered locally inside your browser tab memory and never touch any external network.',
          },
        ]}
      />
    </div>
  );
};
