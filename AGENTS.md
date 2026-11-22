# Reservas de canchas

Sistema de reservas para una empresa con 3 canchas.
Se reserva por bloques de 1 hora, de 10:00 a 23:00 (la última reserva empieza a las 22:00).

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

## No tocar
- Nunca leer ni mostrar `.env.local` ni keys de Supabase.