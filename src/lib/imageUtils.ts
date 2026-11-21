export async function compressImageFile(
  file: Blob,
  maxDimension: number = 640,
  quality: number = 0.72,
): Promise<{dataUrl: string; mimeType: string}> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      image.src = bitmapUrl;
    });

    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const targetWidth = Math.max(1, Math.round(img.width * scale));
    const targetHeight = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo procesar el lienzo de la imagen.');
    }
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return {dataUrl, mimeType: 'image/jpeg'};
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

export function captureVideoFrame(
  video: HTMLVideoElement,
  maxDimension: number = 640,
  quality: number = 0.75,
): {dataUrl: string; mimeType: string} {
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo capturar la imagen de la cámara.');
  }
  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return {dataUrl, mimeType: 'image/jpeg'};
}
