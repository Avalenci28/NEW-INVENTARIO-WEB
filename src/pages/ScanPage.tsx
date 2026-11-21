import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {
  Barcode,
  Camera,
  Image as ImageIcon,
  Keyboard,
  Loader2,
  RefreshCw,
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
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [detected, setDetected] = useState<RecognizedResult | null>(null);
  const [noGarmentHint, setNoGarmentHint] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [lastCaptured, setLastCaptured] = useState<{dataUrl: string; mimeType: string} | null>(
    null,
  );
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [manualBarcodeOpen, setManualBarcodeOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoScanRanRef = useRef(false);

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
          video: {
            facingMode: {ideal: 'environment'},
            width: {ideal: 1280},
            height: {ideal: 720},
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.muted = true;
          video.playsInline = true;
          video.setAttribute('playsinline', '');
          video.setAttribute('muted', '');
          video.setAttribute('autoplay', '');
          video.srcObject = stream;
          const markReady = () => {
            if (cancelled) return;
            void video.play().catch(() => undefined);
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              setCameraReady(true);
              setCameraError(null);
            }
          };
          video.onloadedmetadata = markReady;
          video.oncanplay = markReady;
          await video.play().catch(() => undefined);
          if (video.readyState >= 2 && video.videoWidth > 0) {
            markReady();
          }

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

  const postRecognizeWithRetry = useCallback(
    async (
      dataUrl: string,
      mimeType: string,
    ): Promise<{
      ok: boolean;
      status?: number;
      error?: string;
      data?: {
        isGarment?: boolean;
        name?: string;
        category?: GarmentCategory;
        color?: string;
        confidence?: number;
        error?: string;
      };
    }> => {
      const payload = JSON.stringify({
        imageBase64: dataUrl,
        mimeType,
        userId: user?.uid,
      });

      let lastErr: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 20000);
        try {
          const res = await fetch('/api/recognize', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: payload,
            cache: 'no-store',
            credentials: 'same-origin',
            signal: controller.signal,
          });
          window.clearTimeout(timeoutId);

          const rawText = await res.text();
          let parsedData: {
            isGarment?: boolean;
            name?: string;
            category?: GarmentCategory;
            color?: string;
            confidence?: number;
            error?: string;
          } | null = null;

          if (rawText) {
            try {
              parsedData = JSON.parse(rawText) as NonNullable<typeof parsedData>;
            } catch {
              parsedData = null;
            }
          }

          if (!parsedData) {
            if ((res.status === 502 || res.status === 504) && attempt === 0) {
              await new Promise((r) => window.setTimeout(r, 400));
              continue;
            }
            if (res.status === 413) {
              return {
                ok: false,
                error: 'La foto es muy pesada. Acércate un poco más o intenta con otra foto.',
              };
            }
            if (res.status === 401 || res.status === 403 || res.redirected) {
              return {
                ok: false,
                error: 'Tu sesión expiró. Recarga la página o vuelve a iniciar sesión.',
              };
            }
            return {
              ok: false,
              error: 'El servidor de IA tardó en responder. Toca "Reintentar con IA".',
            };
          }

          return {ok: res.ok, status: res.status, data: parsedData};
        } catch (err) {
          window.clearTimeout(timeoutId);
          lastErr = err;
          if (attempt === 0) {
            await new Promise((r) => window.setTimeout(r, 350));
            continue;
          }
        }
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return {
          ok: false,
          error: 'Sin conexión a internet. Verifica tu Wi-Fi o datos móviles e intenta de nuevo.',
        };
      }
      if (lastErr instanceof Error && lastErr.name === 'AbortError') {
        return {
          ok: false,
          error: 'El análisis tardó demasiado. Toca "Reintentar con IA" o elige una foto más nítida.',
        };
      }
      return {
        ok: false,
        error: 'No pudimos conectar con el servicio de IA. Toca "Reintentar con IA" o registra a mano.',
      };
    },
    [user?.uid],
  );

  const recognizeImage = useCallback(
    async (dataUrl: string, mimeType: string, isAuto: boolean = false) => {
      setAnalyzing(true);
      setAiError(null);
      setNoGarmentHint(false);
      setLastCaptured({dataUrl, mimeType});

      try {
        const result = await postRecognizeWithRetry(dataUrl, mimeType);
        const data = result.data;

        if (!result.ok || !data || !data.name) {
          const msg =
            data?.error ||
            result.error ||
            'No pudimos reconocer la prenda en este momento. Intenta tomar otra foto.';
          setAiError(msg);
          if (!isAuto) {
            showToast(msg, 'error');
          }
          return;
        }

        if (data.isGarment === false) {
          setDetected(null);
          setNoGarmentHint(true);
          if (!isAuto) {
            showToast('No distinguimos una prenda clara. Acércala al marco e intenta de nuevo.', 'info');
          }
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
        const msg = 'No pudimos conectar con el servicio de IA. Toca "Reintentar con IA".';
        setAiError(msg);
        if (!isAuto) {
          showToast(msg, 'error');
        }
      } finally {
        setAnalyzing(false);
      }
    },
    [postRecognizeWithRetry, showToast],
  );

  // Reconocimiento automático inicial cuando la cámara enfoca una prenda
  useEffect(() => {
    if (
      mode !== 'garment' ||
      !cameraReady ||
      !autoScanEnabled ||
      autoScanRanRef.current ||
      analyzing ||
      detected
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      const video = videoRef.current;
      if (!video || autoScanRanRef.current) return;
      try {
        const {dataUrl, mimeType, isDark} = captureVideoFrame(video, 512, 0.7);
        if (isDark) {
          // Si el sensor de iPhone aún estaba oscuro al iniciar, no gastar petición
          return;
        }
        autoScanRanRef.current = true;
        void recognizeImage(dataUrl, mimeType, true);
      } catch {
        // Si el primer frame aún no estaba listo, el usuario puede tocar el botón
      }
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [mode, cameraReady, autoScanEnabled, analyzing, detected, recognizeImage]);

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
      setDetected(null);
      const {dataUrl, mimeType} = captureVideoFrame(video, 512, 0.7);
      await recognizeImage(dataUrl, mimeType, false);
    } catch {
      showToast('No se pudo capturar la foto. Intenta desde la galería.', 'error');
    }
  };

  const handleGalleryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setDetected(null);
      const {dataUrl, mimeType} = await compressImageFile(file, 512, 0.7);
      await recognizeImage(dataUrl, mimeType, false);
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

  const handleManualFallback = () => {
    stopCamera();
    navigate('/prendas/nueva', {
      state: {
        imageUrl: lastCaptured?.dataUrl || '',
        aiRecognized: false,
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

          <div className="flex flex-col items-center">
            <h1 className="text-base font-bold text-white">
              {mode === 'garment' ? 'Escanear prenda' : 'Código de barras'}
            </h1>
            {mode === 'garment' && cameraReady && (
              <button
                type="button"
                onClick={() => setAutoScanEnabled((v) => !v)}
                className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  autoScanEnabled
                    ? 'bg-[#24B570]/90 text-white'
                    : 'bg-black/45 text-slate-300'
                }`}
              >
                <Sparkles className="h-2.5 w-2.5" />
                {autoScanEnabled ? 'IA automática activa' : 'IA manual'}
              </button>
            )}
          </div>

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

          {noGarmentHint && !detected && !analyzing && mode === 'garment' && (
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#0A1F32]/90 px-3.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20">
              <Sparkles className="h-3.5 w-3.5 text-[#EF8D2A]" />
              <span>Enfoca la prenda en el marco y toca el botón</span>
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
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-black/70 px-5 py-4 backdrop-blur-md">
                <Loader2 className="h-7 w-7 animate-spin text-[#24B570]" />
                <span className="text-xs font-semibold text-white">
                  Identificando prenda con IA...
                </span>
              </div>
            )}

            {cameraError && !analyzing && (
              <div className="rounded-2xl border border-white/15 bg-[#0A1F32]/90 p-4 text-center">
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
                    onClick={handleManualFallback}
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
          {aiError && !analyzing && mode === 'garment' && (
            <div className="mb-4 rounded-[18px] border border-[#EF8D2A]/40 bg-[#0A1F32]/95 p-4 text-white shadow-xl backdrop-blur-md">
              <p className="text-xs font-semibold leading-relaxed text-amber-200">{aiError}</p>
              <div className="mt-3 flex gap-2">
                {lastCaptured && (
                  <button
                    type="button"
                    onClick={() => void recognizeImage(lastCaptured.dataUrl, lastCaptured.mimeType)}
                    className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-[#1F69FC] px-3 text-xs font-bold text-white"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reintentar con IA
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleManualFallback}
                  className="min-h-[42px] flex-1 rounded-[12px] border border-white/25 px-3 text-xs font-semibold text-white"
                >
                  Registrar a mano
                </button>
              </div>
            </div>
          )}

          {detected && mode === 'garment' && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-[18px] bg-white p-4 text-[#071C2D] shadow-xl">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold tracking-wider text-[#24B570] uppercase">
                  La IA detectó
                </p>
                <p className="truncate text-base font-extrabold text-[#071C2D]">{detected.name}</p>
                <p className="text-xs capitalize text-[#5C7B98]">
                  {detected.category} · {detected.color}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDetected(null);
                    setAiError(null);
                  }}
                  className="min-h-[44px] rounded-[12px] border border-slate-200 px-3 text-xs font-bold text-[#5C7B98] active:scale-95"
                >
                  Otra
                </button>
                <button
                  type="button"
                  onClick={handleUseDetected}
                  className="min-h-[44px] rounded-[12px] bg-[#1F69FC] px-5 text-sm font-bold text-white shadow-sm active:scale-95"
                >
                  Usar
                </button>
              </div>
            </div>
          )}

          <p className="mb-4 text-center text-xs font-medium text-slate-300">
            {mode === 'garment'
              ? 'Mantén la prenda dentro del marco y toca para escanear'
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
              aria-label={mode === 'garment' ? 'Escanear prenda con IA' : 'Ingresar código manual'}
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
                setAiError(null);
                setNoGarmentHint(false);
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
