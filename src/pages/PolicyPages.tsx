import React from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { RouteId } from '../types/routes';

interface PolicyPageProps {
  onNavigate: (route: RouteId) => void;
}

const BackButton: React.FC<{ onNavigate: (route: RouteId) => void }> = ({
  onNavigate,
}) => (
  <button
    type="button"
    onClick={() => onNavigate('home')}
    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-teal-700 mb-3 transition-colors"
  >
    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
    <span>Back to All Tools</span>
  </button>
);

export const PrivacyPolicyPage: React.FC<PolicyPageProps> = ({ onNavigate }) => {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 sm:p-10 max-w-4xl mx-auto space-y-8">
      <header className="space-y-2 border-b border-slate-200 pb-6">
        <BackButton onNavigate={onNavigate} />
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
          Privacy Policy
        </h1>
        <p className="text-sm text-slate-500">
          Effective Date: November 23, 2026 · LocalConvert (purepixel.xyz)
        </p>
      </header>

      <div className="space-y-6 text-sm sm:text-[15px] text-slate-700 leading-relaxed">
        <section className="rounded-lg bg-teal-50 border border-teal-200 p-5 flex gap-3 items-start">
          <ShieldCheck className="w-5 h-5 text-teal-800 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="font-display font-semibold text-teal-950">
              Summary: 100% Local Processing &amp; Zero File Uploads
            </h2>
            <p className="text-sm text-teal-900">
              Every image compression, format conversion, EXIF metadata inspection/removal, PDF transformation (Word export, merging, splitting, and page rendering), QR code generation, and meme cropping tool on LocalConvert (https://purepixel.xyz) executes 100% locally inside your web browser. We never upload, store, log, or inspect your files.
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-slate-900">
            1. Client-Side File Handling &amp; Zero Data Collection on Files
          </h2>
          <p>
            When you drop or select images, PDFs, or logos into LocalConvert, your browser reads those files directly from local storage using standard FileReader, Object URL, PDF.js, pdf-lib, and HTML5 Canvas APIs. All transformations happen strictly within volatile browser memory on your own CPU/GPU. Your files never leave your device and are discarded from memory automatically when you clear the tool queue or close your browser tab.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-slate-900">
            2. Personal Information &amp; Zero Account Collection
          </h2>
          <p>
            LocalConvert does not require registration, accounts, sign-in, or personal profiles. All utilities operate directly inside your browser without collecting personal contact information. If you email us voluntarily at support@purepixel.xyz, we use your message solely to respond to your inquiry and never sell, rent, or trade details with third parties.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-slate-900">
            3. Third-Party Advertising, Google AdSense &amp; DoubleClick Cookies
          </h2>
          <p>
            To keep LocalConvert free and accessible without usage limits, purepixel.xyz uses reserved ad placements to display advertisements served by Google AdSense and its certified advertising partners.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Third-party vendors, including Google, use cookies (such as the Google DoubleClick / DART cookie) and similar device identifiers to serve ads based on a user&apos;s prior visits to purepixel.xyz or other websites on the internet.
            </li>
            <li>
              Google&apos;s use of advertising cookies enables it and its partners to serve relevant ads to visitors based on browsing context and interests.
            </li>
            <li>
              Users may opt out of personalized advertising at any time by visiting{' '}
              <a
                href="https://adssettings.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 underline hover:text-teal-900"
              >
                Google Ads Settings
              </a>{' '}
              or by visiting{' '}
              <a
                href="https://www.aboutads.info/choices/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 underline hover:text-teal-900"
              >
                www.aboutads.info/choices
              </a>
              . Visitors in the EEA, UK, and applicable US states may also manage consent preferences via browser cookie controls or consent prompts when active.
            </li>
            <li>
              Advertising scripts never have access to the local files, images, PDFs, or QR text you process inside LocalConvert tools.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-slate-900">
            4. Standard Server Access Logs
          </h2>
          <p>
            When loading static HTML, JavaScript, and CSS files from purepixel.xyz, our hosting infrastructure may record standard, non-identifying HTTP request logs (such as IP address, browser user-agent, timestamp, and requested URL path) strictly for uptime monitoring, security, and abuse prevention.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-slate-900">
            5. Children&apos;s Privacy &amp; Policy Updates
          </h2>
          <p>
            LocalConvert is a general-purpose utility website not directed at children under 13. We may update this Privacy Policy from time to time as new client-side utilities or regulatory requirements arise. Privacy inquiries may be sent to support@purepixel.xyz.
          </p>
        </section>
      </div>
    </article>
  );
};

export const TermsOfServicePage: React.FC<PolicyPageProps> = ({ onNavigate }) => {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 sm:p-10 max-w-4xl mx-auto space-y-8">
      <header className="space-y-2 border-b border-slate-200 pb-6">
        <BackButton onNavigate={onNavigate} />
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
          Terms of Service
        </h1>
        <p className="text-sm text-slate-500">
          Effective Date: November 23, 2026 · LocalConvert (purepixel.xyz)
        </p>
      </header>

      <div className="space-y-6 text-sm sm:text-[15px] text-slate-700 leading-relaxed">
        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-slate-900">
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing and using LocalConvert (https://purepixel.xyz), you agree to comply with these Terms of Service and all applicable local, national, and international laws. If you do not agree with these terms, please refrain from using this website.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-slate-900">
            2. User Content Ownership &amp; Responsibility
          </h2>
          <p>
            You retain 100% ownership, copyright, and intellectual property rights over every image, PDF, logo, QR code, and document processed with LocalConvert. Because all transformations execute locally inside your browser, LocalConvert asserts zero license or claim over your files. You are solely responsible for ensuring you possess the legal rights to edit, convert, or distribute any media processed on your device.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-slate-900">
            3. Disclaimer of Warranties
          </h2>
          <p>
            LocalConvert is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without express or implied warranties of any kind. While we test color encoding, EXIF stripping, PDF extraction, and QR readability across modern browsers, you should always inspect critical outputs—especially printed QR codes, legal PDFs, and archival photographs—before discarding original source files.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-slate-900">
            4. Limitation of Liability
          </h2>
          <p>
            To the fullest extent permitted by law, LocalConvert and its maintainers shall not be liable for any indirect, incidental, consequential, or special damages arising from data loss, browser memory constraints, or inability to use the toolkit.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-slate-900">
            5. Updates to These Terms
          </h2>
          <p>
            We may revise these Terms of Service periodically as new client-side tools are released. Continued use of purepixel.xyz after changes are posted constitutes acceptance of the updated terms.
          </p>
        </section>
      </div>
    </article>
  );
};

export const AboutPage: React.FC<PolicyPageProps> = ({ onNavigate }) => {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 sm:p-10 max-w-4xl mx-auto space-y-8">
      <header className="space-y-2 border-b border-slate-200 pb-6">
        <BackButton onNavigate={onNavigate} />
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
          About LocalConvert
        </h1>
        <p className="text-sm text-slate-500">
          purepixel.xyz · Built for speed, simplicity, and uncompromising file privacy.
        </p>
      </header>

      <div className="space-y-6 text-sm sm:text-[15px] text-slate-700 leading-relaxed">
        <p>
          Most everyday file utilities force an unnecessary trade-off: to compress a photo, strip GPS tags, convert a PDF to Word, or generate a branded QR code, you are asked to upload private documents onto an unknown remote server, wait in a queue, and hope your files are deleted afterward.
        </p>
        <p>
          LocalConvert (purepixel.xyz) was created to eliminate that server round-trip completely. Modern web browsers include powerful graphics and document engines—HTML5 Canvas, PDF.js, pdf-lib, and client-side ZIP archiving—capable of handling everyday image and PDF workflows directly on your laptop, tablet, or smartphone at native speed.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1.5">
            <h2 className="font-display text-base font-bold text-slate-900">
              Our Core Principles
            </h2>
            <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
              <li>Zero server uploads for user images or PDFs</li>
              <li>No accounts, subscriptions, or artificial file limits</li>
              <li>Accessible, mobile-ready controls across every view</li>
              <li>Clear technical guides for every format and workflow</li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1.5">
            <h2 className="font-display text-base font-bold text-slate-900">
              Explore All Tools
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('compress')}
                className="text-left text-sm font-medium text-teal-700 hover:underline"
              >
                → Bulk Image Compressor
              </button>
              <button
                type="button"
                onClick={() => onNavigate('image-converter')}
                className="text-left text-sm font-medium text-teal-700 hover:underline"
              >
                → Universal Image Converter
              </button>
              <button
                type="button"
                onClick={() => onNavigate('png-to-webp')}
                className="text-left text-sm font-medium text-teal-700 hover:underline"
              >
                → PNG to WebP Converter
              </button>
              <button
                type="button"
                onClick={() => onNavigate('exif-remover')}
                className="text-left text-sm font-medium text-teal-700 hover:underline"
              >
                → EXIF Metadata Remover
              </button>
              <button
                type="button"
                onClick={() => onNavigate('qr-generator')}
                className="text-left text-sm font-medium text-teal-700 hover:underline"
              >
                → QR Code with Logo
              </button>
              <button
                type="button"
                onClick={() => onNavigate('meme-cropper')}
                className="text-left text-sm font-medium text-teal-700 hover:underline"
              >
                → Social &amp; Meme Cropper
              </button>
              <button
                type="button"
                onClick={() => onNavigate('pdf-to-word')}
                className="text-left text-sm font-medium text-teal-700 hover:underline"
              >
                → PDF to Word (.docx)
              </button>
              <button
                type="button"
                onClick={() => onNavigate('images-to-pdf')}
                className="text-left text-sm font-medium text-teal-700 hover:underline"
              >
                → Images to PDF
              </button>
              <button
                type="button"
                onClick={() => onNavigate('merge-split-pdf')}
                className="text-left text-sm font-medium text-teal-700 hover:underline"
              >
                → Merge &amp; Split PDF
              </button>
              <button
                type="button"
                onClick={() => onNavigate('pdf-to-images')}
                className="text-left text-sm font-medium text-teal-700 hover:underline"
              >
                → PDF to Images
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
