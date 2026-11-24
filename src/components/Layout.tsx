import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, ShieldCheck, X } from 'lucide-react';
import { ROUTES, RouteId } from '../types/routes';

interface LayoutProps {
  currentRoute: RouteId;
  onNavigate: (route: RouteId) => void;
  children: React.ReactNode;
}

const IMAGE_TOOL_IDS: RouteId[] = [
  'compress',
  'image-converter',
  'png-to-webp',
  'exif-remover',
  'qr-generator',
  'meme-cropper',
];

const PDF_TOOL_IDS: RouteId[] = [
  'pdf-to-word',
  'images-to-pdf',
  'merge-split-pdf',
  'pdf-to-images',
];

export const LocalConvertLogo: React.FC<{ className?: string }> = ({
  className = 'w-7 h-7',
}) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    <rect width="32" height="32" rx="8" fill="#0F766E" />
    <rect
      x="6.5"
      y="7.5"
      width="12"
      height="12"
      rx="2.5"
      stroke="#CCFBF1"
      strokeWidth="2"
    />
    <rect
      x="13.5"
      y="12.5"
      width="12"
      height="12"
      rx="2.5"
      fill="#0F766E"
      stroke="#FFFFFF"
      strokeWidth="2"
    />
    <path
      d="M17.5 18.5H21.5M21.5 18.5L19.75 16.75M21.5 18.5L19.75 20.25"
      stroke="#5EEAD4"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const AdSlot: React.FC<{
  placement: 'top' | 'mid' | 'bottom';
  dimensions?: string;
}> = ({ placement, dimensions }) => {
  const labelMap: Record<'top' | 'mid' | 'bottom', string> = {
    top: 'Advertisement · Top Responsive Banner (728×90)',
    mid: 'Advertisement · In-Content Responsive Unit',
    bottom: 'Advertisement · Bottom Leaderboard (728×90)',
  };

  return (
    <aside
      aria-label={`Advertisement slot (${placement})`}
      data-ad-slot={`localconvert-${placement}`}
      className="w-full my-6"
    >
      <div className="mx-auto max-w-5xl rounded-lg border border-dashed border-slate-300 bg-slate-100/70 px-4 py-3 text-center flex flex-col items-center justify-center min-h-[84px] sm:min-h-[96px]">
        <span className="text-xs font-medium tracking-wide text-slate-500">
          {dimensions ? `Advertisement · ${dimensions}` : labelMap[placement]}
        </span>
        <span className="mt-0.5 text-[11px] text-slate-400">
          Reserved AdSense container (zero layout shift)
        </span>
      </div>
    </aside>
  );
};

export const Layout: React.FC<LayoutProps> = ({
  currentRoute,
  onNavigate,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'image' | 'pdf' | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDropdown(null);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleNavClick = (e: React.MouseEvent, route: RouteId) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    setOpenDropdown(null);
    onNavigate(route);
  };

  const isImageActive = IMAGE_TOOL_IDS.includes(currentRoute);
  const isPdfActive = PDF_TOOL_IDS.includes(currentRoute);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar: 3-zone contract */}
      <header className="bg-white border-b border-slate-200 relative z-30">
        <div
          ref={navRef}
          className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-8"
        >
          {/* Zone 1: Custom SVG logo + single-line brand wordmark */}
          <a
            href="/"
            onClick={(e) => handleNavClick(e, 'home')}
            className="inline-flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 rounded-sm"
          >
            <LocalConvertLogo className="w-7 h-7 shrink-0" />
            <span>LocalConvert</span>
          </a>

          {/* Zone 2: 5 concise single-line nav items with clean dropdown menus */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            <a
              href="/"
              onClick={(e) => handleNavClick(e, 'home')}
              aria-current={currentRoute === 'home' ? 'page' : undefined}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                currentRoute === 'home'
                  ? 'text-teal-700 border-teal-700 font-semibold'
                  : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Home
            </a>

            {/* Image Tools Dropdown */}
            <div className="relative">
              <button
                type="button"
                aria-expanded={openDropdown === 'image'}
                onClick={() =>
                  setOpenDropdown((prev) => (prev === 'image' ? null : 'image'))
                }
                className={`inline-flex items-center gap-1 py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                  isImageActive
                    ? 'text-teal-700 border-teal-700 font-semibold'
                    : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <span>Image Tools</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    openDropdown === 'image' ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {openDropdown === 'image' && (
                <div
                  role="menu"
                  className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg p-1.5 z-40"
                >
                  {IMAGE_TOOL_IDS.map((id) => {
                    const r = ROUTES[id];
                    const active = currentRoute === id;
                    return (
                      <a
                        key={id}
                        role="menuitem"
                        href={r.path}
                        onClick={(e) => handleNavClick(e, id)}
                        className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                          active
                            ? 'bg-teal-50 text-teal-800 font-semibold'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {r.navLabel}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* PDF Tools Dropdown */}
            <div className="relative">
              <button
                type="button"
                aria-expanded={openDropdown === 'pdf'}
                onClick={() =>
                  setOpenDropdown((prev) => (prev === 'pdf' ? null : 'pdf'))
                }
                className={`inline-flex items-center gap-1 py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                  isPdfActive
                    ? 'text-teal-700 border-teal-700 font-semibold'
                    : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <span>PDF Tools</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    openDropdown === 'pdf' ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {openDropdown === 'pdf' && (
                <div
                  role="menu"
                  className="absolute left-0 top-full mt-2 w-60 rounded-xl border border-slate-200 bg-white shadow-lg p-1.5 z-40"
                >
                  {PDF_TOOL_IDS.map((id) => {
                    const r = ROUTES[id];
                    const active = currentRoute === id;
                    return (
                      <a
                        key={id}
                        role="menuitem"
                        href={r.path}
                        onClick={(e) => handleNavClick(e, id)}
                        className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                          active
                            ? 'bg-teal-50 text-teal-800 font-semibold'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {r.navLabel}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            <a
              href="/about"
              onClick={(e) => handleNavClick(e, 'about')}
              aria-current={currentRoute === 'about' ? 'page' : undefined}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                currentRoute === 'about'
                  ? 'text-teal-700 border-teal-700 font-semibold'
                  : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              About
            </a>
          </nav>

          {/* Zone 3: Single primary action + Mobile drawer button */}
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="/privacy"
              onClick={(e) => handleNavClick(e, 'privacy')}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              Privacy Policy
            </a>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label={
                mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'
              }
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile Navigation"
            className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto"
          >
            <a
              href="/"
              onClick={(e) => handleNavClick(e, 'home')}
              className={`block px-3 py-2 rounded-lg text-sm font-semibold ${
                currentRoute === 'home'
                  ? 'bg-teal-50 text-teal-800'
                  : 'text-slate-800 hover:bg-slate-100'
              }`}
            >
              Home Dashboard
            </a>

            <div className="space-y-1">
              <p className="px-3 text-xs font-semibold text-slate-500">
                Image &amp; Privacy Tools
              </p>
              <div className="grid grid-cols-1 gap-1">
                {IMAGE_TOOL_IDS.map((id) => (
                  <a
                    key={id}
                    href={ROUTES[id].path}
                    onClick={(e) => handleNavClick(e, id)}
                    className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                      currentRoute === id
                        ? 'bg-teal-50 text-teal-800 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {ROUTES[id].navLabel}
                  </a>
                ))}
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t border-slate-100">
              <p className="px-3 text-xs font-semibold text-slate-500">
                PDF Document Tools
              </p>
              <div className="grid grid-cols-1 gap-1">
                {PDF_TOOL_IDS.map((id) => (
                  <a
                    key={id}
                    href={ROUTES[id].path}
                    onClick={(e) => handleNavClick(e, id)}
                    className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                      currentRoute === id
                        ? 'bg-teal-50 text-teal-800 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {ROUTES[id].navLabel}
                  </a>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
              {(['privacy', 'terms', 'about'] as RouteId[]).map(
                (infoId) => (
                  <a
                    key={infoId}
                    href={ROUTES[infoId].path}
                    onClick={(e) => handleNavClick(e, infoId)}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    {ROUTES[infoId].navLabel}
                  </a>
                )
              )}
            </div>
          </nav>
        )}
      </header>

      {/* Prominent Client-Side Privacy Assurance Strip */}
      <div
        role="status"
        className="bg-teal-950 text-teal-50 border-b border-teal-900"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-2.5 flex items-center justify-center gap-2.5 text-xs sm:text-sm font-medium text-center">
          <ShieldCheck
            className="w-4 h-4 text-teal-300 shrink-0"
            aria-hidden="true"
          />
          <span>
            100% Client-Side Privacy: All images, PDFs, and metadata stay locally on your device — zero server uploads.
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        <AdSlot placement="top" />
        {children}
        <AdSlot placement="bottom" />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 pb-8 border-b border-slate-200">
            <div className="lg:col-span-4 space-y-3">
              <a
                href="/"
                onClick={(e) => handleNavClick(e, 'home')}
                className="inline-flex items-center gap-2 font-display text-lg font-bold text-slate-900"
              >
                <LocalConvertLogo className="w-6 h-6 shrink-0" />
                <span>LocalConvert</span>
              </a>
              <p className="text-sm text-slate-600 leading-relaxed max-w-sm">
                LocalConvert (purepixel.xyz) is a privacy-first browser toolkit for compressing images, converting formats, stripping EXIF metadata, generating custom logo QR codes, and working with PDFs locally.
              </p>
            </div>

            <div className="lg:col-span-3 space-y-3">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Image &amp; Privacy Tools
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {IMAGE_TOOL_IDS.map((id) => (
                  <li key={id}>
                    <a
                      href={ROUTES[id].path}
                      onClick={(e) => handleNavClick(e, id)}
                      className="hover:text-teal-700 transition-colors"
                    >
                      {ROUTES[id].navLabel}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-3 space-y-3">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                PDF Tools
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {PDF_TOOL_IDS.map((id) => (
                  <li key={id}>
                    <a
                      href={ROUTES[id].path}
                      onClick={(e) => handleNavClick(e, id)}
                      className="hover:text-teal-700 transition-colors"
                    >
                      {ROUTES[id].navLabel}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Legal &amp; Info
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {(['privacy', 'terms', 'about'] as RouteId[]).map(
                  (id) => (
                    <li key={id}>
                      <a
                        href={ROUTES[id].path}
                        onClick={(e) => handleNavClick(e, id)}
                        className="hover:text-teal-700 transition-colors"
                      >
                        {ROUTES[id].navLabel}
                      </a>
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
            <p>
              © {new Date().getFullYear()} LocalConvert (purepixel.xyz). All image and PDF processing runs locally in your browser.
            </p>
            <div className="flex items-center gap-3">
              <span>Zero File Uploads</span>
              <span aria-hidden="true">·</span>
              <span>HTML5 Canvas &amp; PDF.js</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
