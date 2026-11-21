function loadImageElement(file: Blob): Promise<HTMLImageElement> {
  const bitmapUrl = URL.createObjectURL(file);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(bitmapUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(bitmapUrl);
      reject(new Error('No se pudo leer la imagen.'));
    };
    image.src = bitmapUrl;
  });
}

export async function compressImageFile(
  file: Blob,
  maxDimension: number = 1024,
  quality: number = 0.7,
): Promise<{dataUrl: string; base64: string; mimeType: string}> {
  let source: CanvasImageSource;
  let width = 0;
  let height = 0;
  let bitmap: ImageBitmap | null = null;

  if (typeof createImageBitmap === 'function') {
    try {
      bitmap = await createImageBitmap(file);
      source = bitmap;
      width = bitmap.width;
      height = bitmap.height;
    } catch {
      bitmap = null;
      const img = await loadImageElement(file);
      source = img;
      width = img.width;
      height = img.height;
    }
  } else {
    const img = await loadImageElement(file);
    source = img;
    width = img.width;
    height = img.height;
  }

  try {
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo procesar el lienzo de la imagen.');
    }
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = dataUrl.replace(/^data:[^;]+;base64,/i, '');
    return {dataUrl, base64, mimeType: 'image/jpeg'};
  } finally {
    bitmap?.close();
  }
}

export function captureVideoFrame(
  video: HTMLVideoElement,
  maxDimension: number = 1024,
  quality: number = 0.7,
): {dataUrl: string; base64: string; mimeType: string; isDark: boolean} {
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
  const base64 = dataUrl.replace(/^data:[^;]+;base64,/i, '');
  return {dataUrl, base64, mimeType: 'image/jpeg', isDark};
}
