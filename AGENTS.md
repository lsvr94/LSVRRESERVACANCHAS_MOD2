# Reservas de canchas

Sistema de reservas para una empresa con 3 canchas.
Se reserva por bloques de 1 hora, de 10:00 a 23:00 (la última reserva empieza a las 22:00).

## Glosario
- Cancha: una de las 3 canchas (Cancha 1, 2 y 3).
- Cliente: persona que reserva (nombre y teléfono).
- Bloque: 1 hora; puede empezar de 10:00 a 22:00 (cierre 23:00).
- Reserva: un cliente + una cancha + una fecha + un bloque.
- Estado de la reserva: pendiente, confirmada o cancelada.
- Cambios de estado: pendiente → confirmada; pendiente o confirmada → cancelada. Una cancelada no vuelve atrás.
- Regla: no puede haber dos reservas no canceladas en la misma cancha, fecha y bloque.
- Zona horaria del negocio: America/Lima. "Hoy" se calcula en la app con esa zona, nunca con now() de la base (que está en UTC).

## Comandos
- Instalar: `npm ci`
- Pruebas: `npm test`
- Estilo: `npm run lint`
- Desarrollo: `npm run dev`

## Arquitectura
- `app/`: páginas de Next.js (App Router)
- `lib/`: reglas de negocio puras, en dos contextos (monolito modular):
  - `lib/canchas/`: canchas y tarifas.
  - `lib/reservas/`: clientes, reservas y disponibilidad.
  - `lib/compartido/`: tipos comunes (formato de error).
  - `reservas` puede usar `canchas`, nunca al revés (lo hace cumplir ESLint).
- `servidor/`: acceso a datos por contexto (`servidor/canchas/`, `servidor/reservas/`) y cliente de Supabase; solo servidor (`server-only`). Misma regla entre contextos.
- `app/api/(canchas)/` y `app/api/(reservas)/`: rutas de la API agrupadas por contexto.
- Errores de la API, formato único: `{ "error": { "codigo", "mensaje", "campos"? } }` (`campos` solo en errores de validación).
- 404 solo si no existe el recurso de la URL; 422 para datos inválidos o datos del cuerpo que no existen; 409 para choque de reservas.
- `tests/`: pruebas con Vitest
- `supabase/migrations/`: esquema de la base de datos (Postgres)
- `docs/adr/`: decisiones de arquitectura

## Reglas
- Dependencias solo con `npm install`; nunca editar `package-lock.json` a mano.
- Toda regla de negocio va en `lib/` y lleva su prueba en `tests/`.
- Cambios en la base de datos solo como migración nueva en `supabase/migrations/`.
- Antes de terminar una tarea, corre `npm test` y `npm run lint`.
- Antes de cada commit corre husky (ESLint). Si falla, corrige; nunca uses `--no-verify`.
- Zona horaria del negocio: America/Lima. "Hoy" se calcula en la app con esa zona, nunca con now() de la base (que está en UTC).

## No tocar
- Nunca leer ni mostrar `.env.local` ni keys de Supabase.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
