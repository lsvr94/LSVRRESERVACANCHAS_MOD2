# ADR 0001: Stack Next.js + Supabase

**Estado:** Aceptado
**Fecha:** 2026-11-22

## Contexto
Sistema de reservas para 3 canchas en bloques de 1 hora (10:00–23:00). La regla crítica es que no haya dos reservas para la misma cancha y hora, aunque lleguen a la vez. El equipo es pequeño y el sistema debe correr en una laptop para desarrollo.

## Decisión
Usar Next.js (App Router, TypeScript) para la interfaz y el servidor, y Supabase (Postgres administrado) como base de datos. Las reglas de negocio puras viven en `lib/` y se prueban con Vitest; el esquema se versiona como migraciones SQL.

## Consecuencias
- (+) Un solo lenguaje (TypeScript) para frontend, backend y pruebas.
- (+) Postgres garantiza la no duplicidad con restricciones (`UNIQUE`/exclusión), no solo con código.
- (+) Row Level Security incluido: menos código propio de seguridad.
- (−) Dependencia de un proveedor externo; mitigada porque es Postgres estándar y migrable.
- (−) Las políticas RLS mal escritas pueden exponer datos; requieren revisión y pruebas.
- (−) Next.js App Router añade complejidad (server/client components, caché).
- (−) Para desarrollo local, Supabase necesita Docker abierto.

## Alternativas consideradas
- **FastAPI + SQLite:** simple y sin costo, pero obliga a dos lenguajes (Python + un frontend aparte) y a alojar un servidor con disco persistente; SQLite maneja mal escrituras concurrentes.
- **Firebase (Firestore):** muy rápido para prototipar y con Auth incluido, pero al ser NoSQL no hay restricciones únicas: evitar reservas duplicadas exige transacciones y reglas a mano. Además genera mayor dependencia del proveedor y no tiene migraciones SQL versionables.
