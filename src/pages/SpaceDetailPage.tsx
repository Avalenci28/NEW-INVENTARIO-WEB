import React, {useMemo, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {ArrowLeft, Pencil, Plus} from 'lucide-react';
import {GarmentThumbnail} from '../components/GarmentThumbnail';
import {MobileShell} from '../components/MobileShell';
import {ProductDetailSheet} from '../components/ProductDetailSheet';
import {SpaceFormSheet} from '../components/SpaceFormSheet';
import {useInventory} from '../context/InventoryContext';
import type {AbcClass, Product} from '../types/inventory';

function StockPill({quantity, minStock}: {quantity: number; minStock: number}) {
  if (quantity === 0) {
    return (
      <span className="shrink-0 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 whitespace-nowrap">
        Agotado
      </span>
    );
  }
  const isLow = quantity <= minStock;
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold tabular-nums whitespace-nowrap ${
        isLow ? 'bg-[#FFF1E0] text-[#EF8D2A]' : 'bg-[#E3F7EC] text-[#24B570]'
      }`}
    >
      {quantity} uds
    </span>
  );
}

export const SpaceDetailPage: React.FC = () => {
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const {spaces, products, abcMap} = useInventory();

  const [viewTab, setViewTab] = useState<'az' | 'abc'>('az');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editSpaceOpen, setEditSpaceOpen] = useState(false);

  const space = spaces.find((s) => s.id === id) || null;
  const spaceProducts = useMemo(
    () => products.filter((p) => p.spaceId === id),
    [products, id],
  );

  const totalUnits = useMemo(
    () => spaceProducts.reduce((sum, p) => sum + p.quantity, 0),
    [spaceProducts],
  );

  // Agrupación alfabética A-Z
  const groupedAZ = useMemo(() => {
    const sorted = [...spaceProducts].sort((a, b) => a.name.localeCompare(b.name, 'es-CO'));
    const groups = new Map<string, Product[]>();
    for (const p of sorted) {
      const letter = p.name.trim().charAt(0).toUpperCase() || '#';
      const arr = groups.get(letter) || [];
      arr.push(p);
      groups.set(letter, arr);
    }
    return Array.from(groups.entries());
  }, [spaceProducts]);

  // Agrupación ABC
  const groupedABC = useMemo(() => {
    const buckets: Record<AbcClass, {product: Product; frequencyLabel: string}[]> = {
      A: [],
      B: [],
      C: [],
    };
    for (const p of spaceProducts) {
      const stats = abcMap.get(p.id);
      const cls: AbcClass = stats?.abcClass || 'C';
      buckets[cls].push({
        product: p,
        frequencyLabel: stats?.frequencyLabel || 'Sin salidas este mes',
      });
    }
    return buckets;
  }, [spaceProducts, abcMap]);

  if (!space) {
    return (
      <MobileShell>
        <div className="p-6 text-center">
          <p className="text-sm font-semibold text-[#5C7B98]">Espacio no encontrado.</p>
          <button
            type="button"
            onClick={() => navigate('/espacios')}
            className="mt-4 min-h-[44px] rounded-xl bg-[#1F69FC] px-4 text-sm font-semibold text-white"
          >
            Volver a Espacios
          </button>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <div className="px-4 pt-[calc(14px+env(safe-area-inset-top,0px))] pb-6">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="Volver a Espacios"
              onClick={() => navigate('/espacios')}
              className="flex h-11 w-11 -ml-2 shrink-0 items-center justify-center rounded-full text-[#071C2D] hover:bg-slate-200/60"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-[20px] font-extrabold text-[#071C2D]">{space.name}</h1>
              <p className="truncate text-xs font-medium text-[#5C7B98] tabular-nums">
                {totalUnits} {totalUnits === 1 ? 'prenda' : 'prendas'}
                {space.location ? ` · ${space.location}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Editar espacio"
            onClick={() => setEditSpaceOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#5C7B98] border border-slate-200"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </header>

        {/* Selector segmentado Nombre A-Z | Clasificación ABC */}
        <div className="mt-4 grid grid-cols-2 rounded-[14px] bg-[#E2E8F0]/80 p-1">
          <button
            type="button"
            onClick={() => setViewTab('az')}
            className={`min-h-[40px] rounded-[11px] text-xs font-bold transition-all ${
              viewTab === 'az' ? 'bg-white text-[#071C2D] shadow-sm' : 'text-[#5C7B98]'
            }`}
          >
            Nombre A-Z
          </button>
          <button
            type="button"
            onClick={() => setViewTab('abc')}
            className={`min-h-[40px] rounded-[11px] text-xs font-bold transition-all ${
              viewTab === 'abc' ? 'bg-white text-[#071C2D] shadow-sm' : 'text-[#5C7B98]'
            }`}
          >
            Clasificación ABC
          </button>
        </div>

        {spaceProducts.length === 0 ? (
          <div className="mt-6 rounded-[18px] border border-slate-200 bg-white p-6 text-center card-shadow">
            <p className="text-sm font-semibold text-[#071C2D]">Este espacio aún está vacío</p>
            <p className="mt-1 text-xs text-[#5C7B98]">
              Agrega una prenda con cámara o de forma manual.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/prendas/nueva?spaceId=${space.id}`)}
              className="mt-4 inline-flex min-h-[46px] items-center justify-center gap-1.5 rounded-[14px] bg-[#1F69FC] px-5 text-sm font-bold text-white"
            >
              <Plus className="h-4 w-4" />
              Agregar prenda a este espacio
            </button>
          </div>
        ) : viewTab === 'az' ? (
          <div className="mt-4 space-y-4">
            {groupedAZ.map(([letter, items]) => (
              <div key={letter}>
                <p className="mb-1.5 px-1 text-xs font-extrabold text-[#5C7B98]">{letter}</p>
                <div className="divide-y divide-slate-100 rounded-[16px] border border-slate-200/80 bg-white px-3.5 card-shadow">
                  {items.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className="flex min-h-[66px] w-full items-center justify-between gap-3 py-2.5 text-left active:bg-slate-50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <GarmentThumbnail
                          imageUrl={product.imageUrl}
                          category={product.category}
                          color={product.color}
                          name={product.name}
                          size="md"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#071C2D]">
                            {product.name}
                          </p>
                          <p className="text-xs text-[#5C7B98]">
                            {product.size === 'Única' ? 'Única' : `Talla ${product.size}`}
                          </p>
                        </div>
                      </div>
                      <StockPill quantity={product.quantity} minStock={product.minStock} />
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => navigate(`/prendas/nueva?spaceId=${space.id}`)}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-[#1F69FC]/40 bg-white/70 px-4 text-sm font-bold text-[#1F69FC] hover:bg-white"
            >
              <Plus className="h-4 w-4" />
              Agregar prenda a este espacio
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Leyenda ABC */}
            <div className="rounded-[14px] border border-slate-200 bg-white px-3.5 py-3 text-center">
              <p className="text-[11px] font-bold text-[#071C2D]">
                A = más se vende · B = rotación media · C = se vende poco
              </p>
              <p className="mt-0.5 text-[11px] text-[#5C7B98]">
                La IA ordena tus prendas según cuánto rotan
              </p>
            </div>

            {(
              [
                {
                  cls: 'A' as AbcClass,
                  badgeBg: 'bg-[#24B570]',
                  title: 'Alta rotación',
                  subtitle: 'reponer primero',
                },
                {
                  cls: 'B' as AbcClass,
                  badgeBg: 'bg-[#EF8D2A]',
                  title: 'Rotación media',
                  subtitle: '',
                },
                {
                  cls: 'C' as AbcClass,
                  badgeBg: 'bg-[#1F69FC]',
                  title: 'Baja rotación',
                  subtitle: 'no comprar de más',
                },
              ] as const
            ).map((group) => {
              const items = groupedABC[group.cls];
              if (items.length === 0) return null;
              return (
                <div key={group.cls}>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold text-white ${group.badgeBg}`}
                    >
                      {group.cls}
                    </span>
                    <span className="text-xs font-bold text-[#071C2D]">{group.title}</span>
                    {group.subtitle && (
                      <span className="text-xs text-[#5C7B98]">· {group.subtitle}</span>
                    )}
                  </div>

                  <div className="divide-y divide-slate-100 rounded-[16px] border border-slate-200/80 bg-white px-3.5 card-shadow">
                    {items.map(({product, frequencyLabel}) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => setSelectedProduct(product)}
                        className="flex min-h-[66px] w-full items-center justify-between gap-3 py-2.5 text-left active:bg-slate-50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <GarmentThumbnail
                            imageUrl={product.imageUrl}
                            category={product.category}
                            color={product.color}
                            name={product.name}
                            size="md"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#071C2D]">
                              {product.name}
                            </p>
                            <p className="text-xs text-[#5C7B98]">{frequencyLabel}</p>
                          </div>
                        </div>
                        <StockPill quantity={product.quantity} minStock={product.minStock} />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ProductDetailSheet
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      <SpaceFormSheet
        open={editSpaceOpen}
        onClose={() => setEditSpaceOpen(false)}
        editingSpace={space}
        onDeleted={() => navigate('/espacios', {replace: true})}
      />
    </MobileShell>
  );
};
