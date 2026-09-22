/**
 * High-performance browser-side image compression utility for profile photos, recipe images, and inventory items.
 * Handles high-resolution mobile photos, EXIF orientation, and automatically transcodes HEIC/HEIF photos (standard on iOS/iPhones).
 */

export interface CompressedImageResult {
  dataUrl: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}

export interface ImageCompressionOptions {
  maxDimension?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Checks if a file or blob is an HEIC/HEIF image based on MIME type or filename.
 */
function isHeicImage(file: File | Blob): boolean {
  const type = (file.type || '').toLowerCase();
  if (
    type === 'image/heic' ||
    type === 'image/heif' ||
    type === 'image/heic-sequence' ||
    type === 'image/heif-sequence'
  ) {
    return true;
  }
  if ('name' in file && typeof (file as File).name === 'string') {
    const name = (file as File).name.toLowerCase();
    if (name.endsWith('.heic') || name.endsWith('.heif')) {
      return true;
    }
  }
  return false;
}

/**
 * Transcodes an HEIC/HEIF blob to a standard JPEG blob via dynamic import of heic2any.
 * Dynamic import ensures the ~600KB parser is only loaded when an HEIC image is actually processed.
 */
async function convertHeicToJpeg(blob: Blob): Promise<Blob> {
  const { default: heic2any } = await import('heic2any');
  const result = await heic2any({
    blob,
    toType: 'image/jpeg',
    quality: 0.9,
  });
  return Array.isArray(result) ? result[0] : result;
}

/**
 * Renders an image blob to an HTMLCanvasElement scaled within maxWidth x maxHeight.
 * Uses hardware-accelerated createImageBitmap with EXIF auto-orientation first,
 * falling back to HTMLImageElement with URL.createObjectURL.
 */
async function renderBlobToCanvas(
  blob: Blob,
  maxWidth: number,
  maxHeight: number
): Promise<HTMLCanvasElement> {
  // Strategy 1: Modern hardware-accelerated createImageBitmap (async, auto-rotates EXIF)
  if (typeof createImageBitmap === 'function') {
    try {
      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' as any });
      } catch {
        bitmap = await createImageBitmap(blob);
      }

      let { width, height } = bitmap;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
        return canvas;
      }
      bitmap.close();
    } catch (bitmapErr) {
      console.warn('createImageBitmap attempt failed, attempting HTMLImageElement fallback:', bitmapErr);
    }
  }

  // Strategy 2: Fallback to HTMLImageElement with URL.createObjectURL (low memory overhead)
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get 2D canvas context'));
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('HTMLImageElement failed to decode image'));
    };

    img.src = objectUrl;
  });
}

export async function compressImageFile(
  file: File | Blob,
  optionsOrMaxDimension: number | ImageCompressionOptions = 1280,
  qualityParam = 0.82
): Promise<CompressedImageResult> {
  const maxWidth =
    typeof optionsOrMaxDimension === 'number'
      ? optionsOrMaxDimension
      : optionsOrMaxDimension.maxWidth || optionsOrMaxDimension.maxDimension || 1280;
  const maxHeight =
    typeof optionsOrMaxDimension === 'number'
      ? optionsOrMaxDimension
      : optionsOrMaxDimension.maxHeight || optionsOrMaxDimension.maxDimension || maxWidth;
  const quality =
    typeof optionsOrMaxDimension === 'object' && optionsOrMaxDimension.quality !== undefined
      ? optionsOrMaxDimension.quality
      : qualityParam;

  let currentBlob: Blob = file;

  // 1. If explicit HEIC/HEIF detected, transcode upfront
  if (isHeicImage(currentBlob)) {
    try {
      currentBlob = await convertHeicToJpeg(currentBlob);
    } catch (err: any) {
      console.error('HEIC upfront conversion failed:', err);
      throw new Error('Unable to process HEIC photo. Please select a JPG or PNG.');
    }
  }

  let canvas: HTMLCanvasElement;
  try {
    canvas = await renderBlobToCanvas(currentBlob, maxWidth, maxHeight);
  } catch (primaryErr) {
    // 2. Fallback: If primary decoding failed, it may be an HEIC file whose MIME type
    // was not set by the browser (very common when picking photos from iOS files or cloud drives).
    try {
      console.info('Initial image decode failed; attempting HEIC transcode fallback...');
      const fallbackConverted = await convertHeicToJpeg(currentBlob);
      canvas = await renderBlobToCanvas(fallbackConverted, maxWidth, maxHeight);
    } catch {
      console.error('All image decoding strategies failed:', primaryErr);
      throw new Error('Could not process this image. Please ensure the file is an image (JPG, PNG, WebP, or HEIC).');
    }
  }

  // 3. Render out optimized JPEG data URL
  const mimeType = 'image/jpeg';
  const dataUrl = canvas.toDataURL(mimeType, quality);
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');

  return {
    dataUrl,
    base64,
    mimeType,
    width: canvas.width,
    height: canvas.height,
  };
}
