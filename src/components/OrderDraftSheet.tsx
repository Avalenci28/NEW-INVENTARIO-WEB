import React, {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {Check, Copy, Minus, PackageCheck, Plus, Send, Trash2, X} from 'lucide-react';
import {useAuth} from '../context/AuthContext';
import {useInventory} from '../context/InventoryContext';
import {useToast} from '../context/ToastContext';
import {formatOrderForWhatsApp} from '../lib/inventoryAnalytics';
import type {Order, OrderItem} from '../types/inventory';
import {GarmentThumbnail} from './GarmentThumbnail';

interface OrderDraftSheetProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
}

export const OrderDraftSheet: React.FC<OrderDraftSheetProps> = ({order, open, onClose}) => {
  const {profile} = useAuth();
  const {updateOrderItems, updateOrderStatus} = useInventory();
  const {showToast} = useToast();

  const [items, setItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (order && open) {
      setItems(order.items);
      setNotes(order.notes || '');
      setCopied(false);
    }
  }, [order, open]);

  if (!order) return null;

  const totalUnits = items.reduce((sum, i) => sum + i.finalQty, 0);

  const changeQty = (productId: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? {...item, finalQty: Math.max(1, item.finalQty + delta)}
          : item,
      ),
    );
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await updateOrderItems(order.id, items, notes);
      showToast(items.length === 0 ? 'Borrador descartado.' : 'Pedido actualizado.');
      if (items.length === 0) onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al guardar pedido.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyWhatsApp = async () => {
    const text = formatOrderForWhatsApp(profile?.businessName || 'Mi tienda de ropa', items, notes);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast('Pedido copiado para pegar en WhatsApp.');
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('No pudimos acceder al portapapeles.', 'error');
    }
  };

  const handleMarkStatus = async (status: 'enviado' | 'recibido') => {
    setBusy(true);
    try {
      await updateOrderItems(order.id, items, notes);
      await updateOrderStatus(order.id, status);
      showToast(
        status === 'recibido'
          ? 'Pedido recibido y sumado a tu inventario.'
          : 'Pedido marcado como enviado al proveedor.',
      );
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo actualizar el estado.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            onClick={onClose}
            className="absolute inset-0 bg-[#0A1F32]/55 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{y: '100%'}}
            animate={{y: 0}}
            exit={{y: '100%'}}
            transition={{type: 'spring', damping: 30, stiffness: 320}}
            className="relative z-10 max-h-[90dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white px-5 pt-3 pb-[calc(24px+env(safe-area-inset-bottom,0px))] shadow-2xl"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />

            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-[20px] font-bold text-[#071C2D]">Pedido de reposición</h2>
                <p className="text-xs text-[#5C7B98] tabular-nums">
                  {items.length} referencias · {totalUnits} unidades totales
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar pedido"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#5C7B98] hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                <p className="text-sm text-[#5C7B98]">Quitaste todas las prendas del pedido.</p>
                <button
                  type="button"
                  onClick={handleSave}
                  className="mt-4 min-h-[44px] rounded-xl bg-red-50 px-4 text-sm font-semibold text-red-600"
                >
                  Descartar borrador
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-3">
                  {items.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between gap-2 py-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <GarmentThumbnail
                          category={item.category}
                          name={item.productName}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#071C2D]">
                            {item.productName}
                          </p>
                          <p className="text-xs text-[#5C7B98] tabular-nums">
                            Quedan {item.currentQty} · Sugerido {item.suggestedQty}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="Disminuir cantidad"
                          onClick={() => changeQty(item.productId, -5)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-[#071C2D]"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[28px] text-center text-sm font-bold text-[#071C2D] tabular-nums">
                          {item.finalQty}
                        </span>
                        <button
                          type="button"
                          aria-label="Aumentar cantidad"
                          onClick={() => changeQty(item.productId, 5)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1F69FC] text-white"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Quitar del pedido"
                          onClick={() => removeItem(item.productId)}
                          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#5C7B98]">
                    Nota para el proveedor (opcional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej. Entregar antes del viernes"
                    maxLength={400}
                    className="min-h-[48px] w-full rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3.5 text-base text-[#071C2D] focus:border-[#1F69FC] focus:bg-white focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#24B570] px-4 text-[15px] font-semibold text-white shadow-sm active:scale-[0.99]"
                >
                  {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  {copied ? 'Copiado para WhatsApp' : 'Copiar pedido para WhatsApp'}
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSave}
                    className="min-h-[48px] rounded-[14px] border border-slate-200 bg-white px-3 text-sm font-semibold text-[#071C2D]"
                  >
                    Guardar borrador
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleMarkStatus('enviado')}
                    className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-[14px] bg-[#1F69FC] px-3 text-sm font-semibold text-white"
                  >
                    <Send className="h-4 w-4" />
                    Marcar enviado
                  </button>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleMarkStatus('recibido')}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#0A1F32] px-4 text-sm font-semibold text-white"
                >
                  <PackageCheck className="h-4 w-4 text-[#24B570]" />
                  Ya lo recibí (sumar al inventario)
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
