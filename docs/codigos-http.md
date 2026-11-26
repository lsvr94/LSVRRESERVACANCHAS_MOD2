# Códigos HTTP de la API

Qué código devuelve cada endpoint, con un ejemplo real tomado de las pruebas de integración (`tests/integracion/`), qué capa lo decide y qué `codigo` trae el cuerpo.

Todos los errores usan el mismo formato: `{ "error": { "codigo", "mensaje", "campos"? } }`. `campos` solo aparece en los 422 de Zod. Convención: 404 solo si no existe el recurso de la URL; 422 si los datos son inválidos o el cuerpo apunta a algo que no existe.

Fechas de prueba: `2099-12-30` (`reservas.test.ts`), `2099-12-29` (`estados.test.ts`), `2099-12-27`/`28` (`clientes.test.ts`) y `2099-12-26` (`errores-api.test.ts`).

| Código | Ejemplo de petición | Capa que responde | `codigo` del cuerpo | Prueba |
|---|---|---|---|---|
| **200** | `GET /api/disponibilidad?fecha=2099-12-30&cancha_id=1` → bloques libres, sin las 19:00 (reservada) | Nuestro código | — | `reservas.test.ts` · disponibilidad |
| **200** | `PATCH /api/reservas/{id}/estado` con `{"estado":"confirmada"}` sobre una reserva `pendiente` → la reserva actualizada | Nuestro código | — | `estados.test.ts` · pendiente → confirmada → cancelada |
| **200** | `GET /api/clientes/{id}` → `{ id, nombre, telefono: "+********999" }` (solo los 3 últimos dígitos) | Nuestro código | — | `clientes.test.ts` · teléfono enmascarado |
| **200** | `GET /api/clientes/{id}/reservas` → sus reservas, de la más reciente a la más antigua (incluye canceladas, sin teléfono) | Nuestro código | — | `clientes.test.ts` · sus reservas |
| **201** | `POST /api/reservas` con `{"cliente_id":1,"cancha_id":1,"fecha":"2099-12-30","hora_inicio":19}` → `precio: 120` y cabecera `Location` | Nuestro código (la base fija el precio con un trigger) | — | `reservas.test.ts` · POST válido |
| **404** | `PATCH /api/reservas/999999999/estado` con `{"estado":"confirmada"}` | Nuestro código (la consulta no devuelve filas) | `RESERVA_NO_ENCONTRADA` | `estados.test.ts` · reserva inexistente |
| **404** | `GET /api/clientes/999999999` y `GET /api/clientes/999999999/reservas` | Nuestro código | `CLIENTE_NO_ENCONTRADO` | `clientes.test.ts` · 404 |
| **404** | `GET /api/disponibilidad?fecha=2099-12-26&cancha_id=999` | Nuestro código | `CANCHA_NO_ENCONTRADA` | `errores-api.test.ts` · cancha inexistente |
| **409** | Dos `POST /api/reservas` **simultáneos** a Cancha 2, `2099-12-30`, 11:00 → uno 201 y el otro 409 | **Base de datos** (índice único `reservas_bloque_ocupado_unico`); nuestro código traduce el error | `BLOQUE_OCUPADO` | `reservas.test.ts` · dos POST simultáneos |
| **409** | `PATCH /api/reservas/{id}/estado` con `{"estado":"pendiente"}` sobre una reserva `cancelada` | Nuestro código (`puedeCambiarEstado`) | `TRANSICION_NO_PERMITIDA` | `estados.test.ts` · cancelada → pendiente |
| **409** | Dos `PATCH` **simultáneos** con `{"estado":"confirmada"}` sobre la misma reserva `pendiente` → uno 200 y el otro 409 | Nuestro código (UPDATE condicional: el estado cambió entre la lectura y la escritura) | `TRANSICION_NO_PERMITIDA` | `estados.test.ts` · dos PATCH simultáneos |
| **422** | `PATCH /api/reservas/{id}/estado` con `{"estado":"pagada"}` | **Zod** | `DATOS_INVALIDOS` (con `campos.estado`) | `estados.test.ts` · estado inválido |
| **422** | `GET /api/clientes/abc` o `GET /api/clientes/0/reservas` | **Zod** | `DATOS_INVALIDOS` (con `campos.id`) | `clientes.test.ts` · id no válido |
| **422** | `POST /api/reservas` con `"hora_inicio": 23` | **Zod** | `DATOS_INVALIDOS` (con `campos.hora_inicio`) | `errores-api.test.ts` · hora 23 |
| **422** | `POST /api/reservas` con `"fecha": "2020-01-01"` | **Zod** (regla pura de `lib/reservas/fechas.ts`) | `DATOS_INVALIDOS` (con `campos.fecha`) | `errores-api.test.ts` · fecha pasada |
| **422** | `POST /api/reservas` con `"precio": 1, "estado": "confirmada"` de más | **Zod** (esquema estricto) | `DATOS_INVALIDOS` (con `campos.precio` y `campos.estado`) | `errores-api.test.ts` · campos extra |
| **422** | `POST /api/reservas` con cuerpo `{"cliente_id": 1,` (JSON roto) | Nuestro código (`leerJson`) | `DATOS_INVALIDOS` (con `campos.cuerpo`) | `errores-api.test.ts` · JSON roto |
| **422** | `POST /api/reservas` con `"cliente_id": 999999999` | **Base de datos** (FK `reservas_cliente_id_fkey`); nuestro código traduce el error | `CLIENTE_NO_EXISTE` | `errores-api.test.ts` · cliente inexistente |
| **422** | `POST /api/reservas` con `"cancha_id": 999` | Nuestro código (busca la tarifa antes de insertar) | `CANCHA_NO_EXISTE` | `errores-api.test.ts` · cancha inexistente |
| **422** | `POST /api/reservas` a una cancha sin tarifas (cancha temporal 98) | Nuestro código (`tarifaParaHora` no encuentra precio) | `SIN_TARIFA` | `errores-api.test.ts` · cancha sin tarifa |
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

- **422 "Ese bloque de hoy ya empezó."** Depende de la hora real, así que no se prueba contra la base. Lo cubre la prueba unitaria con una hora fija (`tests/reservas/esquemas.test.ts`).
- **500 `ERROR_INTERNO`.** Exigiría apagar Supabase en medio de la prueba. Solo tiene prueba unitaria (`tests/reservas/errores-db.test.ts`).
