import React, {createContext, useCallback, useContext, useState} from 'react';
import {AlertCircle, CheckCircle2, Info} from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [
      ...prev.filter((t) => t.message !== message).slice(-1),
      {id, message, tone},
    ]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  return (
    <ToastContext.Provider value={{showToast}}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-4 left-1/2 z-[90] flex w-[calc(100%-2rem)] max-w-[390px] -translate-x-1/2 flex-col gap-2 safe-top"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
              toast.tone === 'success'
                ? 'bg-[#0A1F32] text-white'
                : toast.tone === 'error'
                  ? 'bg-[#DC2626] text-white'
                  : 'bg-white text-[#071C2D] border border-slate-200'
            }`}
          >
            {toast.tone === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#24B570]" />}
            {toast.tone === 'error' && <AlertCircle className="h-4 w-4 shrink-0 text-white" />}
            {toast.tone === 'info' && <Info className="h-4 w-4 shrink-0 text-[#1F69FC]" />}
            <span className="leading-snug">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast debe usarse dentro de ToastProvider');
  }
  return ctx;
}
