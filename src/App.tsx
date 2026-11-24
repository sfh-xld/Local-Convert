/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { BulkCompressorPage } from './pages/BulkCompressorPage';
import { PngToWebpPage } from './pages/PngToWebpPage';
import { ImageFormatConverterPage } from './pages/ImageFormatConverterPage';
import { ExifRemoverPage } from './pages/ExifRemoverPage';
import { QrGeneratorPage } from './pages/QrGeneratorPage';
import { MemeCropperPage } from './pages/MemeCropperPage';
import { PdfToWordPage } from './pages/PdfToWordPage';
import { ImagesToPdfPage } from './pages/ImagesToPdfPage';
import { MergeSplitPdfPage } from './pages/MergeSplitPdfPage';
import { PdfToImagesPage } from './pages/PdfToImagesPage';
import {
  AboutPage,
  PrivacyPolicyPage,
  TermsOfServicePage,
} from './pages/PolicyPages';
import {
  ROUTES,
  RouteId,
  SITE_ORIGIN,
  resolveRouteFromPath,
} from './types/routes';

function setMetaContent(selector: string, value: string) {
  const el = document.querySelector(selector);
  if (el) {
    el.setAttribute('content', value);
  }
}

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<RouteId>(() =>
    resolveRouteFromPath(window.location.pathname)
  );

  const navigate = useCallback((route: RouteId) => {
    const target = ROUTES[route];
    if (window.location.pathname !== target.path) {
      window.history.pushState({ route }, '', target.path);
    }
    setCurrentRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(resolveRouteFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Dynamically sync title, meta description, canonical URL, OpenGraph, and Twitter tags per route
  useEffect(() => {
    const meta = ROUTES[currentRoute];
    const canonicalUrl = `${SITE_ORIGIN}${meta.path === '/' ? '/' : meta.path}`;

    document.title = meta.title;
    setMetaContent('meta[name="description"]', meta.description);
    setMetaContent('meta[property="og:title"]', meta.title);
    setMetaContent('meta[property="og:description"]', meta.description);
    setMetaContent('meta[property="og:url"]', canonicalUrl);
    setMetaContent('meta[name="twitter:title"]', meta.title);
    setMetaContent('meta[name="twitter:description"]', meta.description);

    const canonicalEl = document.querySelector('link[rel="canonical"]');
    if (canonicalEl) {
      canonicalEl.setAttribute('href', canonicalUrl);
    }
  }, [currentRoute]);

  const renderPage = () => {
    switch (currentRoute) {
      case 'compress':
        return <BulkCompressorPage onNavigate={navigate} />;
      case 'png-to-webp':
        return <PngToWebpPage onNavigate={navigate} />;
      case 'image-converter':
        return <ImageFormatConverterPage onNavigate={navigate} />;
      case 'exif-remover':
        return <ExifRemoverPage onNavigate={navigate} />;
      case 'qr-generator':
        return <QrGeneratorPage onNavigate={navigate} />;
      case 'meme-cropper':
        return <MemeCropperPage onNavigate={navigate} />;
      case 'pdf-to-word':
        return <PdfToWordPage onNavigate={navigate} />;
      case 'images-to-pdf':
        return <ImagesToPdfPage onNavigate={navigate} />;
      case 'merge-split-pdf':
        return <MergeSplitPdfPage onNavigate={navigate} />;
      case 'pdf-to-images':
        return <PdfToImagesPage onNavigate={navigate} />;
      case 'privacy':
        return <PrivacyPolicyPage onNavigate={navigate} />;
      case 'terms':
        return <TermsOfServicePage onNavigate={navigate} />;
      case 'about':
        return <AboutPage onNavigate={navigate} />;
      case 'home':
      default:
        return <HomePage onNavigate={navigate} />;
    }
  };

  return (
    <Layout currentRoute={currentRoute} onNavigate={navigate}>
      {renderPage()}
    </Layout>
  );
}
