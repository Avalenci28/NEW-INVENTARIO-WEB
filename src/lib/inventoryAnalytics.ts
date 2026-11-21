import type {
  AbcClass,
  AbcProductStats,
  GarmentCategory,
  LowStockAlertItem,
  Movement,
  OrderItem,
  Product,
  Space,
} from '../types/inventory';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function getFirstName(fullName: string | undefined | null): string {
  if (!fullName) return 'emprendedor';
  const trimmed = fullName.trim();
  if (!trimmed) return 'emprendedor';
  return trimmed.split(/\s+/)[0];
}

export function formatMovementDateEsCo(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'reciente';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfDate) / (24 * 60 * 60 * 1000));

  const timeStr = new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  if (diffDays === 0) return `hoy ${timeStr}`;
  if (diffDays === 1) return 'ayer';
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

/**
 * Calcula la cantidad sugerida a pedir (en código, nunca inventada por la IA):
 * ceil(ventas_diarias_promedio * 21 días - stock_actual), mínimo 1, redondeada a múltiplos de 5.
 */
export function computeSuggestedOrderQty(dailySales: number, currentStock: number, minStock: number): number {
  const effectiveDaily = dailySales > 0 ? dailySales : Math.max(minStock / 10, 0.25);
  const rawNeeded = Math.ceil(effectiveDaily * 21 - currentStock);
  const atLeastOne = Math.max(1, rawNeeded, minStock > currentStock ? minStock * 2 - currentStock : 5);
  return Math.max(5, Math.ceil(atLeastOne / 5) * 5);
}

/**
 * Idea SIT 4 (Dependencia de atributos):
 * Calcula un mínimo recomendado según categoría y ritmo de venta.
 */
export function computeAutoMinStock(category: GarmentCategory, dailySales: number = 0): number {
  const baseByCategory: Record<GarmentCategory, number> = {
    camiseta: 8,
    jean: 6,
    pantalón: 5,
    buzo: 5,
    gorra: 4,
    zapatos: 4,
    accesorio: 6,
    otro: 5,
  };
  const base = baseByCategory[category] ?? 5;
  if (dailySales <= 0) return base;
  // 7 días de cobertura + colchón según rotación
  return Math.max(base, Math.ceil(dailySales * 7));
}

function getFrequencyLabel(eventsCount30d: number, totalSold30d: number): string {
  if (totalSold30d <= 0) return 'Sin salidas este mes';
  const avgDaysBetween = eventsCount30d > 1 ? 30 / eventsCount30d : 30;
  if (avgDaysBetween <= 2.5 || totalSold30d >= 20) return 'Se vende cada día';
  if (avgDaysBetween <= 10 || totalSold30d >= 6) return 'Se vende cada semana';
  return 'Se vende al mes';
}

/**
 * Clasificación ABC (Pareto sobre unidades vendidas en últimos 30 días):
 * A = 80 % acumulado, B = siguiente 15 %, C = 5 % restante y sin ventas.
 */
export function computeAbcStats(products: Product[], movements: Movement[]): Map<string, AbcProductStats> {
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const salesMap = new Map<string, {sold: number; events: number}>();

  for (const m of movements) {
    if (m.type !== 'salida') continue;
    const t = new Date(m.occurredAt).getTime();
    if (Number.isNaN(t) || t < cutoff) continue;
    const prev = salesMap.get(m.productId) || {sold: 0, events: 0};
    salesMap.set(m.productId, {
      sold: prev.sold + m.quantity,
      events: prev.events + 1,
    });
  }

  const enriched = products.map((product) => {
    const entry = salesMap.get(product.id) || {sold: 0, events: 0};
    return {
      product,
      sold30d: entry.sold,
      events30d: entry.events,
    };
  });

  enriched.sort((a, b) => b.sold30d - a.sold30d);

  const totalSold = enriched.reduce((sum, item) => sum + item.sold30d, 0);
  let cumulative = 0;

  const result = new Map<string, AbcProductStats>();

  for (const item of enriched) {
    let abcClass: AbcClass = 'C';
    if (totalSold > 0 && item.sold30d > 0) {
      const prevShare = cumulative / totalSold;
      cumulative += item.sold30d;
      if (prevShare < 0.8) {
        abcClass = 'A';
      } else if (prevShare < 0.95) {
        abcClass = 'B';
      } else {
        abcClass = 'C';
      }
    }

    const dailySales = item.sold30d / 30;
    const daysRemaining =
      dailySales > 0 ? Math.max(0, Math.round(item.product.quantity / dailySales)) : null;

    result.set(item.product.id, {
      product: item.product,
      sold30d: item.sold30d,
      dailySales,
      abcClass,
      frequencyLabel: getFrequencyLabel(item.events30d, item.sold30d),
      daysRemaining,
      suggestedQty: computeSuggestedOrderQty(dailySales, item.product.quantity, item.product.minStock),
    });
  }

  return result;
}

/**
 * Alertas de stock bajo + Alerta anticipada (Idea SIT 2: < 7 días de cobertura).
 */
export function computeLowStockAlerts(
  products: Product[],
  spaces: Space[],
  abcMap: Map<string, AbcProductStats>,
): LowStockAlertItem[] {
  const spaceNameMap = new Map(spaces.map((s) => [s.id, s.name]));
  const alerts: LowStockAlertItem[] = [];

  for (const product of products) {
    const stats = abcMap.get(product.id);
    const sold30d = stats?.sold30d ?? 0;
    const daysRemaining = stats?.daysRemaining ?? null;
    const abcClass = stats?.abcClass ?? 'C';
    const suggestedQty = stats?.suggestedQty ?? computeSuggestedOrderQty(0, product.quantity, product.minStock);

    const isOut = product.quantity === 0;
    const isBelowMin = product.quantity <= product.minStock;
    const isRunningOutSoon = !isBelowMin && daysRemaining !== null && daysRemaining < 7;

    if (!isOut && !isBelowMin && !isRunningOutSoon) {
      continue;
    }

    const severity = isOut ? 'agotado' : isBelowMin ? 'bajo_minimo' : 'se_acaba_pronto';

    let contextText = 'Stock por debajo del mínimo configurado';
    if (isOut) {
      contextText = 'Sin unidades disponibles en inventario';
    } else if (isRunningOutSoon && daysRemaining !== null) {
      contextText = `Al ritmo actual se agota en ~${Math.max(1, daysRemaining)} días`;
    } else if (sold30d >= 10 || abcClass === 'A') {
      contextText = 'Se vendió bien esta semana';
    } else if (sold30d > 0) {
      contextText = 'Rotación constante este mes';
    }

    // Puntaje de urgencia: menor es más urgente
    const urgencyScore = isOut
      ? -1000
      : isBelowMin
        ? (product.quantity - product.minStock) * 10 + (daysRemaining ?? 30) - (abcClass === 'A' ? 25 : 0)
        : 200 + (daysRemaining ?? 7);

    alerts.push({
      product,
      spaceName: spaceNameMap.get(product.spaceId) || 'Sin espacio',
      severity,
      abcClass,
      sold30d,
      daysRemaining,
      suggestedQty,
      contextText,
      urgencyScore,
    });
  }

  return alerts.sort((a, b) => a.urgencyScore - b.urgencyScore);
}

/**
 * Recomendación del Inicio: prenda clase A (o más urgente) con menos días de cobertura.
 */
export function computeHomeRecommendation(
  alerts: LowStockAlertItem[],
  products: Product[],
  abcMap: Map<string, AbcProductStats>,
): {text: string; focusProductId: string | null} {
  if (products.length === 0) {
    return {
      text: 'Escanea tu primera prenda para que la IA empiece a cuidar tu stock.',
      focusProductId: null,
    };
  }

  const classAAlert = alerts.find((a) => a.abcClass === 'A') || alerts[0];
  if (classAAlert) {
    if (classAAlert.product.quantity === 0) {
      return {
        text: `${classAAlert.product.name} está agotado y tiene alta demanda. Te recomiendo reponer ${classAAlert.suggestedQty} uds.`,
        focusProductId: classAAlert.product.id,
      };
    }
    return {
      text: `${classAAlert.product.name} se vende rápido y quedan pocas unidades. Te recomiendo reponer.`,
      focusProductId: classAAlert.product.id,
    };
  }

  const topA = Array.from(abcMap.values()).find((s) => s.abcClass === 'A');
  if (topA) {
    return {
      text: `Tu inventario está al día. ${topA.product.name} es tu prenda de mayor rotación esta semana.`,
      focusProductId: topA.product.id,
    };
  }

  return {
    text: 'Tu inventario está en orden. Registra entradas y salidas para activar alertas inteligentes.',
    focusProductId: null,
  };
}

export function formatOrderForWhatsApp(
  businessName: string,
  items: OrderItem[],
  notes?: string,
): string {
  const today = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const lines = [
    `*Pedido de reposición — ${businessName || 'Mi tienda de ropa'}*`,
    `Fecha: ${today}`,
    '',
    ...items.map(
      (item, idx) =>
        `${idx + 1}. ${item.productName}${item.size ? ` (Talla ${item.size})` : ''}: *${item.finalQty} uds*`,
    ),
    '',
    `Total unidades: *${items.reduce((acc, i) => acc + i.finalQty, 0)} uds*`,
  ];

  if (notes && notes.trim()) {
    lines.push(`Nota: ${notes.trim()}`);
  }

  return lines.join('\n');
}
