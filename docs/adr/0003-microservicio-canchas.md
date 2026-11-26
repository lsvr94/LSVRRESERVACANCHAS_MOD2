# ADR 0003: ¿Separar el contexto canchas en un microservicio?

**Estado:** Propuesto
**Fecha:** 2026-11-25

## Contexto
La app es un monolito modular: el contexto `canchas` (canchas y tarifas) y el contexto `reservas` (clientes, reservas y disponibilidad) corren en un mismo proceso Next.js y comparten una base Postgres. `reservas` usa `canchas`, nunca al revés, y ESLint lo hace cumplir. Se evalúa separar `canchas` en otro proceso con su propia base, y que `reservas` obtenga las tarifas por HTTP.

## Decisión
**No separar.** Se mantiene el monolito modular. La frontera ya existe en el código (`lib/`, `servidor/` y `app/api/` divididos por contexto) y ESLint la vigila, así que separar más adelante sigue siendo posible y no exige rehacer el diseño.

## Consecuencias (de separar; por eso no se hace ahora)
- (−) **Trigger de precio:** `reservas_precio_desde_tarifa` lee `tarifas` en la misma base, y no podría leer la base de otro servicio. Habría que replicar las tarifas en la base de reservas (con eventos) o fijar el precio solo en la app. Esto último reabre el riesgo 3: un agente IA podría volver a guardar cualquier precio.
- (−) **Sin una transacción común:** hoy la tarifa, el insert y el índice único ocurren en una sola base. Separados, la tarifa leída por HTTP puede cambiar antes del insert; habría que versionar las tarifas o aceptar consistencia eventual en algo que es dinero.
- (−) **Canchas caído al reservar:** no se podría reservar ni ver disponibilidad, porque las dos necesitan tarifas. Evitarlo exige caché de tarifas, timeouts y reintentos, y aparecen respuestas 503 nuevas.
- (−) **Latencia:** cada POST y cada consulta de disponibilidad sumarían una llamada de red. Hoy es una consulta indexada en la misma base (menos de 1 ms en local, ver EXPLAIN en `docs/arquitectura.md`).
- (−) **Despliegue y pruebas:** habría dos procesos, dos bases y dos juegos de migraciones y variables. Las pruebas de integración necesitarían los dos servicios levantados, o pruebas de contrato.
- (−) **Agente IA:** hoy lee un solo `AGENTS.md` y un esquema SQL con todas las reglas juntas. Separado, tendría que entender dos bases, un contrato HTTP y en qué lugar vive cada regla.
- (+) **Lo que se ganaría:** escalar y desplegar `canchas` por separado y que equipos independientes cambien tarifas sin tocar `reservas`. Con 3 canchas, un equipo pequeño y tarifas que cambian poco, hoy ninguna de esas ganancias se aprovecha.

## Alternativas consideradas
- **Microservicio de canchas con réplica de tarifas en la base de reservas (por eventos):** conserva el trigger de precio, pero añade mensajería, consistencia eventual y otro servicio que operar. Es demasiado para un MVP.
- **Mantener el monolito modular (elegida):** una base, una transacción, triggers que garantizan las reglas y un solo despliegue.

## Condición de revisión
Separar `canchas` cuando se cumpla al menos una de estas condiciones:
1. Otro equipo pasa a ser dueño del catálogo de canchas y tarifas, y necesita desplegar a su propio ritmo.
2. Otros sistemas consumen canchas (varias sedes, apps de terceros) con una carga muy distinta a la de reservas.
3. Una medición, no una suposición, muestra que canchas limita el escalado del monolito.

Antes de separar: replicar las tarifas en la base de reservas para conservar el trigger de precio, y definir el contrato HTTP con pruebas de contrato.
