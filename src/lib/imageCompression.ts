/**
 * High-performance browser-side image compression utility for profile photos, recipe images, and inventory items.
 * Handles high-resolution mobile photos, EXIF orientation, and automatically transcodes HEIC/HEIF photos
 * using native browser capabilities, client-side fallback, and server-assisted conversion.
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
 */
async function convertHeicToJpegClient(blob: Blob): Promise<Blob> {
  const { default: heic2any } = await import('heic2any');
  const result = await heic2any({
    blob,
    toType: 'image/jpeg',
    quality: 0.9,
  });
  return Array.isArray(result) ? result[0] : result;
}

/**
 * Server-assisted image conversion and optimization fallback.
 * Uses Node.js heic-convert and sharp for bulletproof conversion of modern iOS HEIC/HEIF photos.
 */
async function convertViaServer(
  fileOrBlob: File | Blob,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<CompressedImageResult> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(fileOrBlob);
  });

  const res = await fetch('/api/convert-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: base64,
      maxWidth,
      maxHeight,
      quality: Math.round(quality <= 1 ? quality * 100 : quality),
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Image conversion failed');
  }

  const result = await res.json();
  return {
    dataUrl: result.dataUrl,
    base64: result.base64,
    mimeType: result.mimeType || 'image/jpeg',
    width: maxWidth,
    height: maxHeight,
  };
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

  // 1. If explicit HEIC/HEIF detected, attempt client-side transcode or fall through to server
  if (isHeicImage(currentBlob)) {
    try {
      currentBlob = await convertHeicToJpegClient(currentBlob);
    } catch (clientHeicErr) {
      console.warn('Client-side heic2any failed; delegating to server conversion:', clientHeicErr);
      try {
        return await convertViaServer(file, maxWidth, maxHeight, quality);
      } catch (serverErr) {
        console.error('Server conversion also failed:', serverErr);
        throw new Error('Unable to process HEIC photo. Please try a JPG or PNG.');
      }
    }
  }

  // 2. Render to canvas
  try {
    const canvas = await renderBlobToCanvas(currentBlob, maxWidth, maxHeight);
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
  } catch (primaryErr) {
    // 3. Fallback: If client decoding failed, delegate to server conversion
    try {
      console.info('Client-side canvas render failed; attempting server conversion...');
      return await convertViaServer(file, maxWidth, maxHeight, quality);
    } catch (serverErr) {
      console.error('All image decoding strategies failed:', primaryErr, serverErr);
      throw new Error('Could not process this image. Please select a JPG or PNG photo.');
    }
  }
}
