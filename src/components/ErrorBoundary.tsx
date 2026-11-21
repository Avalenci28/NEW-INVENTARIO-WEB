import React from 'react';
import {AlertTriangle, RefreshCw} from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{children: React.ReactNode}, State> {
  state: State = {hasError: false, message: ''};

  static getDerivedStateFromError(error: Error): State {
    let readable = 'Ocurrió un error inesperado al cargar la pantalla.';
    try {
      const parsed = JSON.parse(error.message) as {error?: string};
      if (parsed?.error) {
        readable = parsed.error.includes('Missing or insufficient permissions')
          ? 'No tienes permisos para acceder a estos datos. Verifica tu sesión.'
          : parsed.error;
      }
    } catch {
      if (error?.message) readable = error.message;
    }
    return {hasError: true, message: readable};
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#EDF0F5] p-6">
          <div className="w-full max-w-[380px] rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1E0] text-[#EF8D2A]">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-[#071C2D]">Algo salió mal</h2>
            <p className="mt-2 text-sm text-[#5C7B98]">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#1F69FC] px-4 text-sm font-semibold text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Recargar aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
