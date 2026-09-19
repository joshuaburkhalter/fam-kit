/**
 * High-performance browser-side image compression utility for recipe photos.
 * Scales large mobile camera photos down to a crisp, optimized resolution (max 1280px)
 * ensuring instant uploads and fast Gemini Vision parsing.
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

export async function compressImageFile(
  file: File,
  optionsOrMaxDimension: number | ImageCompressionOptions = 1280,
  qualityParam = 0.82
): Promise<CompressedImageResult> {
  const maxDimension = typeof optionsOrMaxDimension === 'number'
    ? optionsOrMaxDimension
    : (optionsOrMaxDimension.maxDimension || optionsOrMaxDimension.maxWidth || 1280);
  const quality = typeof optionsOrMaxDimension === 'object' && optionsOrMaxDimension.quality !== undefined
    ? optionsOrMaxDimension.quality
    : qualityParam;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context for image processing'));
        }

        // Clean rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Prefer webp if supported, otherwise standard jpeg
        const mimeType = file.type === 'image/png' ? 'image/jpeg' : (file.type || 'image/jpeg');
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');

        resolve({
          dataUrl,
          base64,
          mimeType,
          width,
          height,
        });
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
