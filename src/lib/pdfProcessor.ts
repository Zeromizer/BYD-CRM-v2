/**
 * Shared PDF processing utilities using PDF.js
 * Used by intelligentOcrService, salesPackService, DocumentThumbnail, PdfViewer
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Initialize PDF.js worker once
let workerInitialized = false;

/**
 * Initialize PDF.js worker (idempotent)
 */
export function initPdfWorker(): void {
  if (workerInitialized) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  workerInitialized = true;
}

// Auto-initialize on module load
initPdfWorker();

/**
 * Load a PDF document from a File object
 */
export async function loadPdfFromFile(file: File): Promise<PDFDocumentProxy> {
  const arrayBuffer = await file.arrayBuffer();
  return pdfjsLib.getDocument({ data: arrayBuffer }).promise;
}

/**
 * Load a PDF document from a base64 data URL
 */
export async function loadPdfFromBase64(dataUrl: string): Promise<PDFDocumentProxy> {
  // Extract base64 content from data URL
  const base64Content = dataUrl.split(',')[1];
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return pdfjsLib.getDocument({ data: bytes }).promise;
}

/**
 * Load a PDF document from a URL
 */
export async function loadPdfFromUrl(url: string): Promise<PDFDocumentProxy> {
  return pdfjsLib.getDocument(url).promise;
}

/**
 * Render a PDF page to a canvas element
 * @param pdf - The PDF document
 * @param pageNum - Page number (1-indexed)
 * @param scale - Render scale (default: 2 for retina)
 * @returns The rendered canvas element
 */
export async function renderPdfPageToCanvas(
  pdf: PDFDocumentProxy,
  pageNum: number,
  scale = 2
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Failed to get canvas context');

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // White background for better OCR/viewing
  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport: viewport,
    canvas: canvas,
  }).promise;

  return canvas;
}

/**
 * Convert a PDF page to a base64 image data URL
 * @param pdf - The PDF document
 * @param pageNum - Page number (1-indexed)
 * @param options - Rendering options
 * @returns Base64 data URL of the rendered page
 */
export async function pdfPageToImage(
  pdf: PDFDocumentProxy,
  pageNum: number,
  options: {
    scale?: number;
    format?: 'image/png' | 'image/jpeg';
    quality?: number;
  } = {}
): Promise<string> {
  const { scale = 2, format = 'image/png', quality = 0.92 } = options;

  const canvas = await renderPdfPageToCanvas(pdf, pageNum, scale);
  return canvas.toDataURL(format, quality);
}

/**
 * Extract text content from a PDF page
 * @param page - The PDF page
 * @returns Extracted text from the page
 */
export async function extractTextFromPage(page: PDFPageProxy): Promise<string> {
  const textContent = await page.getTextContent();
  return textContent.items
    .map((item) => ('str' in item ? item.str : ''))
    .join(' ');
}

/**
 * Extract text from all pages of a PDF
 * @param pdf - The PDF document
 * @returns Array of text strings, one per page
 */
export async function extractAllPdfText(pdf: PDFDocumentProxy): Promise<string[]> {
  const pageTexts: string[] = [];
  const numPages = pdf.numPages;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const text = await extractTextFromPage(page);
    pageTexts.push(text);
  }

  return pageTexts;
}

/**
 * Check if a page is blank (minimal text content)
 * @param pageText - The text content of the page
 * @param threshold - Minimum characters to consider non-blank (default: 20)
 */
export function isPageBlank(pageText: string, threshold = 20): boolean {
  const trimmed = pageText.trim();
  return trimmed.length < threshold || trimmed === '[BLANK]';
}

/**
 * Generate a thumbnail image from the first page of a PDF
 * @param pdf - The PDF document
 * @param maxWidth - Maximum thumbnail width
 * @returns Base64 data URL of the thumbnail
 */
export async function generatePdfThumbnail(
  pdf: PDFDocumentProxy,
  maxWidth = 200
): Promise<string> {
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });

  // Calculate scale to fit within maxWidth while maintaining aspect ratio
  const scale = maxWidth / viewport.width;
  const scaledViewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Failed to get canvas context');

  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport: scaledViewport,
    canvas: canvas,
  }).promise;

  return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Get PDF metadata
 */
export async function getPdfMetadata(pdf: PDFDocumentProxy): Promise<{
  numPages: number;
  title?: string;
  author?: string;
}> {
  const metadata = await pdf.getMetadata();
  return {
    numPages: pdf.numPages,
    title: (metadata.info as Record<string, string>)?.Title,
    author: (metadata.info as Record<string, string>)?.Author,
  };
}

// Re-export PDF.js types for consumers
export type { PDFDocumentProxy, PDFPageProxy };
export { pdfjsLib };
