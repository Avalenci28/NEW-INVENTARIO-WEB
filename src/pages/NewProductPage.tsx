import React, {useEffect, useState} from 'react';
import {useLocation, useNavigate, useSearchParams} from 'react-router-dom';
import {ArrowLeft, Barcode, Bell, CalendarClock, Layers, Minus, Plus, Sparkles} from 'lucide-react';
import {GarmentThumbnail} from '../components/GarmentThumbnail';
import {MobileShell} from '../components/MobileShell';
import {SpaceFormSheet} from '../components/SpaceFormSheet';
import {useInventory} from '../context/InventoryContext';
import {useToast} from '../context/ToastContext';
import {computeAutoMinStock} from '../lib/inventoryAnalytics';
import type {GarmentCategory} from '../types/inventory';

interface LocationState {
  name?: string;
  category?: GarmentCategory;
  color?: string;
  imageUrl?: string;
  aiRecognized?: boolean;
}

const CATEGORIES: {value: GarmentCategory; label: string}[] = [
  {value: 'camiseta', label: 'Camiseta'},
  {value: 'jean', label: 'Jean'},
  {value: 'pantalón', label: 'Pantalón'},
  {value: 'buzo', label: 'Buzo'},
  {value: 'gorra', label: 'Gorra'},
  {value: 'zapatos', label: 'Zapatos'},
  {value: 'accesorio', label: 'Accesorio'},
  {value: 'otro', label: 'Otro'},
];

const LETTER_SIZES = ['S', 'M', 'L', 'XL', 'Única'];
const NUMERIC_SIZES = ['28', '30', '32', '34', '36', '38', '40'];

export const NewProductPage: React.FC = () => {
  const {spaces, createProduct} = useInventory();
  const {showToast} = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const state = (location.state as LocationState | null) || {};
  const defaultSpaceId = searchParams.get('spaceId') || spaces[0]?.id || '';
  const initialBarcode = searchParams.get('barcode') || '';

  const [name, setName] = useState(state.name || '');
  const [category, setCategory] = useState<GarmentCategory>(state.category || 'camiseta');
  const [color] = useState(state.color || 'Blanco');
  const [imageUrl] = useState(state.imageUrl || '');
  const [aiRecognized] = useState(Boolean(state.aiRecognized));

  const [size, setSize] = useState('M');
  const [quantity, setQuantity] = useState(12);
  const [spaceId, setSpaceId] = useState(defaultSpaceId);
  const [autoMinStock, setAutoMinStock] = useState(false);
  const [minStock, setMinStock] = useState(5);
  const [barcode, setBarcode] = useState(initialBarcode);
  const [expiresAt, setExpiresAt] = useState('');

  const [newSpaceOpen, setNewSpaceOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!spaceId && spaces.length > 0) {
      setSpaceId(spaces[0].id);
    }
  }, [spaces, spaceId]);

  const isNumericCategory =
    category === 'jean' || category === 'pantalón' || category === 'zapatos';
  const sizeOptions = isNumericCategory ? [...NUMERIC_SIZES, ...LETTER_SIZES] : [...LETTER_SIZES, '30', '32', '34'];
  const recommendedMin = computeAutoMinStock(category);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Escribe el nombre de la prenda.', 'error');
      return;
    }
    if (!spaceId) {
      showToast('Primero crea o selecciona un espacio para guardar la prenda.', 'error');
      setNewSpaceOpen(true);
      return;
    }

    setSaving(true);
    try {
      await createProduct({
        spaceId,
        name: name.trim(),
        category,
        size: size.trim() || 'Única',
        color,
        quantity,
        minStock: autoMinStock ? recommendedMin : minStock,
        autoMinStock,
        barcode,
        imageUrl,
        aiRecognized,
        expiresAt: expiresAt.trim(),
      });
      showToast('Prenda guardada en tu inventario.');
      navigate(`/espacios/${spaceId}`, {replace: true});
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo guardar la prenda.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileShell hideBottomNav>
      <div className="min-h-full bg-[#F8FAFC] px-4 pt-[calc(14px+env(safe-area-inset-top,0px))] pb-[calc(28px+env(safe-area-inset-bottom,0px))]">
        <header className="mb-4 flex items-center gap-2">
          <button
            type="button"
            aria-label="Volver"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 -ml-2 items-center justify-center rounded-full text-[#071C2D] hover:bg-slate-200/60"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-[20px] font-extrabold text-[#071C2D]">Nueva prenda</h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tarjeta superior con foto e insignia IA */}
          <div className="flex items-center gap-4 rounded-[18px] border border-slate-200 bg-white p-4 card-shadow">
            <GarmentThumbnail
              imageUrl={imageUrl}
              category={category}
              color={color}
              name={name || 'Prenda'}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                  aiRecognized
                    ? 'bg-[#E3F7EC] text-[#24B570]'
                    : 'bg-[#E6EEFF] text-[#1F69FC]'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {aiRecognized ? 'Reconocido por IA' : 'Registro manual'}
              </span>
              <p className="mt-2 text-xs leading-relaxed text-[#5C7B98]">
                Revisa los datos antes de guardar.
              </p>
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#5C7B98]">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Camiseta blanca"
              maxLength={120}
              className="min-h-[48px] w-full rounded-[12px] border border-slate-200 bg-white px-3.5 text-base font-semibold text-[#071C2D] focus:border-[#1F69FC] focus:outline-none"
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#5C7B98]">Categoría</label>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`min-h-[38px] shrink-0 rounded-full px-3.5 text-xs font-bold transition-colors ${
                      active
                        ? 'bg-[#0A1F32] text-white'
                        : 'border border-slate-200 bg-white text-[#5C7B98]'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Talla */}
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-[#5C7B98]">Talla</span>
            <div className="flex flex-wrap gap-2">
              {sizeOptions.map((opt) => {
                const active = size === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSize(opt)}
                    className={`min-h-[40px] min-w-[44px] rounded-full px-3.5 text-xs font-bold transition-colors ${
                      active
                        ? 'bg-[#1F69FC] text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-[#071C2D]'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cantidad */}
          <div className="flex items-center justify-between rounded-[14px] border border-slate-200 bg-white px-4 py-3">
            <span className="text-sm font-bold text-[#071C2D]">Cantidad</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Restar"
                onClick={() => setQuantity((q) => Math.max(0, q - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-[#F8FAFC] text-[#071C2D]"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[32px] text-center text-lg font-extrabold text-[#071C2D] tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Sumar"
                onClick={() => setQuantity((q) => q + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F69FC] text-white"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Espacio */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold text-[#5C7B98]">Espacio</label>
              <button
                type="button"
                onClick={() => setNewSpaceOpen(true)}
                className="text-xs font-bold text-[#1F69FC]"
              >
                + Crear espacio
              </button>
            </div>
            <div className="flex min-h-[48px] items-center gap-2.5 rounded-[12px] border border-slate-200 bg-white px-3.5">
              <Layers className="h-4 w-4 shrink-0 text-[#5C7B98]" />
              <select
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}
                className="w-full bg-transparent text-base font-semibold text-[#071C2D] focus:outline-none"
              >
                {spaces.length === 0 ? (
                  <option value="">Crea un espacio primero</option>
                ) : (
                  spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Mínimo de alerta + Idea SIT 4 Mínimo automático */}
          <div className="rounded-[14px] border border-slate-200 bg-white p-3.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-[#5C7B98]">
                Avisarme cuando queden menos de
              </label>
              <button
                type="button"
                onClick={() => {
                  const next = !autoMinStock;
                  setAutoMinStock(next);
                  if (next) setMinStock(recommendedMin);
                }}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  autoMinStock
                    ? 'bg-[#E6EEFF] text-[#1F69FC]'
                    : 'bg-slate-100 text-[#5C7B98]'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                Mínimo automático
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2.5">
              <Bell className="h-4 w-4 text-[#EF8D2A]" />
              <input
                type="number"
                min={0}
                max={9999}
                disabled={autoMinStock}
                value={autoMinStock ? recommendedMin : minStock}
                onChange={(e) => setMinStock(Math.max(0, Number(e.target.value) || 0))}
                className="w-20 rounded-lg border border-slate-200 bg-[#F8FAFC] px-2.5 py-1.5 text-base font-bold text-[#071C2D] tabular-nums disabled:opacity-70"
              />
              <span className="text-sm font-medium text-[#5C7B98]">unidades</span>
            </div>
          </div>

          {/* Fecha de caducidad / lote (opcional) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold text-[#5C7B98]">
                Fecha de caducidad o lote (opcional)
              </label>
              {expiresAt && (
                <button
                  type="button"
                  onClick={() => setExpiresAt('')}
                  className="text-xs font-bold text-[#1F69FC]"
                >
                  Limpiar
                </button>
              )}
            </div>
            <div className="flex min-h-[48px] items-center gap-2.5 rounded-[12px] border border-slate-200 bg-white px-3.5">
              <CalendarClock className="h-4 w-4 shrink-0 text-[#1F69FC]" />
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full bg-transparent text-base font-semibold text-[#071C2D] focus:outline-none"
              />
            </div>
          </div>

          {barcode && (
            <div className="flex items-center justify-between rounded-xl bg-[#E6EEFF]/60 px-3.5 py-2.5 text-xs text-[#1F69FC]">
              <span className="flex items-center gap-2 font-semibold">
                <Barcode className="h-4 w-4" />
                Código: {barcode}
              </span>
              <button type="button" onClick={() => setBarcode('')} className="font-bold underline">
                Quitar
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex min-h-[50px] w-full items-center justify-center rounded-[14px] bg-[#1F69FC] px-4 text-[15px] font-bold text-white shadow-sm active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar en inventario'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/escanear?mode=barcode')}
            className="block w-full pt-1 text-center text-xs font-semibold text-[#5C7B98] underline"
          >
            También puedes escanear el código de barras
          </button>
        </form>
      </div>

      <SpaceFormSheet open={newSpaceOpen} onClose={() => setNewSpaceOpen(false)} />
    </MobileShell>
  );
};
