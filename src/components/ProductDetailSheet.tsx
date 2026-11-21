import React, {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {ArrowDownLeft, ArrowUpRight, Minus, Plus, Sparkles, Trash2, X} from 'lucide-react';
import {useInventory} from '../context/InventoryContext';
import {useToast} from '../context/ToastContext';
import {computeAutoMinStock} from '../lib/inventoryAnalytics';
import type {Product} from '../types/inventory';
import {GarmentThumbnail} from './GarmentThumbnail';

interface ProductDetailSheetProps {
  product: Product | null;
  onClose: () => void;
}

export const ProductDetailSheet: React.FC<ProductDetailSheetProps> = ({product, onClose}) => {
  const {spaces, abcMap, registerMovement, updateProduct, deleteProduct} = useInventory();
  const {showToast} = useToast();

  const [tab, setTab] = useState<'movimiento' | 'editar'>('movimiento');
  const [movType, setMovType] = useState<'entrada' | 'salida'>('salida');
  const [movQty, setMovQty] = useState(1);
  const [movNote, setMovNote] = useState('');

  const [editName, setEditName] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editSpaceId, setEditSpaceId] = useState('');
  const [editMinStock, setEditMinStock] = useState(5);
  const [editAutoMin, setEditAutoMin] = useState(false);

  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (product) {
      setTab('movimiento');
      setMovType('salida');
      setMovQty(1);
      setMovNote('');
      setEditName(product.name);
      setEditSize(product.size);
      setEditSpaceId(product.spaceId);
      setEditMinStock(product.minStock);
      setEditAutoMin(product.autoMinStock);
      setConfirmDelete(false);
    }
  }, [product]);

  const stats = product ? abcMap.get(product.id) : undefined;
  const recommendedMin = product
    ? computeAutoMinStock(product.category, stats?.dailySales ?? 0)
    : 5;

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setBusy(true);
    try {
      await registerMovement(product.id, movType, movQty, movNote);
      showToast(
        movType === 'entrada'
          ? `Entrada de +${movQty} uds registrada.`
          : `Salida de -${movQty} uds registrada.`,
      );
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'No se pudo registrar el movimiento.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    if (!editName.trim()) {
      showToast('El nombre no puede estar vacío.', 'error');
      return;
    }
    setBusy(true);
    try {
      await updateProduct(product.id, {
        name: editName.trim(),
        size: editSize.trim() || 'Única',
        spaceId: editSpaceId,
        minStock: editAutoMin ? recommendedMin : editMinStock,
        autoMinStock: editAutoMin,
      });
      showToast('Prenda actualizada.');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo actualizar.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    try {
      await deleteProduct(product.id);
      showToast('Prenda eliminada del inventario.');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo eliminar.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {product && (
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
            className="relative z-10 max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white px-5 pt-3 pb-[calc(24px+env(safe-area-inset-bottom,0px))] shadow-2xl"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />

            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <GarmentThumbnail
                  imageUrl={product.imageUrl}
                  category={product.category}
                  color={product.color}
                  name={product.name}
                  size="md"
                />
                <div>
                  <h2 className="text-lg font-bold text-[#071C2D] leading-tight">{product.name}</h2>
                  <p className="mt-0.5 text-xs font-medium text-[#5C7B98]">
                    Talla {product.size} · Stock actual:{' '}
                    <span className="font-bold text-[#071C2D] tabular-nums">
                      {product.quantity} uds
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar detalle"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#5C7B98] hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 rounded-xl bg-[#EDF0F5] p-1">
              <button
                type="button"
                onClick={() => setTab('movimiento')}
                className={`min-h-[40px] rounded-lg text-xs font-semibold transition-all ${
                  tab === 'movimiento' ? 'bg-white text-[#071C2D] shadow-sm' : 'text-[#5C7B98]'
                }`}
              >
                Entrada / Salida
              </button>
              <button
                type="button"
                onClick={() => setTab('editar')}
                className={`min-h-[40px] rounded-lg text-xs font-semibold transition-all ${
                  tab === 'editar' ? 'bg-white text-[#071C2D] shadow-sm' : 'text-[#5C7B98]'
                }`}
              >
                Editar prenda
              </button>
            </div>

            {tab === 'movimiento' ? (
              <form onSubmit={handleMovementSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMovType('salida')}
                    className={`flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] border text-sm font-semibold transition-colors ${
                      movType === 'salida'
                        ? 'border-[#EF8D2A] bg-[#FFF1E0] text-[#B45309]'
                        : 'border-slate-200 bg-white text-[#5C7B98]'
                    }`}
                  >
                    <ArrowUpRight className="h-4 w-4 text-[#EF8D2A]" />
                    Salida (Venta)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovType('entrada')}
                    className={`flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] border text-sm font-semibold transition-colors ${
                      movType === 'entrada'
                        ? 'border-[#24B570] bg-[#E3F7EC] text-[#15803D]'
                        : 'border-slate-200 bg-white text-[#5C7B98]'
                    }`}
                  >
                    <ArrowDownLeft className="h-4 w-4 text-[#24B570]" />
                    Entrada
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-[14px] border border-slate-200 bg-[#F8FAFC] px-4 py-3">
                  <span className="text-sm font-semibold text-[#071C2D]">Cantidad</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Restar unidad"
                      onClick={() => setMovQty((q) => Math.max(1, q - 1))}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-[#071C2D]"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-[32px] text-center text-lg font-bold text-[#071C2D] tabular-nums">
                      {movQty}
                    </span>
                    <button
                      type="button"
                      aria-label="Sumar unidad"
                      onClick={() => setMovQty((q) => q + 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F69FC] text-white"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#5C7B98]">
                    Nota (opcional)
                  </label>
                  <input
                    type="text"
                    value={movNote}
                    onChange={(e) => setMovNote(e.target.value)}
                    placeholder={
                      movType === 'entrada' ? 'Ej. Reposición de proveedor' : 'Ej. Venta en tienda'
                    }
                    maxLength={180}
                    className="min-h-[48px] w-full rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3.5 text-base text-[#071C2D] focus:border-[#1F69FC] focus:bg-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className={`flex min-h-[48px] w-full items-center justify-center rounded-[14px] text-[15px] font-semibold text-white shadow-sm disabled:opacity-60 ${
                    movType === 'entrada' ? 'bg-[#24B570]' : 'bg-[#EF8D2A]'
                  }`}
                >
                  {busy
                    ? 'Registrando...'
                    : movType === 'entrada'
                      ? `Sumar +${movQty} unidades`
                      : `Descontar −${movQty} unidades`}
                </button>
              </form>
            ) : (
              <form onSubmit={handleEditSubmit} className="space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#5C7B98]">Nombre</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={120}
                    className="min-h-[48px] w-full rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3.5 text-base text-[#071C2D] focus:border-[#1F69FC] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#5C7B98]">Talla</label>
                    <input
                      type="text"
                      value={editSize}
                      onChange={(e) => setEditSize(e.target.value)}
                      maxLength={20}
                      className="min-h-[48px] w-full rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3.5 text-base text-[#071C2D] focus:border-[#1F69FC] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#5C7B98]">
                      Espacio
                    </label>
                    <select
                      value={editSpaceId}
                      onChange={(e) => setEditSpaceId(e.target.value)}
                      className="min-h-[48px] w-full rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3 text-base text-[#071C2D] focus:border-[#1F69FC] focus:bg-white focus:outline-none"
                    >
                      {spaces.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-[12px] border border-slate-200 bg-[#F8FAFC] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#5C7B98]">
                      Mínimo de alerta (unidades)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !editAutoMin;
                        setEditAutoMin(next);
                        if (next) setEditMinStock(recommendedMin);
                      }}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        editAutoMin
                          ? 'bg-[#E6EEFF] text-[#1F69FC]'
                          : 'bg-slate-200/70 text-[#5C7B98]'
                      }`}
                    >
                      <Sparkles className="h-3 w-3" />
                      Mínimo automático
                    </button>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    disabled={editAutoMin}
                    value={editAutoMin ? recommendedMin : editMinStock}
                    onChange={(e) => setEditMinStock(Math.max(0, Number(e.target.value) || 0))}
                    className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 text-base font-semibold text-[#071C2D] disabled:opacity-65"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="flex min-h-[48px] w-full items-center justify-center rounded-[14px] bg-[#1F69FC] text-[15px] font-semibold text-white"
                >
                  {busy ? 'Guardando...' : 'Guardar cambios'}
                </button>

                {confirmDelete ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={busy}
                      className="min-h-[44px] flex-1 rounded-[12px] bg-red-600 text-sm font-semibold text-white"
                    >
                      Sí, eliminar prenda
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="min-h-[44px] rounded-[12px] border border-slate-200 px-4 text-sm font-semibold text-[#5C7B98]"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex min-h-[44px] w-full items-center justify-center gap-1.5 text-sm font-semibold text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar prenda
                  </button>
                )}
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
