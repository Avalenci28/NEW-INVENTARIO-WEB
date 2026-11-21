import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {
  Barcode,
  Camera,
  Image as ImageIcon,
  Keyboard,
  Loader2,
  Sparkles,
  X,
  Zap,
  ZapOff,
} from 'lucide-react';
import {MobileShell} from '../components/MobileShell';
import {ProductDetailSheet} from '../components/ProductDetailSheet';
import {useAuth} from '../context/AuthContext';
import {useInventory} from '../context/InventoryContext';
import {useToast} from '../context/ToastContext';
import {captureVideoFrame, compressImageFile} from '../lib/imageUtils';
import type {GarmentCategory, Product} from '../types/inventory';

interface RecognizedResult {
  name: string;
  category: GarmentCategory;
  color: string;
  confidence: number;
  imageUrl: string;
}

export const ScanPage: React.FC = () => {
  const {user} = useAuth();
  const {products} = useInventory();
  const {showToast} = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<'garment' | 'barcode'>(
    searchParams.get('mode') === 'barcode' ? 'barcode' : 'garment',
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [detected, setDetected] = useState<RecognizedResult | null>(null);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [manualBarcodeOpen, setManualBarcodeOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setCameraReady(false);
    setTorchSupported(false);
    setTorchOn(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Tu navegador no permite acceso directo a la cámara aquí. Usa "Elegir foto" abajo.',
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {facingMode: {ideal: 'environment'}},
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
          setCameraReady(true);
          setCameraError(null);

          const track = stream.getVideoTracks()[0];
          const caps = track?.getCapabilities?.() as {torch?: boolean} | undefined;
          if (caps && caps.torch) {
            setTorchSupported(true);
          }
        }
      } catch {
        setCameraError(
          'No pudimos abrir la cámara (permiso denegado o sin cámara). Selecciona una foto de tu galería.',
        );
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stopCamera]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchSupported) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({advanced: [{torch: next} as MediaTrackConstraintSet]});
      setTorchOn(next);
    } catch {
      showToast('No fue posible cambiar el flash en este dispositivo.', 'info');
    }
  };

  const handleBarcodeFound = useCallback(
    (code: string) => {
      const clean = code.trim();
      if (!clean) return;
      const existing = products.find((p) => p.barcode && p.barcode === clean);
      if (existing) {
        showToast(`Código encontrado: ${existing.name}`);
        setMatchedProduct(existing);
      } else {
        stopCamera();
        navigate(`/prendas/nueva?barcode=${encodeURIComponent(clean)}`);
      }
    },
    [products, showToast, stopCamera, navigate],
  );

  // Escaneo continuo de código de barras en modo barcode
  useEffect(() => {
    if (mode !== 'barcode' || !cameraReady || matchedProduct) return;
    const video = videoRef.current;
    if (!video) return;

    let active = true;
    let rafId = 0;

    type NativeBarcodeDetector = {
      detect: (source: HTMLVideoElement) => Promise<Array<{rawValue?: string}>>;
    };
    const BarcodeDetectorCtor = (
      window as unknown as {
        BarcodeDetector?: new (opts: {formats: string[]}) => NativeBarcodeDetector;
      }
    ).BarcodeDetector;

    if (BarcodeDetectorCtor) {
      const detector = new BarcodeDetectorCtor({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
      });
      const scanLoop = async () => {
        if (!active || !videoRef.current) return;
        try {
          if (videoRef.current.readyState >= 2) {
            const found = await detector.detect(videoRef.current);
            if (found.length > 0 && found[0].rawValue) {
              handleBarcodeFound(found[0].rawValue);
              return;
            }
          }
        } catch {
          // Ignorar frame inválido
        }
        if (active) {
          rafId = window.requestAnimationFrame(() => {
            window.setTimeout(() => void scanLoop(), 280);
          });
        }
      };
      void scanLoop();
      return () => {
        active = false;
        window.cancelAnimationFrame(rafId);
      };
    }

    // Respaldo con @zxing/browser para iOS Safari
    let controls: {stop: () => void} | null = null;
    void (async () => {
      try {
        const {BrowserMultiFormatReader} = await import('@zxing/browser');
        if (!active || !videoRef.current) return;
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromVideoElement(videoRef.current, (result) => {
          if (!active) return;
          if (result) {
            handleBarcodeFound(result.getText());
          }
        });
      } catch {
        // Si falla ZXing, el usuario aún puede ingresar el código manualmente
      }
    })();

    return () => {
      active = false;
      controls?.stop();
    };
  }, [mode, cameraReady, matchedProduct, handleBarcodeFound]);

  const recognizeImage = async (dataUrl: string, mimeType: string) => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/recognize', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType,
          userId: user?.uid,
        }),
      });
      const data = (await res.json()) as {
        name?: string;
        category?: GarmentCategory;
        color?: string;
        confidence?: number;
        error?: string;
      };

      if (!res.ok || !data.name) {
        showToast(
          data.error || 'No se pudo reconocer automáticamente. Puedes escribir el nombre.',
          'info',
        );
        stopCamera();
        navigate('/prendas/nueva', {
          state: {imageUrl: dataUrl, aiRecognized: false},
        });
        return;
      }

      setDetected({
        name: data.name,
        category: data.category || 'otro',
        color: data.color || 'Neutro',
        confidence: data.confidence || 90,
        imageUrl: dataUrl,
      });
    } catch {
      showToast('Sin respuesta de la IA. Te llevamos al registro manual.', 'info');
      stopCamera();
      navigate('/prendas/nueva', {
        state: {imageUrl: dataUrl, aiRecognized: false},
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCapture = async () => {
    if (analyzing) return;
    if (mode === 'barcode') {
      setManualBarcodeOpen(true);
      return;
    }
    const video = videoRef.current;
    if (!video || !cameraReady) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const {dataUrl, mimeType} = captureVideoFrame(video, 640, 0.75);
      await recognizeImage(dataUrl, mimeType);
    } catch {
      showToast('No se pudo capturar la foto. Intenta desde la galería.', 'error');
    }
  };

  const handleGalleryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const {dataUrl, mimeType} = await compressImageFile(file, 640, 0.72);
      await recognizeImage(dataUrl, mimeType);
    } catch {
      showToast('No pudimos leer esa imagen.', 'error');
    }
  };

  const handleUseDetected = () => {
    if (!detected) return;
    stopCamera();
    navigate('/prendas/nueva', {
      state: {
        name: detected.name,
        category: detected.category,
        color: detected.color,
        imageUrl: detected.imageUrl,
        aiRecognized: true,
      },
    });
  };

  return (
    <MobileShell hideBottomNav darkBackground>
      <div className="relative flex h-full w-full flex-col justify-between bg-[#081523] text-white">
        {/* Video de cámara trasera */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Oscurecedor sutil */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />

        {/* Top bar */}
        <header className="relative z-10 flex items-center justify-between px-4 pt-[calc(14px+env(safe-area-inset-top,0px))]">
          <button
            type="button"
            aria-label="Cerrar escáner"
            onClick={() => {
              stopCamera();
              navigate(-1);
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm"
          >
            <X className="h-5 w-5" />
          </button>

          <h1 className="text-base font-bold text-white">
            {mode === 'garment' ? 'Escanear prenda' : 'Código de barras'}
          </h1>

          {torchSupported ? (
            <button
              type="button"
              aria-label="Alternar flash"
              onClick={toggleTorch}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm"
            >
              {torchOn ? <Zap className="h-5 w-5 text-[#F6BE57]" /> : <ZapOff className="h-5 w-5" />}
            </button>
          ) : (
            <div className="w-11" />
          )}
        </header>

        {/* Marco central con esquinas verdes */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
          {detected && mode === 'garment' && (
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#24B570] px-3.5 py-1 text-xs font-bold text-white shadow-lg">
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                {detected.name.split(' ')[0]} · {detected.confidence} %
              </span>
            </div>
          )}

          <div
            className={`relative flex items-center justify-center ${
              mode === 'garment' ? 'h-56 w-56' : 'h-40 w-64'
            }`}
          >
            {/* Esquinas verdes */}
            <span className="absolute top-0 left-0 h-8 w-8 rounded-tl-xl border-t-4 border-l-4 border-[#24B570]" />
            <span className="absolute top-0 right-0 h-8 w-8 rounded-tr-xl border-t-4 border-r-4 border-[#24B570]" />
            <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-[#24B570]" />
            <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-[#24B570]" />

            {analyzing && (
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-black/65 px-5 py-4 backdrop-blur-md">
                <Loader2 className="h-7 w-7 animate-spin text-[#24B570]" />
                <span className="text-xs font-semibold text-white">Analizando prenda con IA...</span>
              </div>
            )}

            {cameraError && !analyzing && (
              <div className="rounded-2xl bg-[#0A1F32]/90 p-4 text-center border border-white/15">
                <Camera className="mx-auto mb-2 h-6 w-6 text-[#EF8D2A]" />
                <p className="text-xs leading-relaxed text-slate-200">{cameraError}</p>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[40px] rounded-xl bg-[#1F69FC] px-3 text-xs font-bold text-white"
                  >
                    Elegir foto de galería
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      navigate('/prendas/nueva');
                    }}
                    className="min-h-[38px] rounded-xl border border-white/25 px-3 text-xs font-semibold text-white"
                  >
                    Registrar a mano
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel inferior + Controles */}
        <div className="relative z-10 px-4 pb-[calc(22px+env(safe-area-inset-bottom,0px))]">
          {detected && mode === 'garment' && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-[18px] bg-white p-4 text-[#071C2D] shadow-xl">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold tracking-wider text-[#24B570] uppercase">
                  La IA detectó
                </p>
                <p className="truncate text-base font-extrabold text-[#071C2D]">{detected.name}</p>
                <p className="text-xs text-[#5C7B98]">Confirma o toma otra foto</p>
              </div>
              <button
                type="button"
                onClick={handleUseDetected}
                className="min-h-[44px] shrink-0 rounded-[12px] bg-[#1F69FC] px-5 text-sm font-bold text-white shadow-sm active:scale-95"
              >
                Usar
              </button>
            </div>
          )}

          <p className="mb-4 text-center text-xs font-medium text-slate-300">
            {mode === 'garment'
              ? 'Mantén la prenda dentro del marco'
              : 'Apunta al código de barras o escríbelo'}
          </p>

          <div className="flex items-center justify-around">
            <button
              type="button"
              aria-label="Elegir de la galería"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm active:scale-95"
            >
              <ImageIcon className="h-5 w-5" />
            </button>

            <button
              type="button"
              aria-label={mode === 'garment' ? 'Tomar foto' : 'Ingresar código manual'}
              onClick={handleCapture}
              disabled={analyzing}
              className="flex h-[70px] w-[70px] items-center justify-center rounded-full border-4 border-white/40 bg-white text-[#0A1F32] shadow-xl active:scale-95 transition-transform disabled:opacity-60"
            >
              {mode === 'garment' ? (
                <div className="h-12 w-12 rounded-full border-2 border-[#0A1F32]/20 bg-white" />
              ) : (
                <Keyboard className="h-6 w-6 text-[#0A1F32]" />
              )}
            </button>

            <button
              type="button"
              aria-label="Cambiar a escáner de código de barras"
              onClick={() => {
                setDetected(null);
                setMode((m) => (m === 'garment' ? 'barcode' : 'garment'));
              }}
              className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-sm active:scale-95 ${
                mode === 'barcode' ? 'bg-[#EF8D2A] text-white' : 'bg-white/15 text-white'
              }`}
            >
              <Barcode className="h-5 w-5" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleGalleryFile}
            className="hidden"
          />
        </div>
      </div>

      {/* Entrada manual de código de barras */}
      {manualBarcodeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
          <div className="w-full max-w-[430px] rounded-t-[24px] bg-white p-5 pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#071C2D]">Código de barras</h2>
              <button
                type="button"
                onClick={() => setManualBarcodeOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#5C7B98]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setManualBarcodeOpen(false);
                handleBarcodeFound(manualBarcode);
              }}
              className="space-y-3"
            >
              <input
                type="text"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder="Ej. 770100100102"
                className="min-h-[48px] w-full rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3.5 text-base text-[#071C2D]"
              />
              <button
                type="submit"
                className="min-h-[48px] w-full rounded-[14px] bg-[#1F69FC] text-sm font-bold text-white"
              >
                Buscar o registrar código
              </button>
            </form>
          </div>
        </div>
      )}

      <ProductDetailSheet
        product={matchedProduct}
        onClose={() => setMatchedProduct(null)}
      />
    </MobileShell>
  );
};
