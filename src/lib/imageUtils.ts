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
  quality: number = 0.72,
): {dataUrl: string; mimeType: string; isDark: boolean} {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    throw new Error('La cámara aún está enfocando. Intenta de nuevo en un momento.');
  }

  const width = video.videoWidth;
  const height = video.videoHeight;
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

  let isDark = false;
  try {
    const sample = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
    let totalLum = 0;
    let count = 0;
    const step = Math.max(4, Math.floor(sample.length / 400)) * 4;
    for (let i = 0; i < sample.length; i += step) {
      totalLum += sample[i] + sample[i + 1] + sample[i + 2];
      count += 3;
    }
    isDark = count > 0 && totalLum / count < 6;
  } catch {
    isDark = false;
  }

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  if (!dataUrl.startsWith('data:image/') || dataUrl.length < 100) {
    throw new Error('La cámara aún está cargando la imagen.');
  }
  return {dataUrl, mimeType: 'image/jpeg', isDark};
}
