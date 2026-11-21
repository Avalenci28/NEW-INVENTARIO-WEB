import {collection, doc, getDocs, query, serverTimestamp, where, writeBatch} from 'firebase/firestore';
import {db, handleFirestoreError, OperationType} from './firebase';
import type {GarmentCategory, SpaceColor, SpaceType} from '../types/inventory';

interface SeedSpace {
  key: string;
  name: string;
  type: SpaceType;
  color: SpaceColor;
  location: string;
}

interface SeedProduct {
  spaceKey: string;
  name: string;
  category: GarmentCategory;
  size: string;
  color: string;
  quantity: number;
  minStock: number;
  autoMinStock: boolean;
  barcode: string;
  soldEvents: {daysAgo: number; qty: number}[];
}

const SEED_SPACES: SeedSpace[] = [
  {key: 'bodega', name: 'Bodega', type: 'bodega', color: '#1F69FC', location: 'Zona trasera'},
  {key: 'estante_a', name: 'Estante A', type: 'estante', color: '#5C7B98', location: 'Pasillo 1'},
  {key: 'estante_b', name: 'Estante B', type: 'estante', color: '#24B570', location: 'Pasillo 2'},
  {key: 'probadores', name: 'Probadores', type: 'otro', color: '#5C7B98', location: 'Zona central'},
  {key: 'vitrina', name: 'Vitrina', type: 'vitrina', color: '#EF8D2A', location: 'Entrada principal'},
];

// Totales exactos consistentes en todas las pantallas:
// Bodega: 120 uds (3 bajas), Estante A: 86 uds (2 bajas), Estante B: 64 uds (1 baja),
// Probadores: 18 uds (0 bajas), Vitrina: 42 uds (1 baja)
// Total: 330 prendas, 5 espacios, 7 productos con stock bajo.
const SEED_PRODUCTS: SeedProduct[] = [
  // Estante A -> 9 + 24 + 3 + 12 + 5 + 18 + 15 = 86 uds (2 bajas: Camiseta negra S, Jean azul 32)
  {
    spaceKey: 'estante_a',
    name: 'Buzo gris L',
    category: 'buzo',
    size: 'L',
    color: 'Gris',
    quantity: 9,
    minStock: 5,
    autoMinStock: false,
    barcode: '770100100101',
    soldEvents: [
      {daysAgo: 4, qty: 2},
      {daysAgo: 11, qty: 2},
      {daysAgo: 20, qty: 2},
    ],
  },
  {
    spaceKey: 'estante_a',
    name: 'Camiseta blanca M',
    category: 'camiseta',
    size: 'M',
    color: 'Blanco',
    quantity: 24,
    minStock: 10,
    autoMinStock: true,
    barcode: '770100100102',
    soldEvents: [
      {daysAgo: 1, qty: 6},
      {daysAgo: 3, qty: 5},
      {daysAgo: 7, qty: 6},
      {daysAgo: 12, qty: 7},
      {daysAgo: 19, qty: 6},
    ],
  },
  {
    spaceKey: 'estante_a',
    name: 'Camiseta negra S',
    category: 'camiseta',
    size: 'S',
    color: 'Negro',
    quantity: 3,
    minStock: 6,
    autoMinStock: false,
    barcode: '770100100103',
    soldEvents: [
      {daysAgo: 1, qty: 3},
      {daysAgo: 4, qty: 4},
      {daysAgo: 9, qty: 5},
      {daysAgo: 16, qty: 5},
    ],
  },
  {
    spaceKey: 'estante_a',
    name: 'Gorra negra',
    category: 'gorra',
    size: 'Única',
    color: 'Negro',
    quantity: 12,
    minStock: 4,
    autoMinStock: false,
    barcode: '770100100104',
    soldEvents: [
      {daysAgo: 5, qty: 2},
      {daysAgo: 14, qty: 2},
      {daysAgo: 22, qty: 2},
    ],
  },
  {
    spaceKey: 'estante_a',
    name: 'Jean azul 32',
    category: 'jean',
    size: '32',
    color: 'Azul',
    quantity: 5,
    minStock: 8,
    autoMinStock: true,
    barcode: '770100100105',
    soldEvents: [
      {daysAgo: 0, qty: 2},
      {daysAgo: 2, qty: 5},
      {daysAgo: 6, qty: 6},
      {daysAgo: 12, qty: 7},
      {daysAgo: 18, qty: 6},
    ],
  },
  {
    spaceKey: 'estante_a',
    name: 'Jean negro 30',
    category: 'jean',
    size: '30',
    color: 'Negro',
    quantity: 18,
    minStock: 6,
    autoMinStock: false,
    barcode: '770100100106',
    soldEvents: [{daysAgo: 17, qty: 2}],
  },
  {
    spaceKey: 'estante_a',
    name: 'Buzo azul M',
    category: 'buzo',
    size: 'M',
    color: 'Azul',
    quantity: 15,
    minStock: 5,
    autoMinStock: false,
    barcode: '770100100107',
    soldEvents: [{daysAgo: 24, qty: 1}],
  },

  // Bodega -> 40 + 38 + 36 + 2 + 2 + 2 = 120 uds (3 bajas)
  {
    spaceKey: 'bodega',
    name: 'Camiseta básica surtida',
    category: 'camiseta',
    size: 'M',
    color: 'Blanco',
    quantity: 40,
    minStock: 12,
    autoMinStock: true,
    barcode: '770100200201',
    soldEvents: [
      {daysAgo: 3, qty: 4},
      {daysAgo: 10, qty: 5},
    ],
  },
  {
    spaceKey: 'bodega',
    name: 'Jean clásico 34',
    category: 'jean',
    size: '34',
    color: 'Azul',
    quantity: 38,
    minStock: 10,
    autoMinStock: false,
    barcode: '770100200202',
    soldEvents: [{daysAgo: 15, qty: 2}],
  },
  {
    spaceKey: 'bodega',
    name: 'Pantalón chino beige 32',
    category: 'pantalón',
    size: '32',
    color: 'Beige',
    quantity: 36,
    minStock: 8,
    autoMinStock: false,
    barcode: '770100200203',
    soldEvents: [{daysAgo: 21, qty: 1}],
  },
  {
    spaceKey: 'bodega',
    name: 'Buzo azul marino M',
    category: 'buzo',
    size: 'M',
    color: 'Azul',
    quantity: 2,
    minStock: 5,
    autoMinStock: false,
    barcode: '770100200204',
    soldEvents: [
      {daysAgo: 2, qty: 2},
      {daysAgo: 9, qty: 3},
    ],
  },
  {
    spaceKey: 'bodega',
    name: 'Camiseta polo verde M',
    category: 'camiseta',
    size: 'M',
    color: 'Verde',
    quantity: 2,
    minStock: 6,
    autoMinStock: false,
    barcode: '770100200205',
    soldEvents: [
      {daysAgo: 4, qty: 2},
      {daysAgo: 13, qty: 2},
    ],
  },
  {
    spaceKey: 'bodega',
    name: 'Media deportiva pack x3',
    category: 'accesorio',
    size: 'Única',
    color: 'Blanco',
    quantity: 2,
    minStock: 8,
    autoMinStock: false,
    barcode: '770100200206',
    soldEvents: [{daysAgo: 6, qty: 3}],
  },

  // Estante B -> 22 + 20 + 19 + 3 = 64 uds (1 baja)
  {
    spaceKey: 'estante_b',
    name: 'Camisa lino blanca M',
    category: 'camiseta',
    size: 'M',
    color: 'Blanco',
    quantity: 22,
    minStock: 6,
    autoMinStock: false,
    barcode: '770100300301',
    soldEvents: [{daysAgo: 8, qty: 2}],
  },
  {
    spaceKey: 'estante_b',
    name: 'Pantalón dril negro 30',
    category: 'pantalón',
    size: '30',
    color: 'Negro',
    quantity: 20,
    minStock: 6,
    autoMinStock: false,
    barcode: '770100300302',
    soldEvents: [{daysAgo: 18, qty: 1}],
  },
  {
    spaceKey: 'estante_b',
    name: 'Buzo beige XL',
    category: 'buzo',
    size: 'XL',
    color: 'Beige',
    quantity: 19,
    minStock: 5,
    autoMinStock: false,
    barcode: '770100300303',
    soldEvents: [],
  },
  {
    spaceKey: 'estante_b',
    name: 'Camiseta oversize gris L',
    category: 'camiseta',
    size: 'L',
    color: 'Gris',
    quantity: 3,
    minStock: 7,
    autoMinStock: false,
    barcode: '770100300304',
    soldEvents: [{daysAgo: 3, qty: 3}],
  },

  // Probadores -> 10 + 8 = 18 uds (0 bajas)
  {
    spaceKey: 'probadores',
    name: 'Jean slim azul 30',
    category: 'jean',
    size: '30',
    color: 'Azul',
    quantity: 10,
    minStock: 4,
    autoMinStock: false,
    barcode: '770100400401',
    soldEvents: [],
  },
  {
    spaceKey: 'probadores',
    name: 'Camiseta estampada S',
    category: 'camiseta',
    size: 'S',
    color: 'Negro',
    quantity: 8,
    minStock: 4,
    autoMinStock: false,
    barcode: '770100400402',
    soldEvents: [],
  },

  // Vitrina -> 20 + 18 + 4 = 42 uds (1 baja)
  {
    spaceKey: 'vitrina',
    name: 'Chaqueta bomber negra M',
    category: 'buzo',
    size: 'M',
    color: 'Negro',
    quantity: 20,
    minStock: 5,
    autoMinStock: false,
    barcode: '770100500501',
    soldEvents: [{daysAgo: 7, qty: 2}],
  },
  {
    spaceKey: 'vitrina',
    name: 'Tenis urbanos blancos 40',
    category: 'zapatos',
    size: '40',
    color: 'Blanco',
    quantity: 18,
    minStock: 5,
    autoMinStock: false,
    barcode: '770100500502',
    soldEvents: [{daysAgo: 10, qty: 2}],
  },
  {
    spaceKey: 'vitrina',
    name: 'Gorra beige logo',
    category: 'gorra',
    size: 'Única',
    color: 'Beige',
    quantity: 4,
    minStock: 6,
    autoMinStock: false,
    barcode: '770100500503',
    soldEvents: [{daysAgo: 2, qty: 2}],
  },
];

export async function loadExampleInventoryData(userId: string): Promise<void> {
  const basePath = `users/${userId}`;
  try {
    // Evita duplicar si ya existen espacios con los mismos nombres
    const existingSpacesSnap = await getDocs(
      query(collection(db, `${basePath}/spaces`), where('userId', '==', userId)),
    );
    const existingNames = new Set(existingSpacesSnap.docs.map((d) => String(d.data().name || '')));
    if (existingNames.has('Estante A') && existingNames.has('Bodega')) {
      return;
    }

    const batch = writeBatch(db);
    const spaceIdMap = new Map<string, string>();

    for (const s of SEED_SPACES) {
      const spaceRef = doc(collection(db, `${basePath}/spaces`));
      spaceIdMap.set(s.key, spaceRef.id);
      batch.set(spaceRef, {
        userId,
        name: s.name,
        type: s.type,
        color: s.color,
        location: s.location,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const now = Date.now();
    const today912 = new Date();
    today912.setHours(9, 12, 0, 0);
    const today840 = new Date();
    today840.setHours(8, 40, 0, 0);
    const yesterday = new Date(now - 24 * 60 * 60 * 1000);

    let camisetaBlancaId = '';
    let jeanAzulId = '';
    let gorraNegraId = '';
    const estanteAId = spaceIdMap.get('estante_a') || '';

    for (const p of SEED_PRODUCTS) {
      const spaceId = spaceIdMap.get(p.spaceKey)!;
      const productRef = doc(collection(db, `${basePath}/products`));

      if (p.name === 'Camiseta blanca M') camisetaBlancaId = productRef.id;
      if (p.name === 'Jean azul 32') jeanAzulId = productRef.id;
      if (p.name === 'Gorra negra') gorraNegraId = productRef.id;

      batch.set(productRef, {
        userId,
        spaceId,
        name: p.name,
        category: p.category,
        size: p.size,
        color: p.color,
        quantity: p.quantity,
        minStock: p.minStock,
        autoMinStock: p.autoMinStock,
        barcode: p.barcode,
        imageUrl: '',
        aiRecognized: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      for (const ev of p.soldEvents) {
        const movRef = doc(collection(db, `${basePath}/movements`));
        const occurredAt =
          p.name === 'Jean azul 32' && ev.daysAgo === 0
            ? today840.toISOString()
            : new Date(now - ev.daysAgo * 24 * 60 * 60 * 1000).toISOString();
        batch.set(movRef, {
          userId,
          productId: productRef.id,
          productName: p.name,
          spaceId,
          type: 'salida',
          quantity: ev.qty,
          note: 'Venta en tienda',
          occurredAt,
          createdAt: serverTimestamp(),
        });
      }
    }

    // Agrega los 3 movimientos recientes del prototipo (Camiseta blanca +12 hoy 9:12, Jean azul -2 hoy 8:40, Gorra negra +6 ayer)
    if (camisetaBlancaId) {
      const movRef = doc(collection(db, `${basePath}/movements`));
      batch.set(movRef, {
        userId,
        productId: camisetaBlancaId,
        productName: 'Camiseta blanca M',
        spaceId: estanteAId,
        type: 'entrada',
        quantity: 12,
        note: 'Reposición de proveedor',
        occurredAt: today912.toISOString(),
        createdAt: serverTimestamp(),
      });
    }

    if (gorraNegraId) {
      const movRef = doc(collection(db, `${basePath}/movements`));
      batch.set(movRef, {
        userId,
        productId: gorraNegraId,
        productName: 'Gorra negra',
        spaceId: estanteAId,
        type: 'entrada',
        quantity: 6,
        note: 'Ingreso de bodega',
        occurredAt: yesterday.toISOString(),
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void jeanAzulId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${basePath}/spaces`);
  }
}
