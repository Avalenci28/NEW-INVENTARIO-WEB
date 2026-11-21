import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {db, handleFirestoreError, OperationType} from '../lib/firebase';
import {
  computeAbcStats,
  computeHomeRecommendation,
  computeLowStockAlerts,
} from '../lib/inventoryAnalytics';
import {loadExampleInventoryData} from '../lib/seedData';
import type {
  AbcProductStats,
  GarmentCategory,
  LowStockAlertItem,
  Movement,
  Order,
  OrderItem,
  Product,
  Space,
  SpaceColor,
  SpaceType,
} from '../types/inventory';
import {useAuth} from './AuthContext';

interface CreateSpaceInput {
  name: string;
  type: SpaceType;
  color: SpaceColor;
  location: string;
}

interface CreateProductInput {
  spaceId: string;
  name: string;
  category: GarmentCategory;
  size: string;
  color: string;
  quantity: number;
  minStock: number;
  autoMinStock: boolean;
  barcode: string;
  imageUrl: string;
  aiRecognized: boolean;
}

interface InventoryContextValue {
  spaces: Space[];
  products: Product[];
  movements: Movement[];
  orders: Order[];
  activeDraftOrder: Order | null;
  loadingData: boolean;
  totalUnits: number;
  abcMap: Map<string, AbcProductStats>;
  alerts: LowStockAlertItem[];
  homeRecommendation: {text: string; focusProductId: string | null};
  createSpace: (input: CreateSpaceInput) => Promise<string>;
  updateSpace: (spaceId: string, input: CreateSpaceInput) => Promise<void>;
  deleteSpace: (spaceId: string, deleteProductsToo?: boolean) => Promise<void>;
  createProduct: (input: CreateProductInput) => Promise<string>;
  updateProduct: (
    productId: string,
    input: Partial<Omit<CreateProductInput, 'quantity' | 'aiRecognized'>>,
  ) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  registerMovement: (
    productId: string,
    type: 'entrada' | 'salida',
    quantity: number,
    note?: string,
  ) => Promise<void>;
  addAlertToDraftOrder: (alert: LowStockAlertItem) => Promise<void>;
  createOrReplaceDraftOrder: (items: OrderItem[], notes?: string) => Promise<string>;
  updateOrderItems: (orderId: string, items: OrderItem[], notes: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: 'borrador' | 'enviado' | 'recibido') => Promise<void>;
  seedDemoData: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export const InventoryProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {user} = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!user) {
      setSpaces([]);
      setProducts([]);
      setMovements([]);
      setOrders([]);
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    const uid = user.uid;
    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= 4) setLoadingData(false);
    };

    const spacesPath = `users/${uid}/spaces`;
    const unsubSpaces = onSnapshot(
      query(collection(db, spacesPath), where('userId', '==', uid)),
      (snap) => {
        setSpaces(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Space, 'id'>)})));
        markLoaded();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, spacesPath),
    );

    const productsPath = `users/${uid}/products`;
    const unsubProducts = onSnapshot(
      query(collection(db, productsPath), where('userId', '==', uid)),
      (snap) => {
        setProducts(snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Product, 'id'>)})));
        markLoaded();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, productsPath),
    );

    const movementsPath = `users/${uid}/movements`;
    const unsubMovements = onSnapshot(
      query(collection(db, movementsPath), where('userId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Movement, 'id'>)}));
        list.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
        setMovements(list);
        markLoaded();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, movementsPath),
    );

    const ordersPath = `users/${uid}/orders`;
    const unsubOrders = onSnapshot(
      query(collection(db, ordersPath), where('userId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Order, 'id'>)}));
        setOrders(list);
        markLoaded();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, ordersPath),
    );

    return () => {
      unsubSpaces();
      unsubProducts();
      unsubMovements();
      unsubOrders();
    };
  }, [user]);

  const totalUnits = useMemo(
    () => products.reduce((sum, p) => sum + p.quantity, 0),
    [products],
  );

  const abcMap = useMemo(() => computeAbcStats(products, movements), [products, movements]);

  const alerts = useMemo(
    () => computeLowStockAlerts(products, spaces, abcMap),
    [products, spaces, abcMap],
  );

  const homeRecommendation = useMemo(
    () => computeHomeRecommendation(alerts, products, abcMap),
    [alerts, products, abcMap],
  );

  const activeDraftOrder = useMemo(
    () => orders.find((o) => o.status === 'borrador') || null,
    [orders],
  );

  const createSpace = useCallback(
    async (input: CreateSpaceInput) => {
      if (!user) throw new Error('Sesión no activa.');
      const path = `users/${user.uid}/spaces`;
      const ref = doc(collection(db, path));
      try {
        await setDoc(ref, {
          userId: user.uid,
          name: input.name.trim(),
          type: input.type,
          color: input.color,
          location: input.location.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return ref.id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `${path}/${ref.id}`);
      }
    },
    [user],
  );

  const updateSpace = useCallback(
    async (spaceId: string, input: CreateSpaceInput) => {
      if (!user) throw new Error('Sesión no activa.');
      const path = `users/${user.uid}/spaces/${spaceId}`;
      try {
        await updateDoc(doc(db, path), {
          name: input.name.trim(),
          type: input.type,
          color: input.color,
          location: input.location.trim(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user],
  );

  const deleteSpace = useCallback(
    async (spaceId: string, deleteProductsToo: boolean = false) => {
      if (!user) throw new Error('Sesión no activa.');
      const spaceProducts = products.filter((p) => p.spaceId === spaceId);
      if (spaceProducts.length > 0 && !deleteProductsToo) {
        throw new Error('Este espacio tiene prendas. Mueve o confirma su eliminación primero.');
      }
      const basePath = `users/${user.uid}`;
      try {
        const batch = writeBatch(db);
        for (const p of spaceProducts) {
          batch.delete(doc(db, `${basePath}/products/${p.id}`));
        }
        batch.delete(doc(db, `${basePath}/spaces/${spaceId}`));
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `${basePath}/spaces/${spaceId}`);
      }
    },
    [user, products],
  );

  const createProduct = useCallback(
    async (input: CreateProductInput) => {
      if (!user) throw new Error('Sesión no activa.');
      const basePath = `users/${user.uid}`;
      const productRef = doc(collection(db, `${basePath}/products`));
      try {
        const batch = writeBatch(db);
        batch.set(productRef, {
          userId: user.uid,
          spaceId: input.spaceId,
          name: input.name.trim(),
          category: input.category,
          size: input.size.trim(),
          color: input.color.trim(),
          quantity: Math.max(0, Math.round(input.quantity)),
          minStock: Math.max(0, Math.round(input.minStock)),
          autoMinStock: Boolean(input.autoMinStock),
          barcode: input.barcode.trim(),
          imageUrl: input.imageUrl,
          aiRecognized: Boolean(input.aiRecognized),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (input.quantity > 0) {
          const movRef = doc(collection(db, `${basePath}/movements`));
          batch.set(movRef, {
            userId: user.uid,
            productId: productRef.id,
            productName: input.name.trim(),
            spaceId: input.spaceId,
            type: 'entrada',
            quantity: Math.round(input.quantity),
            note: 'Registro inicial',
            occurredAt: new Date().toISOString(),
            createdAt: serverTimestamp(),
          });
        }
        await batch.commit();
        return productRef.id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `${basePath}/products/${productRef.id}`);
      }
    },
    [user],
  );

  const updateProduct = useCallback(
    async (
      productId: string,
      input: Partial<Omit<CreateProductInput, 'quantity' | 'aiRecognized'>>,
    ) => {
      if (!user) throw new Error('Sesión no activa.');
      const path = `users/${user.uid}/products/${productId}`;
      const payload: Record<string, unknown> = {updatedAt: serverTimestamp()};
      if (input.spaceId !== undefined) payload.spaceId = input.spaceId;
      if (input.name !== undefined) payload.name = input.name.trim();
      if (input.category !== undefined) payload.category = input.category;
      if (input.size !== undefined) payload.size = input.size.trim();
      if (input.color !== undefined) payload.color = input.color.trim();
      if (input.minStock !== undefined) payload.minStock = Math.max(0, Math.round(input.minStock));
      if (input.autoMinStock !== undefined) payload.autoMinStock = Boolean(input.autoMinStock);
      if (input.barcode !== undefined) payload.barcode = input.barcode.trim();
      if (input.imageUrl !== undefined) payload.imageUrl = input.imageUrl;

      try {
        await updateDoc(doc(db, path), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user],
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      if (!user) throw new Error('Sesión no activa.');
      const path = `users/${user.uid}/products/${productId}`;
      try {
        await deleteDoc(doc(db, path));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user],
  );

  const registerMovement = useCallback(
    async (productId: string, type: 'entrada' | 'salida', quantity: number, note: string = '') => {
      if (!user) throw new Error('Sesión no activa.');
      const cleanQty = Math.round(quantity);
      if (cleanQty <= 0) throw new Error('La cantidad debe ser mayor a 0.');

      const basePath = `users/${user.uid}`;
      const productRef = doc(db, `${basePath}/products/${productId}`);
      const movRef = doc(collection(db, `${basePath}/movements`));

      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(productRef);
          if (!snap.exists()) {
            throw new Error('La prenda no existe.');
          }
          const data = snap.data() as Product;
          const nextQty = type === 'entrada' ? data.quantity + cleanQty : data.quantity - cleanQty;
          if (nextQty < 0) {
            throw new Error(`No hay suficiente stock. Solo quedan ${data.quantity} unidades.`);
          }

          tx.update(productRef, {
            quantity: nextQty,
            updatedAt: serverTimestamp(),
          });

          tx.set(movRef, {
            userId: user.uid,
            productId,
            productName: data.name,
            spaceId: data.spaceId,
            type,
            quantity: cleanQty,
            note: note.trim() || (type === 'entrada' ? 'Entrada manual' : 'Salida / venta'),
            occurredAt: new Date().toISOString(),
            createdAt: serverTimestamp(),
          });
        });
      } catch (err) {
        if (
          err instanceof Error &&
          (err.message.includes('No hay suficiente stock') || err.message.includes('no existe'))
        ) {
          throw err;
        }
        handleFirestoreError(err, OperationType.WRITE, `${basePath}/products/${productId}`);
      }
    },
    [user],
  );

  const addAlertToDraftOrder = useCallback(
    async (alert: LowStockAlertItem) => {
      if (!user) throw new Error('Sesión no activa.');
      const basePath = `users/${user.uid}`;
      const newItem: OrderItem = {
        productId: alert.product.id,
        productName: alert.product.name,
        size: alert.product.size,
        category: alert.product.category,
        currentQty: alert.product.quantity,
        suggestedQty: alert.suggestedQty,
        finalQty: alert.suggestedQty,
      };

      try {
        if (activeDraftOrder) {
          const existsIdx = activeDraftOrder.items.findIndex(
            (i) => i.productId === alert.product.id,
          );
          const nextItems =
            existsIdx >= 0
              ? activeDraftOrder.items.map((item, idx) =>
                  idx === existsIdx ? {...item, finalQty: alert.suggestedQty} : item,
                )
              : [...activeDraftOrder.items, newItem].slice(0, 50);

          await updateDoc(doc(db, `${basePath}/orders/${activeDraftOrder.id}`), {
            items: nextItems,
            updatedAt: serverTimestamp(),
          });
        } else {
          const orderRef = doc(collection(db, `${basePath}/orders`));
          await setDoc(orderRef, {
            userId: user.uid,
            status: 'borrador',
            items: [newItem],
            notes: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `${basePath}/orders`);
      }
    },
    [user, activeDraftOrder],
  );

  const createOrReplaceDraftOrder = useCallback(
    async (items: OrderItem[], notes: string = '') => {
      if (!user) throw new Error('Sesión no activa.');
      if (items.length === 0) throw new Error('El pedido debe tener al menos una prenda.');
      const basePath = `users/${user.uid}`;
      try {
        if (activeDraftOrder) {
          const mergedMap = new Map<string, OrderItem>();
          for (const existing of activeDraftOrder.items) {
            mergedMap.set(existing.productId, existing);
          }
          for (const incoming of items) {
            mergedMap.set(incoming.productId, incoming);
          }
          await updateDoc(doc(db, `${basePath}/orders/${activeDraftOrder.id}`), {
            items: Array.from(mergedMap.values()).slice(0, 50),
            notes: notes.trim(),
            updatedAt: serverTimestamp(),
          });
          return activeDraftOrder.id;
        }
        const orderRef = doc(collection(db, `${basePath}/orders`));
        await setDoc(orderRef, {
          userId: user.uid,
          status: 'borrador',
          items: items.slice(0, 50),
          notes: notes.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return orderRef.id;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `${basePath}/orders`);
      }
    },
    [user, activeDraftOrder],
  );

  const updateOrderItems = useCallback(
    async (orderId: string, items: OrderItem[], notes: string) => {
      if (!user) throw new Error('Sesión no activa.');
      const path = `users/${user.uid}/orders/${orderId}`;
      if (items.length === 0) {
        try {
          await deleteDoc(doc(db, path));
          return;
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      }
      try {
        await updateDoc(doc(db, path), {
          items: items.slice(0, 50),
          notes: notes.trim(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user],
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: 'borrador' | 'enviado' | 'recibido') => {
      if (!user) throw new Error('Sesión no activa.');
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      const basePath = `users/${user.uid}`;
      const orderPath = `${basePath}/orders/${orderId}`;

      try {
        if (status === 'recibido') {
          // Al marcar como recibido, ingresa las unidades al stock automáticamente
          for (const item of order.items) {
            const exists = products.some((p) => p.id === item.productId);
            if (exists && item.finalQty > 0) {
              await registerMovement(item.productId, 'entrada', item.finalQty, 'Pedido recibido');
            }
          }
        }
        await updateDoc(doc(db, orderPath), {
          status,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, orderPath);
      }
    },
    [user, orders, products, registerMovement],
  );

  const seedDemoData = useCallback(async () => {
    if (!user) throw new Error('Sesión no activa.');
    await loadExampleInventoryData(user.uid);
  }, [user]);

  return (
    <InventoryContext.Provider
      value={{
        spaces,
        products,
        movements,
        orders,
        activeDraftOrder,
        loadingData,
        totalUnits,
        abcMap,
        alerts,
        homeRecommendation,
        createSpace,
        updateSpace,
        deleteSpace,
        createProduct,
        updateProduct,
        deleteProduct,
        registerMovement,
        addAlertToDraftOrder,
        createOrReplaceDraftOrder,
        updateOrderItems,
        updateOrderStatus,
        seedDemoData,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) {
    throw new Error('useInventory debe usarse dentro de InventoryProvider');
  }
  return ctx;
}
