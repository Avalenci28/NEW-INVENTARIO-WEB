# PROMPT MAESTRO — Inventario Fácil IA

> Cómo usarlo: adjunta la imagen del prototipo (las 12 pantallas) junto con este prompt y pégalo completo en tu agente de código. Si el agente se queda corto de contexto, pásale una fase a la vez (están numeradas) y dile "continúa con la siguiente fase".

---

## 0. ROL Y OBJETIVO

Actúa como un desarrollador full-stack senior y diseñador de producto. Vas a construir **Inventario Fácil IA**, una aplicación web móvil (PWA) para dueños de pequeños negocios (tiendas de ropa, boutiques, accesorios, minimercados, papelerías) que **no son expertos en inventarios**.

Lema del producto: **Registra. Alerta. Decide.**
- **Registra**: escaneas la prenda con la cámara y la IA la reconoce.
- **Alerta**: la app avisa cuando una prenda se acerca a su mínimo.
- **Decide**: un asistente IA dice qué reponer y cuánto pedir.

La imagen adjunta es el **prototipo oficial de 12 pantallas**. Tu trabajo es dejar la app funcionando **idéntica al prototipo** en diseño, textos y flujo, pero con datos reales, backend real e IA real. No inventes pantallas ni cambies los textos en español del prototipo; si algo no se ve con claridad en la imagen, elige lo más simple y coherente con el estilo.

## 1. STACK (obligatorio)

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + React Router + TanStack Query. Iconos: `lucide-react` (nada de emojis como iconos). Animaciones suaves con Framer Motion (solo transiciones de pantalla, bottom sheets y botones; nada exagerado).
- **Backend**: Supabase (Auth email/contraseña, Postgres con RLS, Storage para fotos).
- **IA**: funciones serverless en Vercel (`/api/recognize` y `/api/assistant`) que llaman a la API de Gemini (Google AI Studio). Modelo configurable por variable de entorno `GEMINI_MODEL`; usa un modelo Flash vigente con visión. **La API key nunca va en el frontend.**
- **PWA**: `vite-plugin-pwa` (instalable, ícono, splash en color navy).
- **Deploy**: Vercel + GitHub.
- Idioma de toda la interfaz: **español (Colombia)**. Fechas con `es-CO`.

## 2. SISTEMA DE DISEÑO (sacado del prototipo)

**Colores**
| Token | Hex | Uso |
|---|---|---|
| `navy` | `#0A1F32` | Pantalla de bienvenida, tarjeta "Recomendación de la IA", textos fuertes |
| `ink` | `#071C2D` | Títulos |
| `primary` | `#1F69FC` | Botones principales, links, selección, estado activo |
| `accent` | `#EF8D2A` | Botón "Escanear prenda", botón central de la barra, "Reponer", alertas de bajo stock |
| `success` | `#24B570` | Stock sano, "Todo en orden" |
| `teal` | `#16A297` | Color de espacio / etiqueta "Uso diario" |
| `slate` | `#5C7B98` | Color de espacio gris, textos secundarios |
| `bg` | `#EDF0F5` | Fondo general |
| `card` | `#FFFFFF` | Tarjetas |

Variantes suaves (fondos de píldoras y banners): naranja `#FFF1E0`, verde `#E3F7EC`, azul `#E6EEFF`.

**Forma y tipografía**
- Fuente: **Plus Jakarta Sans** (o Inter si no carga), pesos 400/500/600/700/800.
- Radios: tarjetas 16 px, botones 14 px, inputs 12 px, píldoras 999 px, bottom sheets 24 px arriba.
- Sombras muy suaves (`0 2px 8px rgba(10,31,50,.06)`). Bordes de 1 px `#E2E8F0`.
- Botones: alto mínimo **48 px**, ancho completo en formularios. Inputs con icono a la izquierda, borde azul al enfocar.
- **Mobile-first**: contenedor máximo 430 px centrado; en escritorio, mostrar la app centrada dentro de un marco de celular sobre fondo `bg`. Respetar `safe-area-inset`.
- Barra inferior fija con 5 ítems: **Inicio, Espacios, Escanear (botón central circular naranja elevado con icono de cámara), Alertas, Asistente**. El ítem activo va en azul con etiqueta; el resto en gris. La barra se oculta en Bienvenida, Crear cuenta, Iniciar sesión, Escanear y Nueva prenda.
- Estados de stock en píldoras: **verde** "N uds" cuando está sano, **naranja** cuando está en o bajo el mínimo.
- Miniaturas de prenda: usa la foto si existe; si no, un icono de prenda (camiseta, pantalón, buzo, gorra) sobre fondo suave.

## 3. LAS 12 PANTALLAS (cumple al pie de la letra)

**1. Bienvenida** (`/`) — Fondo navy. Logo (estante con caja y etiqueta "IA"), título "Inventario Fácil IA", subtítulo "Tu inventario inteligente, siempre bajo control". Tres chips: Registra (naranja), Alerta (azul), Decide (verde). Botón azul "Iniciar sesión", botón con borde "Crear cuenta", pie "Para tiendas de ropa y emprendimientos". Si ya hay sesión activa, redirige a Inicio.

**2. Crear cuenta** (`/registro`) — Flecha atrás. "Crea tu cuenta" / "Empieza con el plan gratuito". Campos: *Nombre completo*, *Nombre del negocio*, *Correo electrónico*, *Contraseña* (con ojo mostrar/ocultar). Checkbox **obligatorio**: "Acepto el tratamiento de mis datos personales según la Ley 1581 de 2012" (guarda la fecha de aceptación). Botón "Crear cuenta". Pie "¿Ya tienes cuenta? Inicia sesión". Validaciones en línea en español (correo válido, contraseña mínimo 8 caracteres).

**3. Iniciar sesión** (`/login`) — Logo, "Bienvenido de nuevo", "Entra para ver tu inventario". Correo, Contraseña (ojo), link "¿Olvidaste tu contraseña?" (flujo real de recuperación de Supabase), botón "Iniciar sesión", separador "o", botón "Crear una cuenta nueva", pie con candado: "Tus datos se protegen según la Ley 1581 de 2012". Errores claros ("Correo o contraseña incorrectos").

**4. Inicio** (`/inicio`) — Encabezado "Hola, {nombre}" + nombre del negocio + avatar circular con inicial. Banner naranja claro con icono de alerta: "{N} productos con stock bajo" / "Toca para ver qué reponer" (lleva a Alertas; no aparece si N = 0). Tres tarjetas de métricas: **Prendas** (suma de unidades), **Espacios**, **Stock bajo** (el número en naranja). Dos botones: "Escanear prenda" (naranja, con cámara) y "+ Nuevo espacio" (borde). Sección "Movimientos recientes": últimas 3 entradas/salidas con icono de flecha (verde = entrada, rojo = salida), nombre de la prenda, "Entrada · hoy 9:12" y cantidad a la derecha (+12 / −2). Tarjeta navy "Recomendación de la IA" con el texto generado (ej. "Jean azul 32 se vende rápido y quedan pocas unidades. Te recomiendo reponer.") y botón azul "Ver sugerencia" (abre el Asistente con esa sugerencia).

**5. Espacios** (`/espacios`) — Título "Espacios", icono de búsqueda y botón "+" azul. Chips de orden: **A-Z** (por defecto), **ABC**, **Más prendas**. Texto "{N} espacios · ordenados de la A a la Z". Cuadrícula de 2 columnas con tarjetas: icono en el color del espacio, nombre, "{N} prendas" y, si aplica, una píldora naranja en la esquina "{n} bajas"/"1 baja". Última tarjeta con borde punteado "Nuevo espacio".

**6. Nuevo espacio** (bottom sheet sobre Espacios, con fondo oscurecido) — "Nuevo espacio". *Nombre del espacio*; *Tipo* (chips: Estante, Bodega, Vitrina, Otro); *Color* (5 círculos: azul, naranja, verde, teal, gris; el elegido lleva check); *Ubicación (opcional)*; botón azul "Crear espacio". También sirve para editar.

**7. Detalle de espacio — Prendas por nombre** (`/espacios/:id`) — Flecha atrás, nombre del espacio y "{N} prendas · {ubicación}". Selector segmentado **Nombre A-Z** | **Clasificación ABC**. En A-Z: lista agrupada por letra inicial (separadores B, C, G, J…). Cada fila: miniatura, nombre, "Talla M", píldora de stock. Al final, botón punteado "+ Agregar prenda a este espacio". Tocar una fila abre el detalle de la prenda (hoja inferior para editar, registrar **Entrada/Salida** con cantidad, o eliminar).

**8. Clasificación ABC** (misma ruta, pestaña ABC) — Leyenda: "A = más se vende · B = rotación media · C = se vende poco" y "La IA ordena tus prendas según cuánto rotan". Tres grupos con insignia circular y título: **A · Alta rotación — reponer primero**, **B · Rotación media**, **C · Baja rotación — no comprar de más**. Cada fila muestra además la frecuencia ("Se vende cada día", "cada semana", "al mes").

**9. Escanear prenda** (`/escanear`, pantalla completa oscura) — "×" para cerrar, título "Escanear prenda", icono de flash. Vista de cámara trasera con marco de esquinas verdes y etiqueta flotante "Camiseta · 94 %" cuando la IA responde. Panel inferior blanco: "LA IA DETECTÓ" / nombre sugerido / "Confirma o toma otra foto" + botón azul "Usar". Texto "Mantén la prenda dentro del marco". Controles: galería (izquierda), obturador blanco grande (centro), código de barras (derecha).

**10. Nueva prenda** (`/prendas/nueva`) — Flecha atrás, "Nueva prenda". Tarjeta superior con la foto y la insignia verde "Reconocido por IA" + "Revisa los datos antes de guardar." Campos: *Nombre* (prellenado por la IA y editable), *Talla* (chips S, M, L, XL; permitir "Única" y tallas numéricas para pantalones), *Cantidad* (stepper − / número / +), *Espacio* (selector), *"Avísame cuando queden menos de"* (campo con "unidades"), botón azul "Guardar en inventario" y pie "También puedes escanear el código de barras". Funciona también sin IA (entrada manual).

**11. Alertas de stock bajo** (`/alertas`) — Título "Alertas", "{N} productos por reponer", icono de filtro. Tarjetas: miniatura, nombre, "Quedan 5 uds · mínimo 8" (la parte de cantidad en rojo/naranja), contexto "Se vendió bien esta semana" y botón naranja "Reponer". Ordenadas por urgencia. Botón "Ver {n} alertas más" (paginación/expandir). Al final, tarjeta verde "Todo en orden" / "{n} prendas con buen stock". Si no hay alertas, estado vacío amable.

**12. Asistente IA** (`/asistente`) — Encabezado con icono, "Asistente IA", "Conoce tu inventario". Chips de preguntas sugeridas (ej. "¿Qué debo pedir esta semana?"). Burbujas de chat; la respuesta incluye tarjeta con lista: miniatura, nombre, "Quedan 5 · pedir 20", y cierre "¿Quieres que arme el pedido?" con botones "Crear pedido" (naranja) y "Ver detalle". Caja de texto "Pregunta a tu inventario…" con botón de enviar azul.

## 4. MODELO DE DATOS (Supabase)

Crea migraciones SQL en `/supabase/migrations`, con **RLS activado en todas las tablas** (cada usuario solo ve y modifica lo suyo: `user_id = auth.uid()`).

- `profiles`: `id` (= auth.users.id), `full_name`, `business_name`, `accepted_terms_at`, `created_at`. Trigger que la crea al registrarse.
- `spaces`: `id`, `user_id`, `name`, `type` (`estante|bodega|vitrina|otro`), `color`, `location`, `created_at`. Único (`user_id`, `name`).
- `products`: `id`, `user_id`, `space_id`, `name`, `size`, `color`, `quantity` (>= 0), `min_stock` (>= 0, por defecto 5), `barcode`, `image_url`, `ai_recognized` (bool), `created_at`, `updated_at`.
- `movements`: `id`, `user_id`, `product_id`, `type` (`entrada|salida`), `quantity` (> 0), `note`, `created_at`.
- `orders` y `order_items`: pedido de reposición (`status`: borrador/enviado/recibido), producto, cantidad sugerida y cantidad final.
- Toda entrada/salida actualiza `products.quantity` **en una función SQL transaccional** (RPC `register_movement`), nunca desde el cliente por separado. No permitir stock negativo.
- Vistas/funciones: `space_summary` (prendas y cantidad de bajas por espacio), `product_sales_30d` (unidades vendidas en 30 días a partir de `movements` tipo salida) y `abc_classification`.
- Storage: bucket privado `product-photos` con política por usuario; comprimir la imagen en el cliente (máx. 1024 px, JPEG ~0.8) antes de subirla.

## 5. REGLAS DE NEGOCIO

1. **Stock bajo** = `quantity <= min_stock`. Una prenda con `quantity = 0` se muestra como "Agotado" (rojo) y va primero en Alertas.
2. **Clasificación ABC** (Pareto sobre unidades vendidas en 30 días): A = prendas que suman el 80 % de las ventas, B = el siguiente 15 %, C = el 5 % restante y las que no se vendieron. Calcula la frecuencia ("cada día / cada semana / al mes") con el promedio de días entre salidas.
3. **Cantidad sugerida a pedir** (la calcula el código, **no la IA**): `ceil(ventas_diarias_promedio × 21 días − stock_actual)`, mínimo 1, redondeada a múltiplos de 5. La IA solo redacta la explicación con esos números, así nunca inventa cantidades.
4. **Recomendación del Inicio**: la prenda de clase A con mayor urgencia (menos días de cobertura) → texto corto y simple.
5. Orden en Espacios: A-Z, ABC (por rotación del espacio) o Más prendas.
6. Un espacio con prendas no se puede borrar sin mover o confirmar el borrado de sus prendas.

## 6. INTEGRACIÓN DE IA

**`POST /api/recognize`** — Recibe la imagen (base64) y devuelve JSON estricto: `{ name, category, color, confidence }` (category ∈ camiseta, jean, pantalón, buzo, gorra, zapatos, accesorio, otro). Usa salida estructurada (JSON schema) y un prompt en español: "Identifica la prenda de ropa de la imagen. Devuelve un nombre corto y natural como 'Camiseta blanca'". Valida la respuesta con Zod. Si falla, responde un error claro y la UI permite escribir el nombre a mano (nunca bloquear al usuario). Verifica la sesión de Supabase en la función y limita el uso por usuario (ej. 30 reconocimientos/hora).

**`POST /api/assistant`** — Recibe la pregunta. En el servidor consulta el inventario del usuario (stock bajo, ventas 30 días, cantidades sugeridas ya calculadas) y se lo pasa al modelo como contexto. Reglas del prompt del sistema: responder en español sencillo, sin tecnicismos, máximo 5 prendas, usar **solo** los datos entregados, no inventar productos ni cifras, y terminar preguntando "¿Quieres que arme el pedido?" cuando corresponda. Devuelve `{ texto, items: [{product_id, nombre, quedan, pedir}] }` para pintar la tarjeta. "Crear pedido" genera un `order` en borrador con esos ítems (editable) y permite **copiar el pedido como texto para WhatsApp**.

**Sin IA disponible** (sin key o sin cuota): la app sigue funcionando; el Asistente responde con una versión basada en reglas usando las mismas cifras.

## 7. CÁMARA Y CÓDIGO DE BARRAS

- `getUserMedia({ video: { facingMode: 'environment' } })`, captura a `canvas`, libera la cámara al salir de la pantalla. Flash/linterna solo si el dispositivo lo soporta (ocultar el icono si no).
- Manejar con mensajes amables: permiso denegado, sin cámara, sin HTTPS. Siempre ofrecer "Elegir de la galería" (`<input type="file" accept="image/*" capture>`).
- Código de barras: `BarcodeDetector` nativo y, como respaldo, `@zxing/browser`. Si el código ya existe en el inventario, abrir esa prenda para registrar entrada/salida; si no existe, ir a Nueva prenda con el código prellenado.
- El marco verde es una guía fija; la etiqueta "Camiseta · 94 %" aparece cuando responde `/api/recognize` usando su `confidence`.

## 8. IDEAS DE LA ACTIVIDAD SIT (implementar después de que todo lo anterior funcione)

Son las cuatro ideas que el equipo eligió para la siguiente iteración:
1. **Sustracción** — No exigir cargar el catálogo completo: el usuario entra con inventario vacío (estado vacío con ilustración y dos botones: "Escanear mi primera prenda" y "Cargar datos de ejemplo") y lo construye poco a poco.
2. **Multiplicación** — **Alerta anticipada** además de la de mínimo: avisa cuando, por el ritmo de ventas, quedan menos de 7 días de stock (insignia "Se acaba pronto" distinta a "Bajo el mínimo").
3. **Unificación de tareas** — La alerta también arma la lista de reposición: el botón "Reponer" de cada alerta agrega la prenda con su cantidad sugerida a un pedido en borrador.
4. **Dependencia de atributos** — El mínimo depende de la velocidad de venta: opción "Mínimo automático" en Nueva prenda (alta rotación → mínimo mayor), manteniendo la opción manual.

## 9. DATOS DE EJEMPLO (que la app se vea como el prototipo)

Crea un seed (`supabase/seed.sql` y un botón "Cargar datos de ejemplo") con datos **consistentes entre pantallas** (hay una sola fuente de verdad; el prototipo tiene pequeñas diferencias, no las copies):
- Negocio "Mi tienda de ropa". Espacios: Bodega (120 prendas, 3 bajas), Estante A (86, 2 bajas, "Pasillo 1"), Estante B (64, 1 baja), Probadores (18), Vitrina (42, 1 baja) → 330 prendas, 7 en stock bajo, 323 en orden.
- Prendas: Camiseta blanca M, Camiseta negra S, Jean azul 32, Jean negro 30, Buzo gris L, Buzo azul M, Gorra negra (Única).
- Historial de salidas de los últimos 30 días generado para que el ABC y las recomendaciones salgan solos (Jean azul 32 y Camiseta blanca M como clase A).

## 10. CALIDAD, SEGURIDAD Y RENDIMIENTO

- Estados de carga con *skeletons*, estados vacíos y de error en cada pantalla; *toasts* en español para éxito/error. Actualizaciones optimistas con TanStack Query.
- Validación con Zod en formularios y en las funciones serverless. Nada de claves en el repositorio: `.env.example` con `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`.
- Accesibilidad: contraste AA, `aria-label` en botones de icono, foco visible, objetivos táctiles ≥ 44 px.
- Rendimiento: carga diferida de la pantalla de cámara y del escáner, imágenes comprimidas, Lighthouse móvil ≥ 90.
- Páginas simples de "Política de tratamiento de datos" y "Términos" enlazadas desde Crear cuenta (Ley 1581 de 2012).

## 11. QUÉ NO HACER

- No cambiar el diseño ni los textos del prototipo "por mejorarlos".
- No agregar pagos, planes de pago ni roles de varios usuarios (el plan gratuito es lo único por ahora).
- No exponer ninguna API key en el frontend ni subirla a Git.
- No dejar datos "hardcodeados" en los componentes: todo sale de Supabase.
- No usar `any` en TypeScript ni dejar `console.log` en producción.

## 12. PLAN DE TRABAJO Y GIT (sigue este orden)

Trabaja por fases. **Al terminar cada fase**: corre `npm run build` y arregla errores, y luego ejecuta **sin omitirlo** los comandos de Git indicados.

- **Fase 1 — Base**: proyecto Vite + Tailwind + tokens de diseño, rutas, layout con barra inferior, cliente de Supabase, PWA.
  `git add . && git commit -m "feat: base del proyecto y sistema de diseño" && git push`
- **Fase 2 — Ingreso** (pantallas 1, 2, 3): Auth real, perfil, consentimiento Ley 1581, rutas protegidas.
  `git add . && git commit -m "feat: bienvenida, registro e inicio de sesión" && git push`
- **Fase 3 — Datos y organización** (pantallas 4, 5, 6, 7, 8): migraciones, RLS, espacios, prendas, movimientos, ABC, seed.
  `git add . && git commit -m "feat: inicio, espacios y clasificación ABC" && git push`
- **Fase 4 — Inventariar** (pantallas 9, 10): cámara, `/api/recognize`, código de barras, subida de fotos, guardado.
  `git add . && git commit -m "feat: escaneo con cámara y registro de prendas" && git push`
- **Fase 5 — Decidir** (pantallas 11, 12): alertas, `/api/assistant`, pedidos, copiar para WhatsApp.
  `git add . && git commit -m "feat: alertas y asistente IA" && git push`
- **Fase 6 — Ideas SIT** (sección 8) y pulido final.
  `git add . && git commit -m "feat: ideas SIT y pulido final" && git push`
- **Fase 7 — Despliegue**: variables de entorno en Vercel, `vercel.json` si hace falta, probar en un celular real por HTTPS.
  `git add . && git commit -m "chore: configuración de despliegue" && git push`

## 13. CRITERIOS DE ACEPTACIÓN (revisa uno por uno antes de dar por terminado)

- [ ] Las 12 pantallas existen y se ven como el prototipo (colores, textos, orden, iconos, barra inferior con botón central).
- [ ] Puedo crear cuenta (con el checkbox obligatorio), cerrar sesión, iniciar sesión y recuperar contraseña.
- [ ] Puedo crear un espacio con tipo, color y ubicación, y verlo en la cuadrícula con su conteo de prendas y bajas.
- [ ] Puedo apuntar la cámara a una prenda, la IA propone el nombre, lo confirmo, completo talla/cantidad/espacio/mínimo y se guarda.
- [ ] Puedo registrar entradas y salidas, y aparecen en "Movimientos recientes" del Inicio.
- [ ] Al bajar una prenda al mínimo aparece en Alertas y el banner del Inicio cambia su número.
- [ ] Pestañas A-Z y ABC funcionan en cada espacio, con la leyenda y los grupos del prototipo.
- [ ] El Asistente responde "¿Qué debo pedir esta semana?" con prendas y cantidades correctas, y "Crear pedido" genera un pedido editable que puedo copiar.
- [ ] Sin API key de IA la app sigue siendo usable.
- [ ] Un usuario no puede ver los datos de otro (probado con dos cuentas).
- [ ] `npm run build` pasa sin errores ni advertencias de TypeScript, y todo está subido a GitHub y desplegado en Vercel.

**Empieza ahora por la Fase 1. Al terminar cada fase, resume en 3 líneas qué hiciste y qué sigue, y continúa con la siguiente.**
