import React, {useMemo, useState} from 'react';
import {Check, CheckCircle2, Filter, ShoppingBag} from 'lucide-react';
import {GarmentThumbnail} from '../components/GarmentThumbnail';
import {MobileShell} from '../components/MobileShell';
import {OrderDraftSheet} from '../components/OrderDraftSheet';
import {useInventory} from '../context/InventoryContext';
import {useToast} from '../context/ToastContext';
import type {AlertSeverity, LowStockAlertItem} from '../types/inventory';

type FilterMode = 'all' | AlertSeverity;

export const AlertsPage: React.FC = () => {
  const {products, alerts, activeDraftOrder, addAlertToDraftOrder} = useInventory();
  const {showToast} = useToast();

  const [filterOpen, setFilterOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [expanded, setExpanded] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);

  const filteredAlerts = useMemo(() => {
    if (filterMode === 'all') return alerts;
    return alerts.filter((a) => a.severity === filterMode);
  }, [alerts, filterMode]);

  const visibleAlerts = expanded ? filteredAlerts : filteredAlerts.slice(0, 3);
  const hiddenCount = Math.max(0, filteredAlerts.length - visibleAlerts.length);

  const alertProductIds = useMemo(() => new Set(alerts.map((a) => a.product.id)), [alerts]);
  const healthyUnits = useMemo(
    () =>
      products
        .filter((p) => !alertProductIds.has(p.id))
        .reduce((sum, p) => sum + p.quantity, 0),
    [products, alertProductIds],
  );

  const draftProductIds = useMemo(
    () => new Set(activeDraftOrder?.items.map((i) => i.productId) || []),
    [activeDraftOrder],
  );

  const handleReponer = async (alert: LowStockAlertItem) => {
    setAddingId(alert.product.id);
    try {
      await addAlertToDraftOrder(alert);
      showToast(`${alert.product.name} agregado al pedido (+${alert.suggestedQty} uds).`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo agregar al pedido.', 'error');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <MobileShell>
      <div className="px-4 pt-[calc(18px+env(safe-area-inset-top,0px))] pb-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-extrabold tracking-tight text-[#071C2D]">Alertas</h1>
            <p className="mt-0.5 text-xs font-medium text-[#5C7B98] tabular-nums">
              {alerts.length}{' '}
              {alerts.length === 1 ? 'producto por reponer' : 'productos por reponer'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeDraftOrder && (
              <button
                type="button"
                onClick={() => setOrderSheetOpen(true)}
                className="flex min-h-[42px] items-center gap-1.5 rounded-full bg-[#0A1F32] px-3.5 text-xs font-bold text-white shadow-sm"
              >
                <ShoppingBag className="h-3.5 w-3.5 text-[#EF8D2A]" />
                Pedido ({activeDraftOrder.items.length})
              </button>
            )}
            <button
              type="button"
              aria-label="Filtrar alertas"
              onClick={() => setFilterOpen((v) => !v)}
              className={`flex h-11 w-11 items-center justify-center rounded-full border ${
                filterMode !== 'all'
                  ? 'border-[#1F69FC] bg-[#E6EEFF] text-[#1F69FC]'
                  : 'border-slate-200 bg-white text-[#071C2D]'
              }`}
            >
              <Filter className="h-5 w-5" />
            </button>
          </div>
        </header>

        {filterOpen && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {(
              [
                {key: 'all', label: 'Todas'},
                {key: 'agotado', label: 'Agotados'},
                {key: 'bajo_minimo', label: 'Bajo el mínimo'},
                {key: 'se_acaba_pronto', label: 'Se acaba pronto'},
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFilterMode(opt.key)}
                className={`min-h-[36px] shrink-0 rounded-full px-3.5 text-xs font-bold ${
                  filterMode === opt.key
                    ? 'bg-[#0A1F32] text-white'
                    : 'border border-slate-200 bg-white text-[#5C7B98]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {filteredAlerts.length === 0 ? (
          <div className="mt-5 rounded-[18px] border border-[#24B570]/30 bg-[#E3F7EC] p-5 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-[#24B570]" />
            <p className="text-base font-extrabold text-[#071C2D]">¡Sin alertas pendientes!</p>
            <p className="mt-1 text-xs text-[#15803D]">
              Todas tus prendas están por encima de su mínimo configurado.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {visibleAlerts.map((alert) => {
              const inOrder = draftProductIds.has(alert.product.id);
              const isOut = alert.severity === 'agotado';
              const isEarly = alert.severity === 'se_acaba_pronto';
              const ratio =
                alert.product.minStock > 0
                  ? Math.min(100, Math.round((alert.product.quantity / alert.product.minStock) * 100))
                  : 0;

              return (
                <div
                  key={alert.product.id}
                  className="rounded-[18px] border border-slate-200/80 bg-white p-3.5 card-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <GarmentThumbnail
                        imageUrl={alert.product.imageUrl}
                        category={alert.product.category}
                        color={alert.product.color}
                        name={alert.product.name}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-extrabold text-[#071C2D]">
                            {alert.product.name}
                          </p>
                          {isEarly && (
                            <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-bold text-[#B45309]">
                              Se acaba pronto
                            </span>
                          )}
                        </div>
                        <p
                          className={`mt-0.5 text-xs font-bold tabular-nums ${
                            isOut ? 'text-red-600' : 'text-[#EF8D2A]'
                          }`}
                        >
                          {isOut
                            ? `Agotado · mínimo ${alert.product.minStock}`
                            : `Quedan ${alert.product.quantity} uds · mínimo ${alert.product.minStock}`}
                        </p>
                        <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${
                              isOut ? 'bg-red-500' : isEarly ? 'bg-amber-400' : 'bg-[#EF8D2A]'
                            }`}
                            style={{width: `${Math.max(8, ratio)}%`}}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={addingId === alert.product.id}
                      onClick={() => (inOrder ? setOrderSheetOpen(true) : handleReponer(alert))}
                      className={`flex min-h-[40px] shrink-0 items-center gap-1 rounded-full px-3.5 text-xs font-bold transition-colors ${
                        inOrder
                          ? 'bg-[#E3F7EC] text-[#15803D]'
                          : 'bg-[#EF8D2A] text-white shadow-xs active:scale-95'
                      }`}
                    >
                      {inOrder && <Check className="h-3.5 w-3.5" />}
                      {inOrder ? 'En pedido' : 'Reponer'}
                    </button>
                  </div>

                  <p className="mt-2.5 text-center text-[11px] font-medium text-[#5C7B98]">
                    {alert.contextText}
                  </p>
                </div>
              );
            })}

            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="flex min-h-[46px] w-full items-center justify-center rounded-[14px] border border-slate-200 bg-white text-xs font-bold text-[#1F69FC]"
              >
                Ver {hiddenCount} {hiddenCount === 1 ? 'alerta más' : 'alertas más'}
              </button>
            )}
          </div>
        )}

        {/* Tarjeta verde inferior Todo en orden */}
        <div className="mt-4 flex items-center gap-3 rounded-[16px] border border-[#24B570]/25 bg-[#E3F7EC] px-4 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#24B570] text-white">
            <Check className="h-4 w-4" strokeWidth={3} />
          </div>
          <div>
            <p className="text-sm font-extrabold text-[#071C2D]">Todo en orden</p>
            <p className="text-xs font-medium text-[#15803D] tabular-nums">
              {healthyUnits} prendas con buen stock
            </p>
          </div>
        </div>
      </div>

      <OrderDraftSheet
        order={activeDraftOrder}
        open={orderSheetOpen}
        onClose={() => setOrderSheetOpen(false)}
      />
    </MobileShell>
  );
};
