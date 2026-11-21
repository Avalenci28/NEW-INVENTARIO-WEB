import React, {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {Check, Layers, MapPin, Trash2, X} from 'lucide-react';
import {useInventory} from '../context/InventoryContext';
import {useToast} from '../context/ToastContext';
import {formatInventoryError} from '../lib/firebase';
import type {Space, SpaceColor, SpaceType} from '../types/inventory';

interface SpaceFormSheetProps {
  open: boolean;
  onClose: () => void;
  editingSpace?: Space | null;
  onDeleted?: () => void;
}

const SPACE_TYPES: {value: SpaceType; label: string}[] = [
  {value: 'estante', label: 'Estante'},
  {value: 'bodega', label: 'Bodega'},
  {value: 'vitrina', label: 'Vitrina'},
  {value: 'otro', label: 'Otro'},
];

const SPACE_COLORS: {value: SpaceColor; label: string}[] = [
  {value: '#1F69FC', label: 'Azul'},
  {value: '#EF8D2A', label: 'Naranja'},
  {value: '#24B570', label: 'Verde'},
  {value: '#16A297', label: 'Turquesa'},
  {value: '#5C7B98', label: 'Gris'},
];

export const SpaceFormSheet: React.FC<SpaceFormSheetProps> = ({
  open,
  onClose,
  editingSpace = null,
  onDeleted,
}) => {
  const {spaces, products, createSpace, updateSpace, deleteSpace} = useInventory();
  const {showToast} = useToast();

  const [name, setName] = useState('');
  const [type, setType] = useState<SpaceType>('estante');
  const [color, setColor] = useState<SpaceColor>('#1F69FC');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingSpace) {
        setName(editingSpace.name);
        setType(editingSpace.type);
        setColor(editingSpace.color);
        setLocation(editingSpace.location || '');
      } else {
        setName('');
        setType('estante');
        setColor('#1F69FC');
        setLocation('');
      }
      setConfirmDelete(false);
    }
  }, [open, editingSpace]);

  const spaceProductsCount = editingSpace
    ? products.filter((p) => p.spaceId === editingSpace.id).length
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('Escribe un nombre para el espacio.', 'error');
      return;
    }

    const duplicate = spaces.some(
      (s) => s.name.toLowerCase() === trimmed.toLowerCase() && s.id !== editingSpace?.id,
    );
    if (duplicate) {
      showToast('Ya tienes un espacio con ese nombre.', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingSpace) {
        await updateSpace(editingSpace.id, {name: trimmed, type, color, location});
        showToast('Espacio actualizado.');
      } else {
        await createSpace({name: trimmed, type, color, location});
        showToast('Espacio creado.');
      }
      onClose();
    } catch (err) {
      showToast(formatInventoryError(err, 'No se pudo guardar el espacio.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingSpace) return;
    if (spaceProductsCount > 0 && !confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await deleteSpace(editingSpace.id, true);
      showToast('Espacio eliminado.');
      onClose();
      onDeleted?.();
    } catch (err) {
      showToast(formatInventoryError(err, 'No se pudo eliminar el espacio.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-end">
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
            className="relative z-10 w-full max-w-[430px] rounded-t-[24px] bg-white px-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom,0px))] shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200" />

            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[20px] font-bold text-[#071C2D]">
                {editingSpace ? 'Editar espacio' : 'Nuevo espacio'}
              </h2>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#5C7B98] hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#5C7B98]">
                  Nombre del espacio
                </label>
                <div className="flex min-h-[48px] items-center gap-2.5 rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3.5 focus-within:border-[#1F69FC] focus-within:bg-white">
                  <Layers className="h-4 w-4 shrink-0 text-[#5C7B98]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Estante C"
                    maxLength={80}
                    className="w-full bg-transparent text-base font-medium text-[#071C2D] placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs font-semibold text-[#5C7B98]">Tipo</span>
                <div className="grid grid-cols-4 gap-2">
                  {SPACE_TYPES.map((opt) => {
                    const active = type === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setType(opt.value)}
                        className={`min-h-[40px] rounded-full text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-[#1F69FC] text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-[#071C2D] hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs font-semibold text-[#5C7B98]">Color</span>
                <div className="flex items-center gap-3.5">
                  {SPACE_COLORS.map((swatch) => {
                    const selected = color === swatch.value;
                    return (
                      <button
                        key={swatch.value}
                        type="button"
                        aria-label={`Color ${swatch.label}`}
                        onClick={() => setColor(swatch.value)}
                        className={`flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-95 ${
                          selected ? 'ring-2 ring-[#0A1F32] ring-offset-2' : ''
                        }`}
                        style={{backgroundColor: swatch.value}}
                      >
                        {selected && <Check className="h-5 w-5 text-white" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#5C7B98]">
                  Ubicación (opcional)
                </label>
                <div className="flex min-h-[48px] items-center gap-2.5 rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3.5 focus-within:border-[#1F69FC] focus-within:bg-white">
                  <MapPin className="h-4 w-4 shrink-0 text-[#5C7B98]" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Pasillo 2"
                    maxLength={120}
                    className="w-full bg-transparent text-base font-medium text-[#071C2D] placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-[14px] bg-[#1F69FC] px-4 text-[15px] font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-60"
              >
                {saving
                  ? 'Guardando...'
                  : editingSpace
                    ? 'Guardar cambios'
                    : 'Crear espacio'}
              </button>

              {editingSpace && (
                <div className="pt-1">
                  {confirmDelete && spaceProductsCount > 0 ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      <p className="font-semibold">
                        Este espacio tiene {spaceProductsCount} prenda(s). Si lo eliminas también se
                        borrarán sus prendas.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={saving}
                          className="min-h-[40px] flex-1 rounded-lg bg-red-600 px-3 font-semibold text-white"
                        >
                          Confirmar eliminación
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="min-h-[40px] rounded-lg border border-red-200 bg-white px-3 font-semibold text-red-700"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={saving}
                      className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[12px] text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar espacio
                    </button>
                  )}
                </div>
              )}
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
