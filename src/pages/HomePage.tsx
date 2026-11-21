import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  ChevronRight,
  Database,
  Plus,
  Sparkles,
} from 'lucide-react';
import {AccountSheet} from '../components/AccountSheet';
import {AppLogo} from '../components/AppLogo';
import {MobileShell} from '../components/MobileShell';
import {SpaceFormSheet} from '../components/SpaceFormSheet';
import {useAuth} from '../context/AuthContext';
import {useInventory} from '../context/InventoryContext';
import {useToast} from '../context/ToastContext';
import {formatMovementDateEsCo, getFirstName} from '../lib/inventoryAnalytics';

export const HomePage: React.FC = () => {
  const {profile} = useAuth();
  const {
    spaces,
    products,
    movements,
    totalUnits,
    alerts,
    homeRecommendation,
    loadingData,
    seedDemoData,
  } = useInventory();
  const {showToast} = useToast();
  const navigate = useNavigate();

  const [newSpaceOpen, setNewSpaceOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const firstName = getFirstName(profile?.fullName);
  const initial = firstName.charAt(0).toUpperCase() || 'A';
  const recentMovements = movements.slice(0, 3);
  const isEmpty = !loadingData && spaces.length === 0 && products.length === 0;

  const handleLoadDemo = async () => {
    setSeeding(true);
    try {
      await seedDemoData();
      showToast('Datos de ejemplo cargados en tu inventario.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudieron cargar los datos.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <MobileShell>
      <div className="px-4 pt-[calc(18px+env(safe-area-inset-top,0px))] pb-6">
        {/* Encabezado */}
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-extrabold tracking-tight text-[#071C2D]">
              Hola, {firstName}
            </h1>
            <p className="truncate text-xs font-medium text-[#5C7B98]">
              {profile?.businessName || 'Mi tienda de ropa'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Abrir mi cuenta"
            onClick={() => setAccountOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1F69FC] text-base font-bold text-white shadow-sm active:scale-95 transition-transform"
          >
            {initial}
          </button>
        </header>

        {/* Estado vacío (Idea SIT 1: Sustracción) */}
        {isEmpty ? (
          <div className="mt-5 rounded-[20px] border border-slate-200 bg-white p-5 text-center card-shadow">
            <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#EDF0F5]">
              <AppLogo size={64} />
            </div>
            <h2 className="text-lg font-extrabold text-[#071C2D]">Empieza tu inventario</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#5C7B98]">
              No necesitas cargar un catálogo completo. Escanea tu primera prenda o prueba con datos
              de ejemplo.
            </p>
            <div className="mt-5 space-y-2.5">
              <button
                type="button"
                onClick={() => navigate('/escanear')}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#EF8D2A] px-4 text-sm font-bold text-white shadow-sm active:scale-[0.99]"
              >
                <Camera className="h-5 w-5" />
                Escanear mi primera prenda
              </button>
              <button
                type="button"
                disabled={seeding}
                onClick={handleLoadDemo}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#1F69FC]/30 bg-[#E6EEFF] px-4 text-sm font-bold text-[#1F69FC] active:scale-[0.99] disabled:opacity-60"
              >
                <Database className="h-4 w-4" />
                {seeding ? 'Cargando ejemplo...' : 'Cargar datos de ejemplo'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Banner stock bajo */}
            {alerts.length > 0 && (
              <button
                type="button"
                onClick={() => navigate('/alertas')}
                className="mt-4 flex w-full items-center justify-between gap-3 rounded-[16px] border border-[#EF8D2A]/25 bg-[#FFF1E0] px-4 py-3 text-left active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-[#EF8D2A]">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#9A3412] tabular-nums">
                      {alerts.length}{' '}
                      {alerts.length === 1
                        ? 'producto con stock bajo'
                        : 'productos con stock bajo'}
                    </p>
                    <p className="text-xs font-medium text-[#C2410C]">Toca para ver qué reponer</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-[#EF8D2A]" />
              </button>
            )}

            {/* 3 métricas */}
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <div className="rounded-[16px] border border-slate-200/80 bg-white p-3.5 text-center card-shadow">
                <p className="text-2xl font-extrabold text-[#1F69FC] tabular-nums">
                  {loadingData ? '—' : totalUnits}
                </p>
                <p className="mt-0.5 text-xs font-medium text-[#5C7B98]">Prendas</p>
              </div>
              <div className="rounded-[16px] border border-slate-200/80 bg-white p-3.5 text-center card-shadow">
                <p className="text-2xl font-extrabold text-[#071C2D] tabular-nums">
                  {loadingData ? '—' : spaces.length}
                </p>
                <p className="mt-0.5 text-xs font-medium text-[#5C7B98]">Espacios</p>
              </div>
              <div className="rounded-[16px] border border-slate-200/80 bg-white p-3.5 text-center card-shadow">
                <p className="text-2xl font-extrabold text-[#EF8D2A] tabular-nums">
                  {loadingData ? '—' : alerts.length}
                </p>
                <p className="mt-0.5 text-xs font-medium text-[#5C7B98]">Stock bajo</p>
              </div>
            </div>

            {/* 2 botones de acción */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/escanear')}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] bg-[#EF8D2A] px-3 text-sm font-bold text-white shadow-sm active:scale-[0.98]"
              >
                <Camera className="h-4 w-4" />
                Escanear prenda
              </button>
              <button
                type="button"
                onClick={() => setNewSpaceOpen(true)}
                className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-[14px] border border-slate-200 bg-white px-3 text-sm font-bold text-[#071C2D] card-shadow active:scale-[0.98]"
              >
                <Plus className="h-4 w-4 text-[#1F69FC]" />
                Nuevo espacio
              </button>
            </div>

            {/* Movimientos recientes */}
            <section className="mt-5">
              <h2 className="mb-2.5 text-sm font-bold text-[#071C2D]">Movimientos recientes</h2>
              {loadingData ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-14 animate-pulse rounded-[16px] bg-slate-200/70"
                    />
                  ))}
                </div>
              ) : recentMovements.length === 0 ? (
                <div className="rounded-[16px] border border-slate-200/80 bg-white p-4 text-center text-xs text-[#5C7B98]">
                  Aún no hay entradas ni salidas registradas.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-[16px] border border-slate-200/80 bg-white px-3.5 card-shadow">
                  {recentMovements.map((mov) => {
                    const isEntry = mov.type === 'entrada';
                    return (
                      <div key={mov.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                              isEntry
                                ? 'bg-[#E3F7EC] text-[#24B570]'
                                : 'bg-red-50 text-red-500'
                            }`}
                          >
                            {isEntry ? (
                              <ArrowDownLeft className="h-4 w-4" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#071C2D]">
                              {mov.productName}
                            </p>
                            <p className="text-xs text-[#5C7B98]">
                              {isEntry ? 'Entrada' : 'Salida'} ·{' '}
                              {formatMovementDateEsCo(mov.occurredAt)}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 text-sm font-bold tabular-nums ${
                            isEntry ? 'text-[#24B570]' : 'text-red-500'
                          }`}
                        >
                          {isEntry ? `+${mov.quantity}` : `−${mov.quantity}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Tarjeta navy Recomendación de la IA */}
            <section className="mt-5 rounded-[18px] bg-[#0A1F32] p-4 text-white shadow-md">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F6BE57]">
                <Sparkles className="h-4 w-4" />
                <span>Recomendación de la IA</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                {homeRecommendation.text}
              </p>
              <button
                type="button"
                onClick={() => navigate('/asistente?auto=1')}
                className="mt-3.5 inline-flex min-h-[42px] items-center justify-center rounded-[12px] bg-[#1F69FC] px-4 text-xs font-bold text-white active:scale-[0.98]"
              >
                Ver sugerencia
              </button>
            </section>
          </>
        )}
      </div>

      <SpaceFormSheet open={newSpaceOpen} onClose={() => setNewSpaceOpen(false)} />
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
    </MobileShell>
  );
};
