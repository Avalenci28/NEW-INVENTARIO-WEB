import React, {useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Archive, Box, Layers, Plus, Search, Store, X} from 'lucide-react';
import {MobileShell} from '../components/MobileShell';
import {SpaceFormSheet} from '../components/SpaceFormSheet';
import {useInventory} from '../context/InventoryContext';
import type {SpaceType} from '../types/inventory';

type SortMode = 'az' | 'abc' | 'units';

function SpaceTypeIcon({type}: {type: SpaceType}) {
  if (type === 'bodega') return <Archive className="h-5 w-5 text-white" />;
  if (type === 'vitrina') return <Store className="h-5 w-5 text-white" />;
  if (type === 'estante') return <Layers className="h-5 w-5 text-white" />;
  return <Box className="h-5 w-5 text-white" />;
}

export const SpacesPage: React.FC = () => {
  const {spaces, products, alerts, abcMap, loadingData} = useInventory();
  const navigate = useNavigate();

  const [sortMode, setSortMode] = useState<SortMode>('az');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newSpaceOpen, setNewSpaceOpen] = useState(false);

  const enrichedSpaces = useMemo(() => {
    const lowCountBySpace = new Map<string, number>();
    for (const alert of alerts) {
      lowCountBySpace.set(
        alert.product.spaceId,
        (lowCountBySpace.get(alert.product.spaceId) || 0) + 1,
      );
    }

    return spaces.map((space) => {
      const spaceProducts = products.filter((p) => p.spaceId === space.id);
      const totalUnits = spaceProducts.reduce((sum, p) => sum + p.quantity, 0);
      const lowCount = lowCountBySpace.get(space.id) || 0;
      const rotationScore = spaceProducts.reduce(
        (sum, p) => sum + (abcMap.get(p.id)?.sold30d ?? 0),
        0,
      );
      return {space, totalUnits, lowCount, rotationScore};
    });
  }, [spaces, products, alerts, abcMap]);

  const filteredAndSorted = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = q
      ? enrichedSpaces.filter(
          (item) =>
            item.space.name.toLowerCase().includes(q) ||
            item.space.location.toLowerCase().includes(q),
        )
      : [...enrichedSpaces];

    if (sortMode === 'az') {
      list.sort((a, b) => a.space.name.localeCompare(b.space.name, 'es-CO'));
    } else if (sortMode === 'abc') {
      list.sort((a, b) => b.rotationScore - a.rotationScore);
    } else {
      list.sort((a, b) => b.totalUnits - a.totalUnits);
    }
    return list;
  }, [enrichedSpaces, searchTerm, sortMode]);

  const sortSubtitle =
    sortMode === 'az'
      ? 'ordenados de la A a la Z'
      : sortMode === 'abc'
        ? 'ordenados por rotación ABC'
        : 'ordenados por más prendas';

  return (
    <MobileShell>
      <div className="px-4 pt-[calc(18px+env(safe-area-inset-top,0px))] pb-6">
        {/* Encabezado */}
        <header className="flex items-center justify-between">
          <h1 className="text-[24px] font-extrabold tracking-tight text-[#071C2D]">Espacios</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Buscar espacio"
              onClick={() => {
                setSearchOpen((v) => !v);
                if (searchOpen) setSearchTerm('');
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#071C2D] border border-slate-200"
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>
            <button
              type="button"
              aria-label="Crear nuevo espacio"
              onClick={() => setNewSpaceOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1F69FC] text-white shadow-sm active:scale-95 transition-transform"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </header>

        {searchOpen && (
          <div className="mt-3">
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o ubicación..."
              autoFocus
              className="min-h-[48px] w-full rounded-[12px] border border-[#1F69FC] bg-white px-3.5 text-base text-[#071C2D] focus:outline-none"
            />
          </div>
        )}

        {/* Chips de orden */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSortMode('az')}
            className={`min-h-[38px] rounded-full px-4 text-xs font-bold transition-colors ${
              sortMode === 'az'
                ? 'bg-[#0A1F32] text-white'
                : 'border border-slate-200 bg-white text-[#5C7B98]'
            }`}
          >
            A-Z
          </button>
          <button
            type="button"
            onClick={() => setSortMode('abc')}
            className={`min-h-[38px] rounded-full px-4 text-xs font-bold transition-colors ${
              sortMode === 'abc'
                ? 'bg-[#0A1F32] text-white'
                : 'border border-slate-200 bg-white text-[#5C7B98]'
            }`}
          >
            ABC
          </button>
          <button
            type="button"
            onClick={() => setSortMode('units')}
            className={`min-h-[38px] rounded-full px-4 text-xs font-bold transition-colors ${
              sortMode === 'units'
                ? 'bg-[#0A1F32] text-white'
                : 'border border-slate-200 bg-white text-[#5C7B98]'
            }`}
          >
            Más prendas
          </button>
        </div>

        <p className="mt-3 text-xs font-medium text-[#5C7B98] tabular-nums">
          {filteredAndSorted.length}{' '}
          {filteredAndSorted.length === 1 ? 'espacio' : 'espacios'} · {sortSubtitle}
        </p>

        {/* Cuadrícula de 2 columnas */}
        {loadingData ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-[16px] bg-slate-200/70" />
            ))}
          </div>
        ) : (
          <div className="mt-3.5 grid grid-cols-2 gap-3">
            {filteredAndSorted.map(({space, totalUnits, lowCount}) => (
              <button
                key={space.id}
                type="button"
                onClick={() => navigate(`/espacios/${space.id}`)}
                className="relative flex min-h-[124px] flex-col justify-between rounded-[16px] border border-slate-200/80 bg-white p-4 text-left card-shadow active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl shadow-xs"
                    style={{backgroundColor: space.color}}
                  >
                    <SpaceTypeIcon type={space.type} />
                  </div>
                  {lowCount > 0 && (
                    <span className="rounded-full bg-[#FFF1E0] px-2.5 py-0.5 text-[11px] font-bold text-[#EF8D2A] tabular-nums whitespace-nowrap">
                      {lowCount} {lowCount === 1 ? 'baja' : 'bajas'}
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <p className="truncate text-[15px] font-bold text-[#071C2D]">{space.name}</p>
                  <p className="mt-0.5 text-xs font-medium text-[#5C7B98] tabular-nums">
                    {totalUnits} {totalUnits === 1 ? 'prenda' : 'prendas'}
                  </p>
                </div>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setNewSpaceOpen(true)}
              className="flex min-h-[124px] flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-slate-300 bg-white/60 p-4 text-center hover:border-[#1F69FC] hover:bg-white active:scale-[0.98] transition-all"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E6EEFF] text-[#1F69FC]">
                <Plus className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-[#1F69FC]">Nuevo espacio</span>
            </button>
          </div>
        )}
      </div>

      <SpaceFormSheet open={newSpaceOpen} onClose={() => setNewSpaceOpen(false)} />
    </MobileShell>
  );
};
