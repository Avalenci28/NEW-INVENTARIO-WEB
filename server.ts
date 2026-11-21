import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import path from 'path';
import fs from 'fs';
import {fileURLToPath} from 'url';
import {GoogleGenAI, ThinkingLevel, Type} from '@google/genai';
import {z} from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = 'gemini-4-hydrogen';
const GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

app.use(express.json({limit: '8mb'}));

app.get('/api/health', (_req, res) => {
  res.json({ok: true});
});

// Configuración pública de Firebase Web para el Service Worker de FCM
app.get('/firebase-sw-config.js', (_req, res) => {
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    const publicConfig = {
      apiKey: raw.apiKey,
      authDomain: raw.authDomain,
      projectId: raw.projectId,
      storageBucket: raw.storageBucket,
      messagingSenderId: raw.messagingSenderId,
      appId: raw.appId,
    };
    res.type('application/javascript');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(`self.__FIREBASE_CONFIG__ = ${JSON.stringify(publicConfig)};`);
  } catch {
    res.type('application/javascript').status(200).send('self.__FIREBASE_CONFIG__ = null;');
  }
});

// Inicio de sesión de demostración académica (sin redirecciones ni popups externos)
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const DEMO_USER = (process.env.DEMO_USER || 'admin').trim();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'admin';
const DEMO_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function safeEqualText(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function signDemoToken(uid: string): string {
  const payload = Buffer.from(
    JSON.stringify({uid, exp: Date.now() + DEMO_SESSION_TTL_MS}),
    'utf-8',
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyDemoToken(token: string): {uid: string; exp: number} | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  if (!safeEqualText(sig, expectedSig)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      uid?: string;
      exp?: number;
    };
    if (!parsed.uid || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return {uid: parsed.uid, exp: parsed.exp};
  } catch {
    return null;
  }
}

const DemoLoginSchema = z.object({
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(120),
});

app.post('/api/demo-login', (req, res) => {
  const parsed = DemoLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({error: 'Ingresa tu usuario y contraseña.'});
    return;
  }

  const cleanUser = parsed.data.username.trim();
  const userMatch = safeEqualText(cleanUser, DEMO_USER);
  const passMatch = safeEqualText(parsed.data.password, DEMO_PASSWORD);

  if (!userMatch || !passMatch) {
    res.status(401).json({
      error: 'Usuario o contraseña incorrectos. Verifica tus datos e intenta de nuevo.',
    });
    return;
  }

  const user = {
    uid: 'demo_admin',
    email: 'admin@inventariofacil.demo',
    displayName: 'Alison Lara',
  };
  res.json({
    token: signDemoToken(user.uid),
    user,
  });
});

app.get('/api/demo-session', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const verified = token ? verifyDemoToken(token) : null;
  if (!verified) {
    res.status(401).json({error: 'Sesión no válida.'});
    return;
  }
  res.json({
    user: {
      uid: verified.uid,
      email: 'admin@inventariofacil.demo',
      displayName: 'Alison Lara',
    },
  });
});

// Rate limiter en memoria: 60 reconocimientos por hora por usuario/IP
const recognizeRateMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 60;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = (recognizeRateMap.get(key) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    recognizeRateMap.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  recognizeRateMap.set(key, timestamps);
  return true;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isTransientGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';
  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    /503|UNAVAILABLE|504|DEADLINE_EXCEEDED|high demand|aborted due to timeout|ECONNRESET|fetch failed/i.test(
      msg,
    )
  );
}

function isQuotaOrRateError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|RESOURCE_EXHAUSTED/i.test(msg);
}

async function generateWithResilience(
  ai: GoogleGenAI,
  params: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>,
  options: {preferFast?: boolean; timeoutMs?: number; allowLiteFallback?: boolean} = {},
) {
  const {preferFast = false, timeoutMs = 8000, allowLiteFallback = true} = options;

  const attempts: Array<{model: string; delayMs: number; timeoutMs: number}> = preferFast
    ? [
        {model: GEMINI_FALLBACK_MODEL, delayMs: 0, timeoutMs: 6500},
        {model: GEMINI_FALLBACK_MODEL, delayMs: 200, timeoutMs: 6500},
        {model: GEMINI_MODEL, delayMs: 250, timeoutMs},
      ]
    : allowLiteFallback
      ? [
          {model: GEMINI_MODEL, delayMs: 0, timeoutMs: 5500},
          {model: GEMINI_FALLBACK_MODEL, delayMs: 150, timeoutMs},
          {model: GEMINI_FALLBACK_MODEL, delayMs: 400, timeoutMs},
        ]
      : [
          {model: GEMINI_MODEL, delayMs: 0, timeoutMs},
          {model: GEMINI_FALLBACK_MODEL, delayMs: 200, timeoutMs},
        ];

  let lastError: unknown;
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    if (attempt.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, attempt.delayMs));
    }
    try {
      const baseConfig = {...(params.config || {})};
      if (attempt.model === GEMINI_FALLBACK_MODEL) {
        baseConfig.thinkingConfig = {thinkingLevel: ThinkingLevel.MINIMAL};
      }
      const config = {
        ...baseConfig,
        abortSignal: AbortSignal.timeout(attempt.timeoutMs),
      };
      return await ai.models.generateContent({
        ...params,
        model: attempt.model,
        config,
      });
    } catch (err) {
      lastError = err;
      const canRetryNext = isTransientGeminiError(err) || isQuotaOrRateError(err);
      if (!canRetryNext) {
        throw err;
      }
    }
  }
  throw lastError;
}

const VALID_CATEGORIES = [
  'camiseta',
  'jean',
  'pantalón',
  'buzo',
  'gorra',
  'zapatos',
  'accesorio',
  'otro',
] as const;

const RecognizeRequestSchema = z.object({
  imageBase64: z.string().min(50).max(7_000_000),
  mimeType: z.string().regex(/^image\/(jpeg|jpg|png|webp)$/i).default('image/jpeg'),
  userId: z.string().max(128).optional(),
});

const RecognizeResponseSchema = z.object({
  name: z.string().min(2).max(80),
  category: z.enum(VALID_CATEGORIES),
  color: z.string().min(1).max(30),
  confidence: z.number().min(1).max(100),
  isGarment: z.boolean().default(true),
});

function normalizeCategory(raw: string): (typeof VALID_CATEGORIES)[number] {
  const value = raw.trim().toLowerCase();
  if ((VALID_CATEGORIES as readonly string[]).includes(value)) {
    return value as (typeof VALID_CATEGORIES)[number];
  }
  if (/camis|playera|polera|polo|blusa|top/.test(value)) return 'camiseta';
  if (/jean|mezclilla|denim/.test(value)) return 'jean';
  if (/pantal|jogger|chino|short|bermuda|falda/.test(value)) return 'pantalón';
  if (/buzo|hoodie|sudadera|chaqueta|chompa|saco|su[eé]ter|abrigo/.test(value)) return 'buzo';
  if (/gorra|cachucha|sombrero|beanie/.test(value)) return 'gorra';
  if (/zapato|tenis|zapatilla|bota|sandalia|calzado/.test(value)) return 'zapatos';
  if (/accesorio|bolso|morral|correa|cintur|media|gafa|bufanda|reloj/.test(value)) return 'accesorio';
  return 'otro';
}

function extractJsonObject(rawText: string): Record<string, unknown> {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned || '{}') as Record<string, unknown>;
}

app.post('/api/recognize', async (req, res) => {
  const parsed = RecognizeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'La imagen enviada no es válida. Intenta tomar la foto de nuevo.',
    });
    return;
  }

  const rateKey = parsed.data.userId || req.ip || 'anon';
  if (!checkRateLimit(rateKey)) {
    res.status(429).json({
      error: 'Has alcanzado el límite de reconocimientos por hora. Puedes escribir el nombre manualmente.',
    });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error: 'Falta configurar GEMINI_API_KEY en el servidor para usar el reconocimiento con IA.',
    });
    return;
  }

  try {
    const cleanBase64 = parsed.data.imageBase64.replace(/^data:[^;]+;base64,/i, '');

    const response = await generateWithResilience(
      ai,
      {
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: parsed.data.mimeType,
                data: cleanBase64,
              },
            },
            {
              text: 'Observa la imagen e identifica qué prenda de vestir, calzado o accesorio aparece. Si hay una prenda visible (aunque la esté usando una persona o esté doblada/colgada), responde con isGarment=true y un nombre corto en español de Colombia (ej. "Camiseta blanca", "Jean azul", "Buzo negro", "Chaqueta denim", "Gorra negra", "Tenis blancos"). Si no hay ninguna prenda ni accesorio de moda visible, responde isGarment=false con name="Sin prenda detectada" y confidence bajo (< 40).',
            },
          ],
        },
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
          systemInstruction:
            'Eres un experto en visión por computador para inventario de tiendas de ropa en Colombia. Responde únicamente con JSON válido siguiendo el esquema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isGarment: {
                type: Type.BOOLEAN,
                description:
                  'true si en la imagen se distingue una prenda, calzado o accesorio de ropa',
              },
              name: {
                type: Type.STRING,
                description: 'Nombre corto y natural de la prenda en español, p. ej. Camiseta blanca',
              },
              category: {
                type: Type.STRING,
                description:
                  'Categoría exacta entre: camiseta, jean, pantalón, buzo, gorra, zapatos, accesorio, otro',
              },
              color: {
                type: Type.STRING,
                description: 'Color principal de la prenda en español, p. ej. Blanco, Azul, Negro',
              },
              confidence: {
                type: Type.INTEGER,
                description: 'Nivel de confianza de 1 a 100',
              },
            },
            required: ['isGarment', 'name', 'category', 'color', 'confidence'],
          },
        },
      },
      {preferFast: true, timeoutMs: 7500},
    );

    const rawJson = extractJsonObject(response.text ?? '{}');
    const normalizedCategory = normalizeCategory(String(rawJson.category || 'otro'));
    const isGarment = rawJson.isGarment !== false;

    const validated = RecognizeResponseSchema.parse({
      isGarment,
      name: String(rawJson.name || (isGarment ? 'Prenda detectada' : 'Sin prenda')).slice(0, 80),
      category: normalizedCategory,
      color: String(rawJson.color || 'Neutro').slice(0, 30),
      confidence: Math.max(1, Math.min(100, Math.round(Number(rawJson.confidence) || 88))),
    });

    res.json(validated);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Error en /api/recognize:', errMsg);
    if (/429|RESOURCE_EXHAUSTED/i.test(errMsg)) {
      res.status(429).json({
        error:
          'Cuota de IA alcanzada temporalmente. Intenta en unos segundos o registra la prenda a mano.',
      });
      return;
    }
    if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED|403/i.test(errMsg)) {
      res.status(502).json({
        error:
          'Verifica tu clave GEMINI_API_KEY en Settings > Secrets para activar el reconocimiento con IA.',
      });
      return;
    }
    if (isTransientGeminiError(err)) {
      res.status(503).json({
        error:
          'La IA está ocupada en este momento. Toca "Reintentar con IA" o registra la prenda a mano.',
      });
      return;
    }
    res.status(502).json({
      error:
        'No pudimos analizar la imagen con la IA. Toma otra foto más nítida o escríbela manualmente.',
    });
  }
});

const RecommendationItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  size: z.string(),
  category: z.string(),
  quantity: z.number(),
  minStock: z.number(),
  suggestedQty: z.number(),
  abcClass: z.enum(['A', 'B', 'C']),
  daysRemaining: z.number().nullable(),
  reason: z.string(),
});

const AssistantRequestSchema = z.object({
  question: z.string().min(1).max(600),
  useWebSearch: z.boolean().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().min(1).max(1500),
      }),
    )
    .max(16)
    .optional(),
  inventoryContext: z.object({
    businessName: z.string().max(120),
    totalUnits: z.number(),
    totalSpaces: z.number(),
    lowStockCount: z.number(),
    recommendations: z.array(RecommendationItemSchema).max(15),
    topMovers: z
      .array(
        z.object({
          name: z.string(),
          sold30d: z.number(),
          abcClass: z.enum(['A', 'B', 'C']),
        }),
      )
      .max(10),
    inventoryItems: z
      .array(
        z.object({
          name: z.string(),
          size: z.string(),
          category: z.string(),
          quantity: z.number(),
          minStock: z.number(),
          spaceName: z.string(),
          abcClass: z.enum(['A', 'B', 'C']),
        }),
      )
      .max(60)
      .optional(),
  }),
});

function buildRuleBasedReply(
  question: string,
  ctx: z.infer<typeof AssistantRequestSchema>['inventoryContext'],
) {
  const q = question.toLowerCase();
  const topItems = ctx.recommendations.slice(0, 3);

  if (ctx.recommendations.length === 0) {
    return {
      text: `¡Todo va muy bien en ${ctx.businessName}! Tienes ${ctx.totalUnits} prendas en ${ctx.totalSpaces} espacios y ninguna requiere reposición urgente en este momento.`,
      items: [],
      askToCreateOrder: false,
      sources: [],
    };
  }

  if (q.includes('rotan') || q.includes('vende') || q.includes('más')) {
    const moversText =
      ctx.topMovers.length > 0
        ? ctx.topMovers
            .slice(0, 3)
            .map((m) => `${m.name} (${m.sold30d} vendidas este mes, clase ${m.abcClass})`)
            .join(', ')
        : topItems.map((i) => i.name).join(', ');
    return {
      text: `Las prendas con mayor movimiento en ${ctx.businessName} son: ${moversText}. Estas prendas clase A requieren reposición prioritaria para no perder ventas.`,
      items: topItems.map((item) => ({
        productId: item.productId,
        nombre: item.name,
        size: item.size,
        category: item.category,
        quedan: item.quantity,
        pedir: item.suggestedQty,
      })),
      askToCreateOrder: true,
      sources: [],
    };
  }

  return {
    text:
      topItems.length === 1
        ? `Esta prenda se vende rápido y quedan pocas unidades en ${ctx.businessName}:`
        : 'Estas prendas se venden rápido y quedan pocas unidades:',
    items: topItems.map((item) => ({
      productId: item.productId,
      nombre: item.name,
      size: item.size,
      category: item.category,
      quedan: item.quantity,
      pedir: item.suggestedQty,
    })),
    askToCreateOrder: true,
    sources: [],
  };
}

function shouldEnableWebSearch(question: string, explicitFlag?: boolean): boolean {
  if (explicitFlag) return true;
  return /tendencia|moda|temporada|colombia|mercado|precio|mayorista|telas?|cuidado|lavad|clima|google|internet|actual|2025|2026|colecci[oó]n|estilo/i.test(
    question,
  );
}

app.post('/api/assistant', async (req, res) => {
  const parsed = AssistantRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({error: 'Solicitud inválida para el asistente.'});
    return;
  }

  const {question, history = [], useWebSearch, inventoryContext} = parsed.data;
  const fallback = buildRuleBasedReply(question, inventoryContext);

  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error: 'Falta configurar GEMINI_API_KEY en Settings > Secrets para usar el Asistente IA.',
    });
    return;
  }

  try {
    const selectedItems = inventoryContext.recommendations.slice(0, 8);
    const contextSummary = JSON.stringify({
      negocio: inventoryContext.businessName,
      totalPrendas: inventoryContext.totalUnits,
      espacios: inventoryContext.totalSpaces,
      productosBajoStock: inventoryContext.lowStockCount,
      candidatosAReponer: selectedItems.map((item) => ({
        id: item.productId,
        nombre: item.name,
        talla: item.size,
        quedan: item.quantity,
        minimo: item.minStock,
        sugeridoPedir: item.suggestedQty,
        claseABC: item.abcClass,
        diasCobertura: item.daysRemaining,
        motivo: item.reason,
      })),
      masVendidos30d: inventoryContext.topMovers,
      catalogoActual: inventoryContext.inventoryItems || [],
    });

    const historyTurns = history.slice(-10).map((msg) => ({
      role: msg.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{text: msg.text}],
    }));

    const wantsSearch = shouldEnableWebSearch(question, useWebSearch);

    if (wantsSearch) {
      try {
        const searchContents = [
          ...historyTurns,
          {
            role: 'user' as const,
            parts: [
              {
                text: `Pregunta del dueño de "${inventoryContext.businessName}": "${question}"\n\nContexto real de su tienda (no inventes prendas que no estén aquí):\n${contextSummary}`,
              },
            ],
          },
        ];

        const searchResponse = await generateWithResilience(
          ai,
          {
            contents: searchContents,
            config: {
              tools: [{googleSearch: {}}],
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.LOW,
              },
              systemInstruction:
                'Eres el Asistente IA de "Inventario Fácil IA" para tiendas de ropa en Colombia. Combina datos actualizados de Google Search con el inventario real de la tienda. Responde en español colombiano claro, práctico y cercano (máximo 4 o 5 frases). No inventes cifras ni existencias del inventario.',
            },
          },
          {preferFast: false, timeoutMs: 8500, allowLiteFallback: true},
        );

        const rawChunks =
          searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const seenUris = new Set<string>();
        const sources: Array<{title: string; uri: string}> = [];
        for (const chunk of rawChunks) {
          const uri = chunk?.web?.uri;
          if (uri && !seenUris.has(uri)) {
            seenUris.add(uri);
            sources.push({
              title: chunk?.web?.title || 'Fuente web',
              uri,
            });
          }
          if (sources.length >= 4) break;
        }

        const answerText = (searchResponse.text || '').trim();
        if (answerText) {
          res.json({
            text: answerText,
            items: [],
            askToCreateOrder: false,
            sources,
            source: 'gemini',
          });
          return;
        }
      } catch (searchErr) {
        // Si Search Grounding alcanza cuota o falla, continuar con el chat normal de Gemini
        console.warn(
          'Search grounding omitido, continuando con chat Gemini:',
          searchErr instanceof Error ? searchErr.message : String(searchErr),
        );
      }
    }

    const chatContents = [
      ...historyTurns,
      {
        role: 'user' as const,
        parts: [
          {
            text: `Pregunta del dueño de "${inventoryContext.businessName}": "${question}"\n\nDatos reales del inventario (NO inventes cifras ni prendas):\n${contextSummary}`,
          },
        ],
      },
    ];

    const response = await generateWithResilience(
      ai,
      {
        contents: chatContents,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
          systemInstruction:
            'Eres el Asistente IA de "Inventario Fácil IA" para pequeños comercios de ropa en Colombia. Mantienes el hilo de la conversación y respondes cualquier duda sobre inventario, ventas, rotación ABC, organización de espacios o recomendaciones comerciales en español colombiano natural, claro y cercano (sin tecnicismos, máximo 3 o 4 frases). Usa ÚNICAMENTE los productos y cifras reales del contexto. Si el usuario pregunta qué pedir, qué falta o qué reponer, marca includeOrderItems=true y selecciona hasta 5 IDs de candidatosAReponer; si es una pregunta conversacional o sobre otra prenda con buen stock, marca includeOrderItems=false.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: 'Respuesta conversacional breve en español colombiano.',
              },
              includeOrderItems: {
                type: Type.BOOLEAN,
                description:
                  'true solo si conviene mostrar tarjetas de reposición y ofrecer armar el pedido.',
              },
              selectedProductIds: {
                type: Type.ARRAY,
                items: {type: Type.STRING},
                description: 'IDs de hasta 5 productos relevantes de candidatosAReponer.',
              },
            },
            required: ['text', 'includeOrderItems', 'selectedProductIds'],
          },
        },
      },
      {preferFast: false, timeoutMs: 8500, allowLiteFallback: true},
    );

    const raw = extractJsonObject(response.text ?? '{}') as {
      text?: string;
      includeOrderItems?: boolean;
      selectedProductIds?: string[];
    };

    const allowedMap = new Map(selectedItems.map((i) => [i.productId, i]));
    const pickedIds = Array.isArray(raw.selectedProductIds)
      ? raw.selectedProductIds.filter((id) => allowedMap.has(id)).slice(0, 5)
      : [];

    const finalItems = (
      pickedIds.length > 0
        ? pickedIds.map((id) => allowedMap.get(id)!).filter(Boolean)
        : selectedItems.slice(0, 3)
    ).map((item) => ({
      productId: item.productId,
      nombre: item.name,
      size: item.size,
      category: item.category,
      quedan: item.quantity,
      pedir: item.suggestedQty,
    }));

    const showItems = Boolean(raw.includeOrderItems) && finalItems.length > 0;

    res.json({
      text: (raw.text || fallback.text).trim(),
      items: showItems ? finalItems : [],
      askToCreateOrder: showItems,
      sources: [],
      source: 'gemini',
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Error en /api/assistant:', errMsg);
    if (/429|RESOURCE_EXHAUSTED/i.test(errMsg)) {
      res.status(429).json({
        error: 'La cuota de Gemini se alcanzó temporalmente. Espera unos segundos e intenta de nuevo.',
      });
      return;
    }
    if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED|403/i.test(errMsg)) {
      res.status(502).json({
        error: 'Verifica tu clave GEMINI_API_KEY en Settings > Secrets para activar el Asistente IA.',
      });
      return;
    }
    res.status(503).json({
      error: 'Gemini tardó demasiado o está ocupado en este momento. Intenta enviar tu pregunta de nuevo.',
    });
  }
});

app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (!req.path.startsWith('/api/')) {
      next(err);
      return;
    }
    const status =
      typeof (err as {status?: number})?.status === 'number'
        ? (err as {status: number}).status
        : 400;
    if (status === 413) {
      res.status(413).json({
        error: 'La foto es demasiado pesada para analizarla. Toma una foto más cercana o usa otra.',
      });
      return;
    }
    res.status(status).json({
      error: 'No se pudo procesar la solicitud de imagen. Intenta de nuevo.',
    });
  },
);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build no encontrado');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Inventario Fácil IA corriendo en http://localhost:${PORT}`);
  });
}

startServer();
