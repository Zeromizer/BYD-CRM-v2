/**
 * File sharing utility with Web Share API support
 * Falls back to standard download on unsupported platforms
 */

export interface ShareFileOptions {
  blob: Blob
  fileName: string
  mimeType: string
  title?: string
}

export const MIME_TYPES = {
  PDF: 'application/pdf',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const

/**
 * Check if Web Share API with file sharing is supported
 */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
    return false
  }

  // Test with a dummy file to verify file sharing support
  const testFile = new File([''], 'test.txt', { type: 'text/plain' })
  return navigator.canShare({ files: [testFile] })
}

/**
 * Share or download a file based on platform capabilities
 * Returns true if shared, false if downloaded (fallback)
 */
export async function shareOrDownloadFile(options: ShareFileOptions): Promise<boolean> {
  const { blob, fileName, mimeType, title } = options

  // Create File object for sharing
  const file = new File([blob], fileName, { type: mimeType })

  // Attempt Web Share if supported
  if (canShareFiles() && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: title ?? fileName,
      })
      return true
    } catch (error) {
      // User cancelled or share failed - fall back to download
      if ((error as Error).name !== 'AbortError') {
        console.warn('Web Share failed, falling back to download:', error)
      }
    }
  }

  // Fallback: standard download
  downloadFile(blob, fileName)
  return false
}

/**
 * Standard browser file download
 */
export function downloadFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
