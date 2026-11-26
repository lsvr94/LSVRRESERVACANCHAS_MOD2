# Códigos HTTP de la API

Qué código devuelve cada endpoint, con un ejemplo real tomado de las pruebas de integración (`tests/integracion/`), qué capa lo decide y qué `codigo` trae el cuerpo.

Todos los errores usan el mismo formato: `{ "error": { "codigo", "mensaje", "campos"? } }`. `campos` solo aparece en los 422 de Zod. Convención: 404 solo si no existe el recurso de la URL; 422 si los datos son inválidos o el cuerpo apunta a algo que no existe.

Fechas de prueba: `2099-12-30` (`reservas.test.ts`) y `2099-12-29` (`estados.test.ts`).

| Código | Ejemplo de petición | Capa que responde | `codigo` del cuerpo | Prueba |
|---|---|---|---|---|
| **200** | `GET /api/disponibilidad?fecha=2099-12-30&cancha_id=1` → bloques libres, sin las 19:00 (reservada) | Nuestro código | — | `reservas.test.ts` · disponibilidad |
| **200** | `PATCH /api/reservas/{id}/estado` con `{"estado":"confirmada"}` sobre una reserva `pendiente` → la reserva actualizada | Nuestro código | — | `estados.test.ts` · pendiente → confirmada → cancelada |
| **201** | `POST /api/reservas` con `{"cliente_id":1,"cancha_id":1,"fecha":"2099-12-30","hora_inicio":19}` → `precio: 120` y cabecera `Location` | Nuestro código (la base fija el precio con un trigger) | — | `reservas.test.ts` · POST válido |
| **404** | `PATCH /api/reservas/999999999/estado` con `{"estado":"confirmada"}` | Nuestro código (la consulta no devuelve filas) | `RESERVA_NO_ENCONTRADA` | `estados.test.ts` · reserva inexistente |
| **409** | Dos `POST /api/reservas` **simultáneos** a Cancha 2, `2099-12-30`, 11:00 → uno 201 y el otro 409 | **Base de datos** (índice único `reservas_bloque_ocupado_unico`); nuestro código traduce el error | `BLOQUE_OCUPADO` | `reservas.test.ts` · dos POST simultáneos |
| **409** | `PATCH /api/reservas/{id}/estado` con `{"estado":"pendiente"}` sobre una reserva `cancelada` | Nuestro código (`puedeCambiarEstado`) | `TRANSICION_NO_PERMITIDA` | `estados.test.ts` · cancelada → pendiente |
| **409** | Dos `PATCH` **simultáneos** con `{"estado":"confirmada"}` sobre la misma reserva `pendiente` → uno 200 y el otro 409 | Nuestro código (UPDATE condicional: el estado cambió entre la lectura y la escritura) | `TRANSICION_NO_PERMITIDA` | `estados.test.ts` · dos PATCH simultáneos |
| **422** | `PATCH /api/reservas/{id}/estado` con `{"estado":"pagada"}` | **Zod** | `DATOS_INVALIDOS` (con `campos.estado`) | `estados.test.ts` · estado inválido |
| **500** | Supabase local apagado, o falta `SUPABASE_URL`/`SUPABASE_SECRET_KEY` | Nuestro código (`responderInesperado`): registra el error en el servidor y no expone el detalle | `ERROR_INTERNO` | Solo prueba unitaria (`tests/reservas/errores-db.test.ts`) |

## Defensas de la base que no llegan como código HTTP

Las pruebas de integración también escriben **directo en la base**, como lo haría un agente IA. Ahí no hay HTTP, pero la base rechaza o corrige el dato. Si uno de estos errores llegara por la API, se respondería con el código entre paréntesis:

| Escritura directa | Qué hace la base | Prueba |
|---|---|---|
| `insert` con `precio: 0` | El trigger guarda el precio de la tarifa (80) | `reservas.test.ts` · insert directo con precio 0 |
| `update ... set precio = 0` | El trigger conserva el precio original | `reservas.test.ts` · update directo |
| `insert` en una cancha sin tarifa | Rechaza con SQLSTATE `23514` (sería 422 `DATOS_INVALIDOS`) | `reservas.test.ts` · cancha sin tarifa |
| `update` de `confirmada` a `pendiente`, o de `cancelada` a `confirmada` | Rechaza con SQLSTATE `RS001` (sería 409 `TRANSICION_NO_PERMITIDA`) | `estados.test.ts` · trigger de transiciones |

## Casos que no están en las pruebas de integración

Se probaron a mano con `curl` al crear la API, pero no tienen prueba automática contra la base:

- `422 CLIENTE_NO_EXISTE` (la base lo detecta por la FK).
- `422 CANCHA_NO_EXISTE` y `422 SIN_TARIFA` en el POST.
- `404 CANCHA_NO_ENCONTRADA` en disponibilidad.
- Los 422 de Zod del POST (hora 23, fecha pasada, campos extra, JSON roto).
