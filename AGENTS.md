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

## Comandos
- Instalar: `npm ci`
- Pruebas: `npm test`
- Estilo: `npm run lint`
- Desarrollo: `npm run dev`

## Arquitectura
- `app/`: páginas de Next.js (App Router)
- `lib/`: reglas de negocio puras (ej. `lib/reservas.ts`)
- `tests/`: pruebas con Vitest
- `supabase/migrations/`: esquema de la base de datos (Postgres)
- `docs/adr/`: decisiones de arquitectura

## Reglas
- Dependencias solo con `npm install`; nunca editar `package-lock.json` a mano.
- Toda regla de negocio va en `lib/` y lleva su prueba en `tests/`.
- Cambios en la base de datos solo como migración nueva en `supabase/migrations/`.
- Antes de terminar una tarea, corre `npm test` y `npm run lint`.
- Antes de cada commit corre husky (ESLint). Si falla, corrige; nunca uses `--no-verify`.

## No tocar
- Nunca leer ni mostrar `.env.local` ni keys de Supabase.