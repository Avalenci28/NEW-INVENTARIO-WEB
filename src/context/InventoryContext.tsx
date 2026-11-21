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
import {
  createDemoId,
  getDefaultDemoState,
  loadDemoStore,
  saveDemoStore,
  type DemoInventoryState,
} from '../lib/demoStore';
import {
  detectPlatform,
  enableDevicePushNotifications,
  showDeviceNotification,
  type PushEnableResult,
} from '../lib/fcm';
import {auth, db, handleFirestoreError, OperationType} from '../lib/firebase';
import {
  computeAbcStats,
  computeHomeRecommendation,
  computeLowStockAlerts,
} from '../lib/inventoryAnalytics';
import {buildDemoSeedState, loadExampleInventoryData} from '../lib/seedData';
import type {
  AbcProductStats,
  FcmDeviceToken,
  GarmentCategory,
  LowStockAlertItem,
  Movement,
  NotificationPreferences,
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
  expiresAt?: string;
}

interface InventoryContextValue {
  spaces: Space[];
  products: Product[];
  movements: Movement[];
  orders: Order[];
  fcmTokens: FcmDeviceToken[];
  notificationPrefs: NotificationPreferences;
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
  saveNotificationPrefs: (
    prefs: Omit<NotificationPreferences, 'userId' | 'updatedAt'>,
  ) => Promise<void>;
  activatePushNotifications: () => Promise<PushEnableResult>;
  sendTestDeviceNotification: () => Promise<boolean>;
  seedDemoData: () => Promise<void>;
}

const DEFAULT_NOTIFICATION_PREFS: Omit<NotificationPreferences, 'userId'> = {
  pushEnabled: false,
  lowStockEnabled: true,
  expiringEnabled: true,
  expiryWarningDays: 7,
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

export const InventoryProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {user} = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [fcmTokens, setFcmTokens] = useState<FcmDeviceToken[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    userId: '',
    ...DEFAULT_NOTIFICATION_PREFS,
  });
  const [loadingData, setLoadingData] = useState(true);

  const isFirestoreBacked = Boolean(user && auth.currentUser && auth.currentUser.uid === user.uid);

  const commitDemoPatch = useCallback(
    (updater: (prev: DemoInventoryState) => DemoInventoryState) => {
      if (!user) return;
      const current = loadDemoStore(user.uid);
      const next = updater(current);
      saveDemoStore(next);
      setSpaces(next.spaces);
      setProducts(next.products);
      setMovements(next.movements);
      setOrders(next.orders);
      setFcmTokens(next.fcmTokens);
      setNotificationPrefs(next.notificationPrefs);
    },
    [user],
  );

  useEffect(() => {
    if (!user) {
      setSpaces([]);
      setProducts([]);
      setMovements([]);
      setOrders([]);
      setFcmTokens([]);
      setNotificationPrefs({userId: '', ...DEFAULT_NOTIFICATION_PREFS});
      setLoadingData(false);
      return;
    }

    if (!isFirestoreBacked) {
      const demo = loadDemoStore(user.uid);
      setSpaces(demo.spaces);
      setProducts(demo.products);
      setMovements(demo.movements);
      setOrders(demo.orders);
      setFcmTokens(demo.fcmTokens);
      setNotificationPrefs(demo.notificationPrefs);
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

    const tokensPath = `users/${uid}/fcmTokens`;
    const unsubTokens = onSnapshot(
      query(collection(db, tokensPath), where('userId', '==', uid)),
      (snap) => {
        setFcmTokens(
          snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<FcmDeviceToken, 'id'>)})),
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, tokensPath),
    );

    const prefsPath = `users/${uid}/notificationSettings/prefs`;
    const unsubPrefs = onSnapshot(
      doc(db, prefsPath),
      (snap) => {
        if (snap.exists()) {
          setNotificationPrefs(snap.data() as NotificationPreferences);
        } else {
          setNotificationPrefs({
            userId: uid,
            ...DEFAULT_NOTIFICATION_PREFS,
            pushEnabled:
              typeof Notification !== 'undefined' && Notification.permission === 'granted',
          });
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, prefsPath),
    );

    return () => {
      unsubSpaces();
      unsubProducts();
      unsubMovements();
      unsubOrders();
      unsubTokens();
      unsubPrefs();
    };
  }, [user, isFirestoreBacked]);

  const totalUnits = useMemo(
    () => products.reduce((sum, p) => sum + p.quantity, 0),
    [products],
  );

  const abcMap = useMemo(() => computeAbcStats(products, movements), [products, movements]);

  const alerts = useMemo(
    () =>
      computeLowStockAlerts(products, spaces, abcMap, notificationPrefs.expiryWarningDays || 7),
    [products, spaces, abcMap, notificationPrefs.expiryWarningDays],
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
      if (!isFirestoreBacked) {
        const id = createDemoId('space');
        const newSpace: Space = {
          id,
          userId: user.uid,
          name: input.name.trim(),
          type: input.type,
          color: input.color,
          location: input.location.trim(),
        };
        commitDemoPatch((prev) => ({...prev, spaces: [...prev.spaces, newSpace]}));
        return id;
      }

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
    [user, isFirestoreBacked, commitDemoPatch],
  );

  const updateSpace = useCallback(
    async (spaceId: string, input: CreateSpaceInput) => {
      if (!user) throw new Error('Sesión no activa.');
      if (!isFirestoreBacked) {
        commitDemoPatch((prev) => ({
          ...prev,
          spaces: prev.spaces.map((s) =>
            s.id === spaceId
              ? {
                  ...s,
                  name: input.name.trim(),
                  type: input.type,
                  color: input.color,
                  location: input.location.trim(),
                }
              : s,
          ),
        }));
        return;
      }

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
    [user, isFirestoreBacked, commitDemoPatch],
  );

  const deleteSpace = useCallback(
    async (spaceId: string, deleteProductsToo: boolean = false) => {
      if (!user) throw new Error('Sesión no activa.');
      const spaceProducts = products.filter((p) => p.spaceId === spaceId);
      if (spaceProducts.length > 0 && !deleteProductsToo) {
        throw new Error('Este espacio tiene prendas. Mueve o confirma su eliminación primero.');
      }

      if (!isFirestoreBacked) {
        commitDemoPatch((prev) => ({
          ...prev,
          spaces: prev.spaces.filter((s) => s.id !== spaceId),
          products: prev.products.filter((p) => p.spaceId !== spaceId),
        }));
        return;
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
    [user, products, isFirestoreBacked, commitDemoPatch],
  );

  const createProduct = useCallback(
    async (input: CreateProductInput) => {
      if (!user) throw new Error('Sesión no activa.');
      if (!isFirestoreBacked) {
        const id = createDemoId('prod');
        const cleanQty = Math.max(0, Math.round(input.quantity));
        const newProduct: Product = {
          id,
          userId: user.uid,
          spaceId: input.spaceId,
          name: input.name.trim(),
          category: input.category,
          size: input.size.trim(),
          color: input.color.trim(),
          quantity: cleanQty,
          minStock: Math.max(0, Math.round(input.minStock)),
          autoMinStock: Boolean(input.autoMinStock),
          barcode: input.barcode.trim(),
          imageUrl: input.imageUrl,
          aiRecognized: Boolean(input.aiRecognized),
          expiresAt: (input.expiresAt || '').trim(),
        };
        const initialMovement: Movement | null =
          cleanQty > 0
            ? {
                id: createDemoId('mov'),
                userId: user.uid,
                productId: id,
                productName: newProduct.name,
                spaceId: input.spaceId,
                type: 'entrada',
                quantity: cleanQty,
                note: 'Registro inicial',
                occurredAt: new Date().toISOString(),
              }
            : null;

        commitDemoPatch((prev) => ({
          ...prev,
          products: [...prev.products, newProduct],
          movements: initialMovement ? [initialMovement, ...prev.movements] : prev.movements,
        }));
        return id;
      }

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
          expiresAt: (input.expiresAt || '').trim(),
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
    [user, isFirestoreBacked, commitDemoPatch],
  );

  const updateProduct = useCallback(
    async (
      productId: string,
      input: Partial<Omit<CreateProductInput, 'quantity' | 'aiRecognized'>>,
    ) => {
      if (!user) throw new Error('Sesión no activa.');
      if (!isFirestoreBacked) {
        commitDemoPatch((prev) => ({
          ...prev,
          products: prev.products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  spaceId: input.spaceId !== undefined ? input.spaceId : p.spaceId,
                  name: input.name !== undefined ? input.name.trim() : p.name,
                  category: input.category !== undefined ? input.category : p.category,
                  size: input.size !== undefined ? input.size.trim() : p.size,
                  color: input.color !== undefined ? input.color.trim() : p.color,
                  minStock:
                    input.minStock !== undefined
                      ? Math.max(0, Math.round(input.minStock))
                      : p.minStock,
                  autoMinStock:
                    input.autoMinStock !== undefined ? Boolean(input.autoMinStock) : p.autoMinStock,
                  barcode: input.barcode !== undefined ? input.barcode.trim() : p.barcode,
                  imageUrl: input.imageUrl !== undefined ? input.imageUrl : p.imageUrl,
                  expiresAt: input.expiresAt !== undefined ? input.expiresAt.trim() : p.expiresAt,
                }
              : p,
          ),
        }));
        return;
      }

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
      if (input.expiresAt !== undefined) payload.expiresAt = input.expiresAt.trim();

      try {
        await updateDoc(doc(db, path), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user, isFirestoreBacked, commitDemoPatch],
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      if (!user) throw new Error('Sesión no activa.');
      if (!isFirestoreBacked) {
        commitDemoPatch((prev) => ({
          ...prev,
          products: prev.products.filter((p) => p.id !== productId),
        }));
        return;
      }

      const path = `users/${user.uid}/products/${productId}`;
      try {
        await deleteDoc(doc(db, path));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user, isFirestoreBacked, commitDemoPatch],
  );

  const registerMovement = useCallback(
    async (productId: string, type: 'entrada' | 'salida', quantity: number, note: string = '') => {
      if (!user) throw new Error('Sesión no activa.');
      const cleanQty = Math.round(quantity);
      if (cleanQty <= 0) throw new Error('La cantidad debe ser mayor a 0.');

      if (!isFirestoreBacked) {
        const current = loadDemoStore(user.uid);
        const prod = current.products.find((p) => p.id === productId);
        if (!prod) throw new Error('La prenda no existe.');
        const nextQty = type === 'entrada' ? prod.quantity + cleanQty : prod.quantity - cleanQty;
        if (nextQty < 0) {
          throw new Error(`No hay suficiente stock. Solo quedan ${prod.quantity} unidades.`);
        }
        const mov: Movement = {
          id: createDemoId('mov'),
          userId: user.uid,
          productId,
          productName: prod.name,
          spaceId: prod.spaceId,
          type,
          quantity: cleanQty,
          note: note.trim() || (type === 'entrada' ? 'Entrada manual' : 'Salida / venta'),
          occurredAt: new Date().toISOString(),
        };
        commitDemoPatch((prev) => ({
          ...prev,
          products: prev.products.map((p) => (p.id === productId ? {...p, quantity: nextQty} : p)),
          movements: [mov, ...prev.movements],
        }));
        return;
      }

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
    [user, isFirestoreBacked, commitDemoPatch],
  );

  const addAlertToDraftOrder = useCallback(
    async (alert: LowStockAlertItem) => {
      if (!user) throw new Error('Sesión no activa.');
      const newItem: OrderItem = {
        productId: alert.product.id,
        productName: alert.product.name,
        size: alert.product.size,
        category: alert.product.category,
        currentQty: alert.product.quantity,
        suggestedQty: alert.suggestedQty,
        finalQty: alert.suggestedQty,
      };

      if (!isFirestoreBacked) {
        commitDemoPatch((prev) => {
          const draft = prev.orders.find((o) => o.status === 'borrador');
          if (draft) {
            const existsIdx = draft.items.findIndex((i) => i.productId === alert.product.id);
            const nextItems =
              existsIdx >= 0
                ? draft.items.map((item, idx) =>
                    idx === existsIdx ? {...item, finalQty: alert.suggestedQty} : item,
                  )
                : [...draft.items, newItem].slice(0, 50);
            return {
              ...prev,
              orders: prev.orders.map((o) => (o.id === draft.id ? {...o, items: nextItems} : o)),
            };
          }
          const newOrder: Order = {
            id: createDemoId('order'),
            userId: user.uid,
            status: 'borrador',
            items: [newItem],
            notes: '',
          };
          return {...prev, orders: [...prev.orders, newOrder]};
        });
        return;
      }

      const basePath = `users/${user.uid}`;
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
    [user, activeDraftOrder, isFirestoreBacked, commitDemoPatch],
  );

  const createOrReplaceDraftOrder = useCallback(
    async (items: OrderItem[], notes: string = '') => {
      if (!user) throw new Error('Sesión no activa.');
      if (items.length === 0) throw new Error('El pedido debe tener al menos una prenda.');

      if (!isFirestoreBacked) {
        let createdId = activeDraftOrder?.id || createDemoId('order');
        commitDemoPatch((prev) => {
          const draft = prev.orders.find((o) => o.status === 'borrador');
          if (draft) {
            createdId = draft.id;
            const mergedMap = new Map<string, OrderItem>();
            for (const existing of draft.items) mergedMap.set(existing.productId, existing);
            for (const incoming of items) mergedMap.set(incoming.productId, incoming);
            return {
              ...prev,
              orders: prev.orders.map((o) =>
                o.id === draft.id
                  ? {
                      ...o,
                      items: Array.from(mergedMap.values()).slice(0, 50),
                      notes: notes.trim(),
                    }
                  : o,
              ),
            };
          }
          const newOrder: Order = {
            id: createdId,
            userId: user.uid,
            status: 'borrador',
            items: items.slice(0, 50),
            notes: notes.trim(),
          };
          return {...prev, orders: [...prev.orders, newOrder]};
        });
        return createdId;
      }

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
    [user, activeDraftOrder, isFirestoreBacked, commitDemoPatch],
  );

  const updateOrderItems = useCallback(
    async (orderId: string, items: OrderItem[], notes: string) => {
      if (!user) throw new Error('Sesión no activa.');
      if (!isFirestoreBacked) {
        commitDemoPatch((prev) => ({
          ...prev,
          orders:
            items.length === 0
              ? prev.orders.filter((o) => o.id !== orderId)
              : prev.orders.map((o) =>
                  o.id === orderId ? {...o, items: items.slice(0, 50), notes: notes.trim()} : o,
                ),
        }));
        return;
      }

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
    [user, isFirestoreBacked, commitDemoPatch],
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: 'borrador' | 'enviado' | 'recibido') => {
      if (!user) throw new Error('Sesión no activa.');
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      if (!isFirestoreBacked) {
        if (status === 'recibido') {
          for (const item of order.items) {
            const exists = products.some((p) => p.id === item.productId);
            if (exists && item.finalQty > 0) {
              await registerMovement(item.productId, 'entrada', item.finalQty, 'Pedido recibido');
            }
          }
        }
        commitDemoPatch((prev) => ({
          ...prev,
          orders: prev.orders.map((o) => (o.id === orderId ? {...o, status} : o)),
        }));
        return;
      }

      const basePath = `users/${user.uid}`;
      const orderPath = `${basePath}/orders/${orderId}`;

      try {
        if (status === 'recibido') {
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
    [user, orders, products, registerMovement, isFirestoreBacked, commitDemoPatch],
  );

  const saveNotificationPrefs = useCallback(
    async (prefs: Omit<NotificationPreferences, 'userId' | 'updatedAt'>) => {
      if (!user) throw new Error('Sesión no activa.');
      const cleanPrefs: NotificationPreferences = {
        userId: user.uid,
        pushEnabled: Boolean(prefs.pushEnabled),
        lowStockEnabled: Boolean(prefs.lowStockEnabled),
        expiringEnabled: Boolean(prefs.expiringEnabled),
        expiryWarningDays: Math.max(1, Math.min(60, Math.round(prefs.expiryWarningDays))),
      };

      if (!isFirestoreBacked) {
        commitDemoPatch((prev) => ({...prev, notificationPrefs: cleanPrefs}));
        return;
      }

      const path = `users/${user.uid}/notificationSettings/prefs`;
      try {
        await setDoc(doc(db, path), {
          ...cleanPrefs,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [user, isFirestoreBacked, commitDemoPatch],
  );

  const activatePushNotifications = useCallback(async () => {
    if (!user) throw new Error('Sesión no activa.');
    const result = await enableDevicePushNotifications(user.uid);
    if (result.permission === 'granted') {
      if (!isFirestoreBacked && result.fcmToken) {
        commitDemoPatch((prev) => ({
          ...prev,
          fcmTokens: [
            {
              id: 'demo_device',
              userId: user.uid,
              token: result.fcmToken!,
              platform: detectPlatform(),
              deviceLabel: `${detectPlatform().toUpperCase()} · Demo`,
              enabled: true,
            },
          ],
        }));
      }
      await saveNotificationPrefs({
        ...notificationPrefs,
        pushEnabled: true,
      });
    }
    return result;
  }, [user, notificationPrefs, saveNotificationPrefs, isFirestoreBacked, commitDemoPatch]);

  const sendTestDeviceNotification = useCallback(async () => {
    const topAlert = alerts[0];
    const title = topAlert
      ? topAlert.severity === 'caducada' || topAlert.severity === 'proxima_a_caducar'
        ? `Por caducar: ${topAlert.product.name}`
        : `Stock bajo: ${topAlert.product.name}`
      : 'Inventario Fácil IA · Alertas activas';
    const body = topAlert
      ? `${topAlert.contextText}. Quedan ${topAlert.product.quantity} uds en ${topAlert.spaceName}.`
      : 'Las notificaciones push en este dispositivo están funcionando correctamente.';

    return showDeviceNotification({
      title,
      body,
      tag: 'inventario-test-push',
      url: '/alertas',
    });
  }, [alerts]);

  const seedDemoData = useCallback(async () => {
    if (!user) throw new Error('Sesión no activa.');
    if (!isFirestoreBacked) {
      commitDemoPatch((prev) => {
        const existingNames = new Set(prev.spaces.map((s) => s.name));
        if (existingNames.has('Estante A') && existingNames.has('Bodega')) {
          return prev;
        }
        const seeded = buildDemoSeedState(user.uid);
        return {
          ...(prev.spaces.length === 0 ? getDefaultDemoState(user.uid) : prev),
          spaces: [...prev.spaces, ...seeded.spaces],
          products: [...prev.products, ...seeded.products],
          movements: [...seeded.movements, ...prev.movements],
        };
      });
      return;
    }
    await loadExampleInventoryData(user.uid);
  }, [user, isFirestoreBacked, commitDemoPatch]);

  return (
    <InventoryContext.Provider
      value={{
        spaces,
        products,
        movements,
        orders,
        fcmTokens,
        notificationPrefs,
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
        saveNotificationPrefs,
        activatePushNotifications,
        sendTestDeviceNotification,
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
