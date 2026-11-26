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

## Levantar el sistema
1. Abre Docker Desktop.
2. `npm ci`
3. `npx supabase start` (Postgres local; URL y keys con `npx supabase status`).
4. `npx supabase db reset`: aplica migraciones y seed. **Borra los datos locales.**
5. Crea `.env.local` con `SUPABASE_URL=` y `SUPABASE_SECRET_KEY=` (valores de `npx supabase status`; nunca los subas al repo).
6. `npm run dev` y abre `http://localhost:3000/reservas`.

## Comandos
- Instalar: `npm ci`
- Pruebas: `npm test`
- Pruebas de integración (necesita Docker y `npx supabase start`): `npm run test:integracion`
- Estilo: `npm run lint`
- Servidor MCP de archivos: `npm run mcp:archivos` (stdio) o `npm run mcp:archivos -- --http` (http://127.0.0.1:8765/mcp)
- Probar un servidor MCP sin agente: `npm run mcp:probar -- <servidor.ts|URL http> [herramienta [clave=valor ...] | uri://resource]` (ej.: `npm run mcp:probar -- mcp_servers/fs-server.ts leer_archivo ruta=AGENTS.md` o `npm run mcp:probar -- mcp_servers/fs-server.ts adr://lista`)
- Configurar MCP en los agentes: `npm run mcp:configurar` (genera `.mcp.json`, `.codex/config.toml` y `.agents/mcp_config.json` con rutas absolutas de esta máquina; están en `.gitignore`, no se suben)
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
- `mcp_servers/`: servidores MCP (SDK v2), de solo lectura, con una única excepción: la herramienta `guardar_nota` (`mcp_servers/notas.ts`), que solo crea archivos nuevos en `docs/notas/` (nunca sobrescribe, modifica ni borra). Nunca importan de `servidor/` ni de `@supabase/`, nunca usan `console.log` (en stdio, stdout es el protocolo) y no importan funciones de escritura de `node:fs` (salvo `writeFile` y `mkdir` en `notas.ts`); lo hace cumplir ESLint.
- `app/reservas/` (pantallas): usa solo la API con `fetch`; nunca importa de `servidor/` ni de `@supabase/` (lo hace cumplir ESLint).
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
- MCP: usa el SDK **v2** (`@modelcontextprotocol/server` y `@modelcontextprotocol/client`, versión fijada; imports `@modelcontextprotocol/server`, `…/server/stdio`, `…/client/stdio` y `registerTool`). Nunca `@modelcontextprotocol/sdk`: es la v1 de los tutoriales antiguos (docs: https://ts.sdk.modelcontextprotocol.io/v2/).
- Responde siempre en español.

## No tocar
- Nunca leer ni mostrar `.env.local` ni keys de Supabase.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
