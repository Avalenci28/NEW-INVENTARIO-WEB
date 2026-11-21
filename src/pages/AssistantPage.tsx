import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {Bot, ExternalLink, Globe, Loader2, Send, ShoppingBag} from 'lucide-react';
import {GarmentThumbnail} from '../components/GarmentThumbnail';
import {MobileShell} from '../components/MobileShell';
import {OrderDraftSheet} from '../components/OrderDraftSheet';
import {useAuth} from '../context/AuthContext';
import {useInventory} from '../context/InventoryContext';
import {useToast} from '../context/ToastContext';
import type {GarmentCategory, OrderItem} from '../types/inventory';

interface AssistantSuggestedItem {
  productId: string;
  nombre: string;
  size: string;
  category: GarmentCategory;
  quedan: number;
  pedir: number;
}

interface GroundingSource {
  title: string;
  uri: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  items?: AssistantSuggestedItem[];
  askToCreateOrder?: boolean;
  sources?: GroundingSource[];
}

const SUGGESTED_CHIPS = [
  '¿Qué debo pedir esta semana?',
  '¿Qué productos rotan más?',
  'Resumen de stock bajo',
  'Tendencias de ropa en Colombia',
];

export const AssistantPage: React.FC = () => {
  const {profile} = useAuth();
  const {
    spaces,
    products,
    totalUnits,
    abcMap,
    alerts,
    activeDraftOrder,
    createOrReplaceDraftOrder,
  } = useInventory();
  const {showToast} = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [sending, setSending] = useState(false);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);

  const autoTriggeredRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const inventoryContext = useMemo(() => {
    const spaceNameById = new Map(spaces.map((s) => [s.id, s.name]));

    const recommendations = alerts.slice(0, 12).map((a) => ({
      productId: a.product.id,
      name: a.product.name,
      size: a.product.size,
      category: a.product.category,
      quantity: a.product.quantity,
      minStock: a.product.minStock,
      suggestedQty: a.suggestedQty,
      abcClass: a.abcClass,
      daysRemaining: a.daysRemaining,
      reason: a.contextText,
    }));

    const topMovers = Array.from(abcMap.values())
      .filter((s) => s.sold30d > 0)
      .sort((a, b) => b.sold30d - a.sold30d)
      .slice(0, 6)
      .map((s) => ({
        name: s.product.name,
        sold30d: s.sold30d,
        abcClass: s.abcClass,
      }));

    const inventoryItems = products.slice(0, 60).map((p) => ({
      name: p.name,
      size: p.size || 'Única',
      category: p.category,
      quantity: p.quantity,
      minStock: p.minStock,
      spaceName: spaceNameById.get(p.spaceId) || 'Sin espacio',
      abcClass: abcMap.get(p.id)?.abcClass || ('C' as const),
    }));

    return {
      businessName: profile?.businessName || 'Mi tienda de ropa',
      totalUnits,
      totalSpaces: spaces.length,
      lowStockCount: alerts.length,
      recommendations,
      topMovers,
      inventoryItems,
    };
  }, [profile?.businessName, totalUnits, spaces, products, alerts, abcMap]);

  const sendQuestion = useCallback(
    async (questionText: string, forceWebSearch?: boolean) => {
      const clean = questionText.trim();
      if (!clean || sending) return;

      const historyPayload = messages
        .filter((m) => m.id !== 'welcome-ai')
        .slice(-12)
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: clean,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setSending(true);

      try {
        const bodyPayload = JSON.stringify({
          question: clean,
          history: historyPayload,
          useWebSearch: forceWebSearch ?? useWebSearch,
          inventoryContext,
        });

        type AssistantApiPayload = {
          text?: string;
          items?: AssistantSuggestedItem[];
          askToCreateOrder?: boolean;
          sources?: GroundingSource[];
          error?: string;
        };

        let data: AssistantApiPayload | null = null;

        for (let attempt = 0; attempt < 2; attempt++) {
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), 20000);
          try {
            const res = await fetch('/api/assistant', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              cache: 'no-store',
              credentials: 'same-origin',
              signal: controller.signal,
              body: bodyPayload,
            });
            window.clearTimeout(timeoutId);

            const rawText = await res.text();
            let parsed: AssistantApiPayload | null = null;
            if (rawText) {
              try {
                parsed = JSON.parse(rawText) as AssistantApiPayload;
              } catch {
                parsed = null;
              }
            }

            if (!parsed) {
              if ((res.status === 502 || res.status === 504) && attempt === 0) {
                await new Promise((r) => window.setTimeout(r, 400));
                continue;
              }
              data = {
                error: 'El asistente tardó en responder. Intenta enviar tu pregunta de nuevo.',
              };
              break;
            }

            data = parsed;
            break;
          } catch (err) {
            window.clearTimeout(timeoutId);
            if (attempt === 0) {
              await new Promise((r) => window.setTimeout(r, 350));
              continue;
            }
            throw err;
          }
        }

        const replyMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text:
            data?.text ||
            data?.error ||
            'No pude consultar con Gemini en este momento. Intenta de nuevo.',
          items: data?.items,
          askToCreateOrder: data?.askToCreateOrder,
          sources: data?.sources,
        };
        setMessages((prev) => [...prev, replyMsg]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text:
              typeof navigator !== 'undefined' && navigator.onLine === false
                ? 'Sin conexión a internet. Verifica tu Wi-Fi o datos móviles e intenta de nuevo.'
                : 'No pudimos conectar con Gemini en este momento. Intenta enviar tu pregunta de nuevo.',
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [sending, messages, useWebSearch, inventoryContext],
  );

  // Al iniciar o venir desde "Ver sugerencia" en Inicio, dispara la consulta principal
  useEffect(() => {
    if (autoTriggeredRef.current) return;
    if (products.length === 0 && messages.length === 0) {
      autoTriggeredRef.current = true;
      setMessages([
        {
          id: 'welcome-ai',
          role: 'assistant',
          text: '¡Hola! Soy tu asistente con Gemini. Cuando agregues prendas podré decirte qué se vende más, qué pedir cada semana o consultar tendencias en Google.',
        },
      ]);
      return;
    }

    if (products.length > 0 && messages.length === 0) {
      autoTriggeredRef.current = true;
      const initialQ =
        searchParams.get('auto') === '1'
          ? '¿Qué debo pedir esta semana?'
          : '¿Qué debo pedir esta semana?';
      void sendQuestion(initialQ, false);
    }
  }, [products.length, messages.length, searchParams, sendQuestion]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages, sending]);

  const handleCreateOrder = async (items: AssistantSuggestedItem[]) => {
    const orderItems: OrderItem[] = items.map((i) => ({
      productId: i.productId,
      productName: i.nombre,
      size: i.size || '',
      category: i.category || 'otro',
      currentQty: i.quedan,
      suggestedQty: i.pedir,
      finalQty: i.pedir,
    }));
    try {
      await createOrReplaceDraftOrder(orderItems);
      setOrderSheetOpen(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo crear el pedido.', 'error');
    }
  };

  return (
    <MobileShell>
      <div className="flex min-h-full flex-col">
        {/* Encabezado */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 pt-[calc(14px+env(safe-area-inset-top,0px))] pb-3 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E6EEFF] text-[#1F69FC]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-[#071C2D]">Asistente IA</h1>
              <p className="text-[11px] font-medium text-[#5C7B98]">Conoce tu inventario</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUseWebSearch((v) => !v)}
              aria-pressed={useWebSearch}
              className={`flex min-h-[36px] items-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition-colors ${
                useWebSearch
                  ? 'bg-[#1F69FC] text-white'
                  : 'border border-slate-200 bg-slate-50 text-[#5C7B98]'
              }`}
              title="Activar búsqueda en Google para datos y tendencias actuales"
            >
              <Globe className="h-3.5 w-3.5" />
              Web
            </button>

            {activeDraftOrder && (
              <button
                type="button"
                onClick={() => setOrderSheetOpen(true)}
                className="flex min-h-[36px] items-center gap-1.5 rounded-full bg-[#0A1F32] px-3 text-xs font-bold text-white"
              >
                <ShoppingBag className="h-3.5 w-3.5 text-[#EF8D2A]" />
                Pedido ({activeDraftOrder.items.length})
              </button>
            )}
          </div>
        </header>

        {/* Chips sugeridos */}
        <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1 no-scrollbar">
          {SUGGESTED_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => void sendQuestion(chip)}
              className="min-h-[34px] shrink-0 rounded-full border border-[#1F69FC]/25 bg-white px-3.5 text-xs font-semibold text-[#1F69FC]"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Conversación */}
        <div className="flex-1 space-y-3 px-4 pt-3 pb-24">
          {messages.map((msg) =>
            msg.role === 'user' ? (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[82%] rounded-[18px] rounded-br-sm bg-[#1F69FC] px-4 py-2.5 text-sm font-semibold text-white shadow-xs">
                  {msg.text}
                </div>
              </div>
            ) : (
              <div key={msg.id} className="flex justify-start">
                <div className="w-full max-w-[94%] rounded-[18px] rounded-bl-sm border border-slate-200/80 bg-white p-4 card-shadow">
                  <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-[#071C2D]">
                    {msg.text}
                  </p>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 border-t border-slate-100 pt-2.5">
                      <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-[#5C7B98]">
                        <Globe className="h-3 w-3 text-[#1F69FC]" />
                        Fuentes en Google
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((src) => (
                          <a
                            key={src.uri}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold text-[#1F69FC]"
                          >
                            <span className="truncate max-w-[180px]">{src.title}</span>
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.items && msg.items.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.items.map((item) => (
                        <div
                          key={item.productId}
                          className="flex items-center gap-3 rounded-[12px] bg-[#F8FAFC] p-2.5 border border-slate-100"
                        >
                          <GarmentThumbnail
                            category={item.category || 'otro'}
                            name={item.nombre}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#071C2D]">
                              {item.nombre}
                            </p>
                            <p className="text-xs font-semibold text-[#5C7B98] tabular-nums">
                              Quedan {item.quedan} · pedir {item.pedir}
                            </p>
                          </div>
                        </div>
                      ))}

                      {msg.askToCreateOrder && (
                        <div className="pt-2">
                          <p className="mb-2.5 text-xs font-medium text-[#5C7B98]">
                            ¿Quieres que arme el pedido?
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => void handleCreateOrder(msg.items!)}
                              className="min-h-[44px] rounded-[12px] bg-[#EF8D2A] px-3 text-xs font-bold text-white shadow-xs active:scale-95"
                            >
                              Crear pedido
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate('/alertas')}
                              className="min-h-[44px] rounded-[12px] border border-slate-200 bg-white px-3 text-xs font-bold text-[#071C2D]"
                            >
                              Ver detalle
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}

          {sending && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-[#5C7B98]">
                <Loader2 className="h-4 w-4 animate-spin text-[#1F69FC]" />
                {useWebSearch ? 'Consultando con Gemini y Google...' : 'Analizando tu inventario...'}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Caja de mensaje fija sobre la barra inferior */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendQuestion(input);
          }}
          className="fixed bottom-[calc(70px+env(safe-area-inset-bottom,0px))] left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 items-center gap-2 border-t border-slate-200/80 bg-[#F8FAFC]/95 px-3 py-2.5 backdrop-blur-md"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              useWebSearch ? 'Pregunta con búsqueda en Google...' : 'Pregúntale a tu inventario...'
            }
            maxLength={500}
            className="min-h-[46px] flex-1 rounded-full border border-slate-200 bg-white px-4 text-base text-[#071C2D] placeholder:text-slate-400 focus:border-[#1F69FC] focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Enviar pregunta"
            disabled={sending || !input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1F69FC] text-white shadow-sm disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      <OrderDraftSheet
        order={activeDraftOrder}
        open={orderSheetOpen}
        onClose={() => setOrderSheetOpen(false)}
      />
    </MobileShell>
  );
};
