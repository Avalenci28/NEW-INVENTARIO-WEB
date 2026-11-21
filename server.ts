import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import {fileURLToPath} from 'url';
import {GoogleGenAI, Type} from '@google/genai';
import {z} from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';

app.use(express.json({limit: '8mb'}));

// Rate limiter en memoria: 30 reconocimientos por hora por usuario/IP
const recognizeRateMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 30;

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
});

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
      error: 'Has alcanzado el límite de 30 reconocimientos por hora. Puedes escribir el nombre manualmente.',
    });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error: 'La IA no está configurada en este entorno. Escribe el nombre de la prenda manualmente.',
    });
    return;
  }

  try {
    const cleanBase64 = parsed.data.imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: parsed.data.mimeType,
              data: cleanBase64,
            },
          },
          {
            text: 'Identifica la prenda de ropa o accesorio principal en la imagen. Devuelve un nombre corto y natural en español de Colombia (por ejemplo: "Camiseta blanca", "Jean azul", "Buzo gris", "Gorra negra") sin inventar marcas ni tallas.',
          },
        ],
      },
      config: {
        systemInstruction:
          'Eres un experto en inventario de tiendas de ropa en Colombia. Responde únicamente con JSON válido siguiendo el esquema solicitado.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
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
          required: ['name', 'category', 'color', 'confidence'],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const rawJson = JSON.parse(rawText) as Record<string, unknown>;
    const normalizedCategory = VALID_CATEGORIES.includes(
      String(rawJson.category || '').toLowerCase() as (typeof VALID_CATEGORIES)[number],
    )
      ? (String(rawJson.category).toLowerCase() as (typeof VALID_CATEGORIES)[number])
      : 'otro';

    const validated = RecognizeResponseSchema.parse({
      name: String(rawJson.name || 'Prenda detectada').slice(0, 80),
      category: normalizedCategory,
      color: String(rawJson.color || 'Neutro').slice(0, 30),
      confidence: Math.max(1, Math.min(100, Math.round(Number(rawJson.confidence) || 88))),
    });

    res.json(validated);
  } catch (err) {
    console.error('Error en /api/recognize:', err);
    res.status(502).json({
      error: 'No pudimos reconocer la prenda con la IA en este momento. Escribe el nombre manualmente.',
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
  question: z.string().min(1).max(500),
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
  };
}

app.post('/api/assistant', async (req, res) => {
  const parsed = AssistantRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({error: 'Solicitud inválida para el asistente.'});
    return;
  }

  const {question, inventoryContext} = parsed.data;
  const fallback = buildRuleBasedReply(question, inventoryContext);

  const ai = getGeminiClient();
  if (!ai) {
    res.json({...fallback, source: 'rules'});
    return;
  }

  try {
    const selectedItems = inventoryContext.recommendations.slice(0, 5);
    const contextSummary = JSON.stringify({
      negocio: inventoryContext.businessName,
      totalPrendas: inventoryContext.totalUnits,
      espacios: inventoryContext.totalSpaces,
      productosBajoStock: inventoryContext.lowStockCount,
      candidatosAReponer: selectedItems.map((item) => ({
        id: item.productId,
        nombre: item.name,
        quedan: item.quantity,
        minimo: item.minStock,
        sugeridoPedir: item.suggestedQty,
        claseABC: item.abcClass,
        diasCobertura: item.daysRemaining,
        motivo: item.reason,
      })),
      masVendidos30d: inventoryContext.topMovers,
    });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Pregunta del dueño del negocio: "${question}"\n\nDatos reales del inventario (NO inventes cifras ni productos):\n${contextSummary}`,
      config: {
        systemInstruction:
          'Eres el Asistente IA de "Inventario Fácil IA" para pequeños comercios de ropa en Colombia. Responde en español natural y sencillo (tuteando de forma amable, sin tecnicismos). Máximo 2 o 3 frases cortas y claras. Usa ÚNICAMENTE los productos y cifras entregados en el contexto; nunca inventes cantidades ni prendas. Si la pregunta es sobre qué pedir o reponer, presenta brevemente los productos prioritarios (máximo 5).',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: {
              type: Type.STRING,
              description: 'Respuesta breve en español colombiano usando solo los datos reales.',
            },
            includeOrderItems: {
              type: Type.BOOLEAN,
              description: 'true si conviene mostrar las tarjetas de reposición y ofrecer armar el pedido.',
            },
            selectedProductIds: {
              type: Type.ARRAY,
              items: {type: Type.STRING},
              description: 'IDs de hasta 5 productos relevantes del contexto.',
            },
          },
          required: ['text', 'includeOrderItems', 'selectedProductIds'],
        },
      },
    });

    const raw = JSON.parse((response.text ?? '{}').trim()) as {
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
      source: 'gemini',
    });
  } catch (err) {
    console.error('Error en /api/assistant:', err);
    res.json({...fallback, source: 'rules'});
  }
});

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
