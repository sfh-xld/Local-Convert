export type RouteId =
  | 'home'
  | 'compress'
  | 'png-to-webp'
  | 'image-converter'
  | 'exif-remover'
  | 'qr-generator'
  | 'meme-cropper'
  | 'pdf-to-word'
  | 'images-to-pdf'
  | 'merge-split-pdf'
  | 'pdf-to-images'
  | 'privacy'
  | 'terms'
  | 'about';

export interface RouteMeta {
  id: RouteId;
  path: string;
  title: string;
  navLabel: string;
  description: string;
}

export const SITE_ORIGIN = 'https://purepixel.xyz';

export const ROUTES: Record<RouteId, RouteMeta> = {
  home: {
    id: 'home',
    path: '/',
    title: 'LocalConvert – Private Client-Side Image & PDF Toolkit',
    navLabel: 'Home',
    description:
      'Compress images, convert PNG/JPG/WebP, strip EXIF metadata, convert PDFs to Word or images, and crop memes 100% locally in your browser with zero uploads.',
  },
  compress: {
    id: 'compress',
    path: '/compress-image',
    title: 'Bulk Image Compressor – LocalConvert',
    navLabel: 'Bulk Compressor',
    description:
      'Compress JPG, PNG, and WebP images in bulk directly in your browser with custom quality, max dimensions, and ZIP export.',
  },
  'png-to-webp': {
    id: 'png-to-webp',
    path: '/png-to-webp',
    title: 'PNG to WebP Converter – LocalConvert',
    navLabel: 'PNG to WebP',
    description:
      'Convert single or multiple PNG files to lightweight WebP images using HTML5 Canvas while preserving alpha transparency.',
  },
  'image-converter': {
    id: 'image-converter',
    path: '/image-converter',
    title: 'Universal Image Format Converter – LocalConvert',
    navLabel: 'Image Converter',
    description:
      'Convert images between PNG, JPG, WebP, GIF, SVG, and BMP locally in your browser with quality control, background fill, and ZIP export.',
  },
  'exif-remover': {
    id: 'exif-remover',
    path: '/exif-remover',
    title: 'EXIF Metadata Viewer & Remover – LocalConvert',
    navLabel: 'EXIF Remover',
    description:
      'Inspect hidden camera, GPS location, and EXIF metadata inside your photos and strip it cleanly in your browser before sharing.',
  },
  'qr-generator': {
    id: 'qr-generator',
    path: '/qr-generator',
    title: 'QR Code Generator with Custom Logo – LocalConvert',
    navLabel: 'QR Code Generator',
    description:
      'Create scannable QR codes with custom colors, high-resolution export, and centered logo overlays locally on your device.',
  },
  'meme-cropper': {
    id: 'meme-cropper',
    path: '/meme-cropper',
    title: 'Social Media & Meme Cropper – LocalConvert',
    navLabel: 'Meme Cropper',
    description:
      'Crop images to 1:1, 4:5, 9:16, 16:9, or free dimensions and add outlined top and bottom meme captions in your browser.',
  },
  'pdf-to-word': {
    id: 'pdf-to-word',
    path: '/pdf-to-word',
    title: 'PDF to Word (.docx) Converter – LocalConvert',
    navLabel: 'PDF to Word',
    description:
      'Extract text and paragraphs from PDF files completely client-side, edit the live preview, and download a clean .docx Word document.',
  },
  'images-to-pdf': {
    id: 'images-to-pdf',
    path: '/images-to-pdf',
    title: 'Images to PDF Converter – LocalConvert',
    navLabel: 'Images to PDF',
    description:
      'Combine multiple JPG, PNG, or WebP images into a single PDF document with page reordering, A4/Letter sizing, and zero uploads.',
  },
  'merge-split-pdf': {
    id: 'merge-split-pdf',
    path: '/merge-pdf',
    title: 'Merge & Split PDF Tool – LocalConvert',
    navLabel: 'Merge & Split PDF',
    description:
      'Combine multiple PDF files into one document or extract specific pages and page ranges locally inside your browser.',
  },
  'pdf-to-images': {
    id: 'pdf-to-images',
    path: '/pdf-to-images',
    title: 'PDF to Images Converter – LocalConvert',
    navLabel: 'PDF to Images',
    description:
      'Render PDF pages into crisp PNG or JPG images directly in your browser and download individually or as a ZIP archive.',
  },
  privacy: {
    id: 'privacy',
    path: '/privacy',
    title: 'Privacy Policy – LocalConvert',
    navLabel: 'Privacy Policy',
    description:
      'Learn how LocalConvert processes all images and PDFs 100% locally in your browser with zero file uploads, plus cookie and Google AdSense disclosures.',
  },
  terms: {
    id: 'terms',
    path: '/terms',
    title: 'Terms of Service – LocalConvert',
    navLabel: 'Terms of Service',
    description:
      'Review the terms of service for using LocalConvert client-side image and PDF privacy tools.',
  },
  about: {
    id: 'about',
    path: '/about',
    title: 'About LocalConvert – Client-Side Privacy Toolkit',
    navLabel: 'About',
    description:
      'Discover why LocalConvert was built to process images, PDFs, and QR codes entirely inside your browser without remote servers.',
  },
};

const ROUTE_ALIASES: Record<string, RouteId> = {
  '/compress': 'compress',
  '/merge-split-pdf': 'merge-split-pdf',
};

export function resolveRouteFromPath(pathname: string): RouteId {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (ROUTE_ALIASES[normalized]) {
    return ROUTE_ALIASES[normalized];
  }
  const match = Object.values(ROUTES).find((route) => route.path === normalized);
  return match ? match.id : 'home';
}
