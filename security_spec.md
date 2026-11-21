# Especificación de Seguridad Firestore — Inventario Fácil IA

## 1. Invariantes de Datos
1. **Aislamiento estricto por usuario**: Ningún usuario autenticado puede leer, listar, crear, modificar o eliminar documentos bajo `/users/{userId}` si `request.auth.uid != userId`.
2. **Integridad relacional de prendas y espacios**: Toda prenda en `/users/{userId}/products/{productId}` debe referenciar un `spaceId` existente dentro de `/users/{userId}/spaces/{spaceId}`.
3. **Stock no negativo**: `quantity >= 0` y `minStock >= 0` en todas las operaciones de creación y actualización de productos.
4. **Inmutabilidad de movimientos**: Los registros en `/users/{userId}/movements/{movementId}` no pueden modificarse después de crearse (`allow update: if false`).
5. **Integridad temporal y campos inmutables**: `createdAt` debe coincidir con `request.time` en creación y nunca cambiar en actualización; `userId` nunca cambia tras la creación.
6. **Bloqueo de estado terminal en pedidos**: Un pedido en estado `recibido` no puede volver a modificarse.

## 2. Payloads Adversarios ("Dirty Dozen")
1. **Suplantación de usuario en lectura**: Usuario B intenta `get(/users/usuarioA/products/prod1)` -> `PERMISSION_DENIED`.
2. **List scraping global**: Usuario autenticado intenta listar `/users/usuarioA/spaces` -> `PERMISSION_DENIED`.
3. **Identity Spoofing en creación**: Usuario A intenta crear un espacio con `userId: "usuarioB"` -> `PERMISSION_DENIED`.
4. **Shadow Update / Ghost Field**: Usuario A actualiza un producto enviando un campo no permitido `isAdmin: true` -> `PERMISSION_DENIED`.
5. **Stock negativo**: Usuario A intenta actualizar `quantity: -5` en un producto -> `PERMISSION_DENIED`.
6. **Producto huérfano**: Usuario A crea un producto con `spaceId: "espacio_inexistente"` -> `PERMISSION_DENIED`.
7. **ID Poisoning**: Usuario A intenta crear documento con ID con caracteres inválidos o mayor a 128 caracteres -> `PERMISSION_DENIED`.
8. **Exhaustión de memoria / Denial of Wallet**: Usuario A envía `name` con 10,000 caracteres -> `PERMISSION_DENIED`.
9. **Alteración de auditoría**: Usuario A intenta actualizar `quantity` de un `movement` histórico -> `PERMISSION_DENIED`.
10. **Falsificación de timestamp**: Usuario A envía `createdAt` con fecha falsa en el pasado -> `PERMISSION_DENIED`.
11. **Modificación de pedido terminal**: Usuario A intenta editar `items` de un pedido cuyo `status` ya es `'recibido'` -> `PERMISSION_DENIED`.
12. **Array sin límite en pedidos**: Usuario A envía `items` con 51 elementos o un elemento que no es mapa -> `PERMISSION_DENIED`.
