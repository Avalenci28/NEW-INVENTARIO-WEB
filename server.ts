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
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
const ENV_GEMINI_MODEL = (process.env.GEMINI_MODEL || '').trim();
const GEMINI_MODEL = /^gemini-[a-z0-9._-]+$/i.test(ENV_GEMINI_MODEL)
  ? ENV_GEMINI_MODEL
  : DEFAULT_GEMINI_MODEL;

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

function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_KEY]')
    .replace(/(x-goog-api-key|apiKey|key)[=:]\s*["']?[^\s"'&]+/gi, '$1=[REDACTED]');
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
        'x-goog-api-key': apiKey,
      },
    },
  });
}

function isTimeoutGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';
  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    /aborted due to timeout|DEADLINE_EXCEEDED|timed out/i.test(msg)
  );
}

function getAuthGeminiStatus(err: unknown): 401 | 403 | null {
  const msg = err instanceof Error ? err.message : String(err);
  if (/API_KEY_INVALID|API key not valid|UNAUTHENTICATED|\b401\b/i.test(msg)) {
    return 401;
  }
  if (/PERMISSION_DENIED|\b403\b/i.test(msg)) {
    return 403;
  }
  return null;
}

function isTransientGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /500|INTERNAL|503|UNAVAILABLE|504|high demand|ECONNRESET|fetch failed|network/i.test(msg);
}

function isQuotaOrRateError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|RESOURCE_EXHAUSTED/i.test(msg);
}

const GEMINI_TIMEOUT_MS = 25000;

async function generateWithTimeout(
  ai: GoogleGenAI,
  params: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>,
  timeoutMs: number = GEMINI_TIMEOUT_MS,
) {
  const effectiveTimeoutMs = Math.max(1000, Math.min(GEMINI_TIMEOUT_MS, timeoutMs));
  const baseConfig = {...(params.config || {})};
  if (GEMINI_MODEL.includes('flash-lite')) {
    baseConfig.thinkingConfig = {thinkingLevel: ThinkingLevel.MINIMAL};
  }
  return ai.models.generateContent({
    ...params,
    model: GEMINI_MODEL,
    config: {
      ...baseConfig,
      abortSignal: AbortSignal.timeout(effectiveTimeoutMs),
    },
  });
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
  nombre: z.string().min(1).max(80).nullable(),
  marca: z.string().min(1).max(50).nullable(),
  categoria: z.enum(VALID_CATEGORIES).nullable(),
  codigo_barras: z.string().min(1).max(64).nullable(),
  color: z.string().min(1).max(30).nullable(),
});

function normalizeCategory(raw: unknown): (typeof VALID_CATEGORIES)[number] | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  if (!value || value === 'null' || value === 'none' || value === 'desconocido') return null;
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

function normalizeNullableString(raw: unknown, maxLen: number): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  if (!cleaned || /^(null|none|n\/a|na|desconocid[oa]|no visible|sin marca)$/i.test(cleaned)) {
    return null;
  }
  return cleaned.slice(0, maxLen);
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
    console.error('[IA /api/recognize] GEMINI_API_KEY no configurada en el servidor');
    res.status(401).json({
      code: 'AUTH_ERROR',
      error: 'Falta configurar una GEMINI_API_KEY válida en el servidor para usar la IA.',
    });
    return;
  }

  try {
    const cleanBase64 = parsed.data.imageBase64.replace(/^data:[^;]+;base64,/i, '');

    const response = await generateWithTimeout(
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
              text: 'Observa la imagen. Si ves una prenda de vestir, calzado o accesorio (colgada, doblada o puesta en una persona), responde en JSON con {nombre, marca, categoria, codigo_barras, color}. Si la marca o el código de barras no son claramente legibles, pon null en esos campos. Si la imagen está en blanco, muy oscura, borrosa o NO muestra ningún producto de vestir/moda, devuelve nombre=null, marca=null, categoria=null, codigo_barras=null, color=null. Nunca inventes precios ni cantidades. Para categoria usa solo: camiseta, jean, pantalón, buzo, gorra, zapatos, accesorio, otro.',
            },
          ],
        },
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
          systemInstruction:
            'Eres un clasificador visual de inventario de ropa en Colombia. Responde solo JSON válido con {nombre, marca, categoria, codigo_barras, color}. Identifica la prenda cuando sea visible y usa null en cualquier campo (como marca o codigo_barras) cuando no estés seguro. Si no hay ninguna prenda visible, responde nombre=null.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nombre: {
                type: Type.STRING,
                nullable: true,
                description:
                  'Nombre corto de la prenda o producto en español (ej. "Camiseta blanca"), o null si no se distingue.',
              },
              marca: {
                type: Type.STRING,
                nullable: true,
                description: 'Marca visible en etiqueta o logo, o null si no es legible.',
              },
              categoria: {
                type: Type.STRING,
                nullable: true,
                description:
                  'Categoría exacta entre: camiseta, jean, pantalón, buzo, gorra, zapatos, accesorio, otro; o null si no está seguro.',
              },
              codigo_barras: {
                type: Type.STRING,
                nullable: true,
                description:
                  'Número o código de barras claramente visible en la imagen, o null si no es legible.',
              },
              color: {
                type: Type.STRING,
                nullable: true,
                description: 'Color principal de la prenda en español, o null si no está seguro.',
              },
            },
            required: ['nombre', 'marca', 'categoria', 'codigo_barras'],
          },
        },
      },
      GEMINI_TIMEOUT_MS,
    );

    const responseText = (response.text || '').trim();
    if (!responseText) {
      throw new Error('Respuesta vacía de Gemini en /api/recognize');
    }

    const rawJson = extractJsonObject(responseText);
    const validated = RecognizeResponseSchema.parse({
      nombre: normalizeNullableString(rawJson.nombre, 80),
      marca: normalizeNullableString(rawJson.marca, 50),
      categoria: normalizeCategory(rawJson.categoria),
      codigo_barras: normalizeNullableString(rawJson.codigo_barras, 64),
      color: normalizeNullableString(rawJson.color, 30),
    });

    res.json(validated);
  } catch (err) {
    const safeMsg = sanitizeErrorMessage(err);
    console.error('[IA /api/recognize] Error:', safeMsg);
    if (isQuotaOrRateError(err)) {
      res.status(429).json({
        code: 'RATE_LIMIT',
        error:
          'Se alcanzó el límite temporal de uso de Gemini (429). Espera unos segundos e intenta de nuevo.',
      });
      return;
    }
    const authStatus = getAuthGeminiStatus(err);
    if (authStatus) {
      res.status(authStatus).json({
        code: 'AUTH_ERROR',
        error:
          'La clave GEMINI_API_KEY del servidor no es válida o no tiene permisos. Verifica la configuración en el hosting.',
      });
      return;
    }
    if (isTimeoutGeminiError(err)) {
      res.status(504).json({
        code: 'TIMEOUT',
        error:
          'Gemini tardó más de 25 segundos en analizar la imagen. Toca "Reintentar con IA" o completa los datos a mano.',
      });
      return;
    }
    res.status(503).json({
      code: 'SERVER_ERROR',
      error:
        'El servicio de Gemini no pudo procesar la imagen en este momento. Toca "Reintentar con IA" o registra a mano.',
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

function shouldEnableWebSearch(question: string, explicitFlag?: boolean): boolean {
  if (explicitFlag) return true;
  return /tendencia|moda actual|temporada \d{4}|google|en internet|buscar en web|mercado colombiano/i.test(
    question,
  );
}

app.post('/api/assistant', async (req, res) => {
  const parsed = AssistantRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({error: 'Solicitud inválida para el asistente.'});
    return;
  }

  const rateKey = `assistant:${req.ip || 'anon'}`;
  if (!checkRateLimit(rateKey)) {
    res.status(429).json({
      error: 'Has enviado muchas consultas seguidas. Espera un momento antes de intentar de nuevo.',
    });
    return;
  }

  const {question, history = [], useWebSearch, inventoryContext} = parsed.data;

  const ai = getGeminiClient();
  if (!ai) {
    console.error('[IA /api/assistant] GEMINI_API_KEY no configurada en el servidor');
    res.status(401).json({
      code: 'AUTH_ERROR',
      error: 'Falta configurar una GEMINI_API_KEY válida en el servidor para usar el Asistente IA.',
    });
    return;
  }

  try {
    const selectedItems = inventoryContext.recommendations.slice(0, 8);
    const compactCatalog = (inventoryContext.inventoryItems || []).slice(0, 35).map((item) => ({
      n: item.name,
      t: item.size,
      q: item.quantity,
      min: item.minStock,
      esp: item.spaceName,
      abc: item.abcClass,
    }));

    const contextSummary = JSON.stringify({
      negocio: inventoryContext.businessName,
      totalPrendas: inventoryContext.totalUnits,
      espacios: inventoryContext.totalSpaces,
      bajoStock: inventoryContext.lowStockCount,
      reponer: selectedItems.map((item) => ({
        id: item.productId,
        n: item.name,
        t: item.size,
        q: item.quantity,
        min: item.minStock,
        pedir: item.suggestedQty,
        abc: item.abcClass,
        dias: item.daysRemaining,
        motivo: item.reason,
      })),
      top30d: inventoryContext.topMovers.slice(0, 5),
      catalogo: compactCatalog,
    });

    const historyTurns = history.slice(-8).map((msg) => ({
      role: msg.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{text: msg.text}],
    }));

    const wantsSearch = shouldEnableWebSearch(question, useWebSearch);
    const requestDeadline = Date.now() + GEMINI_TIMEOUT_MS;

    if (wantsSearch) {
      try {
        const searchContents = [
          ...historyTurns,
          {
            role: 'user' as const,
            parts: [
              {
                text: `Pregunta: "${question}"\nInventario actual (${inventoryContext.businessName}):\n${contextSummary}`,
              },
            ],
          },
        ];

        const searchResponse = await generateWithTimeout(
          ai,
          {
            contents: searchContents,
            config: {
              tools: [{googleSearch: {}}],
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.LOW,
              },
              systemInstruction:
                'Asistente de "Inventario Fácil IA" en Colombia. Responde con datos reales de Google Search y del inventario entregado en máximo 4 frases claras en español colombiano. No inventes existencias.',
            },
          },
          10000,
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
        const authStatus = getAuthGeminiStatus(searchErr);
        if (authStatus) {
          throw searchErr;
        }
        console.warn(
          '[IA /api/assistant] Search grounding omitido, continuando con chat Gemini:',
          sanitizeErrorMessage(searchErr),
        );
      }
    }

    const chatContents = [
      ...historyTurns,
      {
        role: 'user' as const,
        parts: [
          {
            text: `Pregunta: "${question}"\nInventario real:\n${contextSummary}`,
          },
        ],
      },
    ];

    const remainingTimeoutMs = requestDeadline - Date.now();
    if (remainingTimeoutMs < 3000) {
      throw new DOMException('Request deadline exceeded', 'TimeoutError');
    }
    const response = await generateWithTimeout(
      ai,
      {
        contents: chatContents,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
          systemInstruction:
            'Eres el Asistente IA de "Inventario Fácil IA" para tiendas de ropa en Colombia. Responde de forma directa, natural y breve (máximo 3 frases en español colombiano) usando SOLO los datos del inventario entregado. Si preguntan qué pedir o reponer, pon includeOrderItems=true y elige hasta 5 IDs de "reponer". Para otras preguntas, pon includeOrderItems=false.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: 'Respuesta breve en español colombiano.',
              },
              includeOrderItems: {
                type: Type.BOOLEAN,
                description: 'true solo si conviene ofrecer armar pedido de reposición.',
              },
              selectedProductIds: {
                type: Type.ARRAY,
                items: {type: Type.STRING},
                description: 'IDs de hasta 5 productos relevantes de reponer.',
              },
            },
            required: ['text', 'includeOrderItems', 'selectedProductIds'],
          },
        },
      },
      remainingTimeoutMs,
    );

    const raw = extractJsonObject(response.text ?? '{}') as {
      text?: string;
      includeOrderItems?: boolean;
      selectedProductIds?: string[];
    };

    const replyText = (raw.text || '').trim();
    if (!replyText) {
      throw new Error('Respuesta vacía de Gemini');
    }

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
      text: replyText,
      items: showItems ? finalItems : [],
      askToCreateOrder: showItems,
      sources: [],
      source: 'gemini',
    });
  } catch (err) {
    const safeMsg = sanitizeErrorMessage(err);
    console.error('[IA /api/assistant] Error:', safeMsg);
    if (isQuotaOrRateError(err)) {
      res.status(429).json({
        code: 'RATE_LIMIT',
        error:
          'Se alcanzó el límite temporal de uso de Gemini (429). Espera unos segundos y toca "Reintentar".',
      });
      return;
    }
    const authStatus = getAuthGeminiStatus(err);
    if (authStatus) {
      res.status(authStatus).json({
        code: 'AUTH_ERROR',
        error:
          'La clave GEMINI_API_KEY del servidor no es válida o no tiene permisos. Verifica la configuración en el hosting.',
      });
      return;
    }
    if (isTimeoutGeminiError(err)) {
      res.status(504).json({
        code: 'TIMEOUT',
        error:
          'Gemini tardó más de 25 segundos en responder. Toca "Reintentar" para consultarlo de nuevo.',
      });
      return;
    }
    res.status(503).json({
      code: 'SERVER_ERROR',
      error: 'El servicio de Gemini está temporalmente ocupado. Toca "Reintentar" en unos segundos.',
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
