import React from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {Bell, Camera, Home, LayoutGrid, MessageSquare} from 'lucide-react';
import {useInventory} from '../context/InventoryContext';

interface MobileShellProps {
  children: React.ReactNode;
  hideBottomNav?: boolean;
  darkBackground?: boolean;
}

export const MobileShell: React.FC<MobileShellProps> = ({
  children,
  hideBottomNav = false,
  darkBackground = false,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {alerts} = useInventory();

  const isInicio = location.pathname === '/inicio';
  const isEspacios = location.pathname.startsWith('/espacios');
  const isAlertas = location.pathname === '/alertas';
  const isAsistente = location.pathname === '/asistente';

  return (
    <div className="min-h-[100dvh] w-full bg-[#EDF0F5] sm:flex sm:items-center sm:justify-center sm:p-4">
      <div
        className={`relative flex h-[100dvh] w-full flex-col overflow-hidden sm:h-[min(880px,94dvh)] sm:max-w-[430px] sm:rounded-[38px] sm:border sm:border-slate-300/80 sm:shadow-[0_24px_60px_rgba(10,31,50,0.16)] ${
          darkBackground ? 'bg-[#0A1F32]' : 'bg-[#F8FAFC]'
        }`}
      >
        <main
          className={`flex-1 overflow-y-auto no-scrollbar ${
            hideBottomNav ? '' : 'pb-[calc(86px+env(safe-area-inset-bottom,0px))]'
          }`}
        >
          {children}
        </main>

        {!hideBottomNav && (
          <nav
            aria-label="Navegación principal"
            className="absolute bottom-0 left-0 right-0 z-30 border-t border-slate-200/90 bg-white/95 backdrop-blur-md safe-bottom"
          >
            <div className="grid h-[68px] grid-cols-5 items-end px-1 pb-2">
              <button
                type="button"
                onClick={() => navigate('/inicio')}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 transition-colors ${
                  isInicio ? 'text-[#1F69FC]' : 'text-[#5C7B98] hover:text-[#071C2D]'
                }`}
              >
                <Home className="h-[22px] w-[22px]" strokeWidth={isInicio ? 2.4 : 1.9} />
                <span className={`text-[11px] leading-none ${isInicio ? 'font-bold' : 'font-medium'}`}>
                  Inicio
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/espacios')}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 transition-colors ${
                  isEspacios ? 'text-[#1F69FC]' : 'text-[#5C7B98] hover:text-[#071C2D]'
                }`}
              >
                <LayoutGrid className="h-[22px] w-[22px]" strokeWidth={isEspacios ? 2.4 : 1.9} />
                <span className={`text-[11px] leading-none ${isEspacios ? 'font-bold' : 'font-medium'}`}>
                  Espacios
                </span>
              </button>

              {/* Botón central elevado naranja */}
              <div className="flex flex-col items-center justify-end">
                <button
                  type="button"
                  aria-label="Escanear prenda"
                  onClick={() => navigate('/escanear')}
                  className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-[#EF8D2A] text-white shadow-[0_6px_18px_rgba(239,141,42,0.42)] active:scale-95 transition-transform"
                >
                  <Camera className="h-6 w-6" strokeWidth={2.2} />
                </button>
                <span className="mt-0.5 text-[11px] font-medium leading-none text-[#5C7B98]">
                  Escanear
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigate('/alertas')}
                className={`relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 transition-colors ${
                  isAlertas ? 'text-[#1F69FC]' : 'text-[#5C7B98] hover:text-[#071C2D]'
                }`}
              >
                <div className="relative">
                  <Bell className="h-[22px] w-[22px]" strokeWidth={isAlertas ? 2.4 : 1.9} />
                  {alerts.length > 0 && (
                    <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#EF8D2A] px-1 text-[10px] font-bold text-white tabular-nums">
                      {alerts.length > 99 ? '99+' : alerts.length}
                    </span>
                  )}
                </div>
                <span className={`text-[11px] leading-none ${isAlertas ? 'font-bold' : 'font-medium'}`}>
                  Alertas
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/asistente')}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 transition-colors ${
                  isAsistente ? 'text-[#1F69FC]' : 'text-[#5C7B98] hover:text-[#071C2D]'
                }`}
              >
                <MessageSquare className="h-[22px] w-[22px]" strokeWidth={isAsistente ? 2.4 : 1.9} />
                <span className={`text-[11px] leading-none ${isAsistente ? 'font-bold' : 'font-medium'}`}>
                  Asistente
                </span>
              </button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
};
