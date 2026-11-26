# Bitácora de evidencias · Sesión 1 · 2026-11-22
Proyecto: reservas de canchas (Next + Supabase). Repo: lsvr94/LSVRRESERVACANCHAS_MOD2

## Qué hice
- Proyecto con Next.js, Supabase CLI y Vitest; npm test pasa.
- AGENTS.md (manual para la IA) y CLAUDE.md conectado con @AGENTS.md.
- ADR-0001 (stack) y ADR-0002 (dónde viven las reglas).
- Diagramas C4: contexto, contenedores y componentes.
- Ejercicios 1.1 a 1.6 completos.

## Ejercicio 1.2
Vitest 5.1.1. package-lock.json fija las versiones. Al borrar node_modules
y correr npm ci, volvió la misma versión.

## Ejercicio 1.5 (problemas del AGENTS.md malo)
Regla vaga, comando ambiguo, secreto expuesto, borrar el lock, estilo no
escrito, falta mapa de carpetas.

## Errores y cómo los resolví
- AGENTS.md quedó vacío: en modo plan no se guarda hasta aprobar el plan.
- Claude no veía AGENTS.md: renombré la carpeta con VS Code abierto; la reabrí.

## Qué corregí del agente
- En el ADR-0001 inventó login y despliegue en Vercel, y olvidó Docker.

## Dudas para la sesión 2
- ¿El docente acepta Next + Supabase?

## Capturas

### husky-bloquea-commit.png
![Hook pre-commit de husky bloqueando un commit](capturas/husky-bloquea-commit.png)

El hook pre-commit (husky + lint-staged) bloquea el commit de `lib/prueba.ts` porque ESLint encuentra una variable sin usar (`sinUsar`) y `--max-warnings=0` no admite ni una advertencia.


## Sesión 2 · 22 al 25/11/2026 · Base de datos y API co-diseñadas con el agente

### Qué construí
- Base de datos en Supabase local con 4 tablas: canchas, tarifas, clientes y reservas.
- API en Next.js con dos contextos (canchas y reservas) como monolito modular:
  GET /api/canchas, GET /api/disponibilidad, POST /api/reservas,
  GET /api/reservas/[id], PATCH /api/reservas/[id]/estado,
  GET /api/clientes/[id] y GET /api/clientes/[id]/reservas.
- Contratos con Zod y formato único de error.
- Pantalla /reservas que usa solo la API, con "Mis reservas".
- Pruebas: 79 unitarias (npm test) y 28 de integración contra la base real
  (npm run test:integracion).
- Diagramas C4 actualizados y diagrama entidad-relación.

### Decisiones que tomé (el agente propuso, yo decidí)
- 4 tablas: agregué tarifas porque el precio cambia de día (S/ 80) a noche (S/ 120).
- "Recaudado" = suma de las reservas confirmadas. Confirmar = pagó.
- Sin login por ahora (coherente con ADR-0001).
- Disponibilidad vive en el contexto reservas para que la dependencia vaya en un
  solo sentido: reservas usa canchas, nunca al revés. ESLint lo hace cumplir.
- 404 solo para el recurso de la URL; 422 para datos inválidos del cuerpo.
- Zona horaria del negocio America/Lima; la base trabaja en UTC.
- El precio lo fija la base con un trigger y no se puede cambiar después
  (precio histórico).
- No separar canchas en un microservicio (ADR-0003).

### Lo que agregó el agente y acepté
- Regla para que dos tarifas no se solapen en la misma cancha (btree_gist).
- Carpeta servidor/ con 'server-only': la clave secreta nunca llega al navegador.
- ESLint impide que la pantalla importe de servidor/ o de @supabase/.
- Código de error propio (RS001) para no depender del texto de Postgres.

### Pruebas como especificación
- En cada paso el agente escribió primero las pruebas, comprobó que fallaban
  y después implementó.
- Dos reservas simultáneas al mismo bloque: una 201 y otra 409. Lo vi también
  en la pantalla con dos pestañas.
- Las pruebas encontraron errores reales: un id inválido se reportaba en el
  campo equivocado, y una prueba esperaba mal la cantidad de asteriscos.

### Revisión crítica (Paso 10)
- Riesgo 3 (precio solo en la app): corregido con trigger.
- Riesgo 4 (cambios de estado sin control en la base): corregido en el ejercicio 2.3.
- Riesgo 5 (sin pruebas contra la base real): corregido con pruebas de integración.
- Riesgos 1 y 2 (sin login, ids consecutivos): aceptados para el MVP y
  documentados en docs/arquitectura.md con cuándo resolverlos.

### Ejercicios
- 2.1 GET /api/clientes/[id] con teléfono enmascarado (riesgo 2).
- 2.2 docs/codigos-http.md: cada código HTTP con la capa que lo produce.
  El 409 lo producen tres capas distintas.
- 2.3 PATCH de estado con reglas en la API y en la base (trigger).
- 2.4 "Mis reservas" en la pantalla.
- 2.5 EXPLAIN con 101.400 reservas: "Mis reservas" hacía Seq Scan; con el
  índice en cliente_id pasó a ser unas 39 veces más rápida.
- 2.6 ADR-0003: no separar canchas; condición de revisión escrita.

### Errores y cómo los resolví
- El nombre interno seguía siendo "oam" en package.json: lo cambié a "lsvr".
- Advertencia de Vite por formato de configuración: se renombraron los
  archivos a .mts.
- Supabase local necesita Docker abierto y expone servicios en la red: lo
  apago cuando no lo uso.

### Dudas para la sesión 3
- ¿Acepta el docente el stack Next + Supabase y la convención 404/422?

### Capturas
![35 pruebas](capturas/s2-01-tests-35-passed.png)
![54 pruebas](capturas/s2-02-tests-54-passed.png)
![API disponibilidad](capturas/s2-03-api-disponibilidad.png)
![Diagramas C4](capturas/s2-04-diagramas-c4.png)
![Reserva exitosa](capturas/s2-05-pantalla-reserva-ok.png)
![Agente sabe levantar el sistema](capturas/s2-09-agente-levantar-sistema.png)
![Ejercicio 2.3](capturas/s2-10-ejercicio-2-3-tests.png)
![Mis reservas](capturas/s2-11-mis-reservas.png)


## Sesión 3 · 25/11/2026 · MCP (Model Context Protocol)

### Qué construí
- Servidor MCP propio `reservas-archivos` en TypeScript (`mcp_servers/fs-server.ts`)
  con las tools listar_archivos, leer_archivo, contar_lineas y buscar_texto.
- Lo probé sin agente con `npm run mcp:probar` y con MCP Inspector
  (mensajes JSON-RPC: initialize, tools/list, tools/call).
- Lo conecté a Claude Code con `npm run mcp:configurar`.
- Modo HTTP (`--http`) solo en 127.0.0.1:8765, con validación de Host y Origin.
- Ejercicio 3.5: resource `adr://lista` y anotaciones (readOnlyHint,
  destructiveHint, openWorldHint).
- Ejercicio 3.6: `guardar_nota`, la única tool que escribe (solo en docs/notas/).

### Decisiones que tomé
- TypeScript en vez de Python: un solo lenguaje con Next + Supabase.
- SDK MCP v2 fijado; nunca `@modelcontextprotocol/sdk` (v1). Quedó como regla en AGENTS.md.
- Privilegio mínimo: todo es de solo lectura salvo `guardar_nota`, que usa el flag
  `wx` (no sobrescribe), valida el nombre (a-z0-9-, de 1 a 40 caracteres) y acepta
  un texto de hasta 5000 caracteres.
- Rutas bloqueadas: .env*, .git, node_modules, .next, supabase/.temp, .mcp.json,
  .codex, .gemini y .agents. Doble validación y control de enlaces simbólicos.
- Lectura de hasta 100 000 bytes por archivo.
- stdio: nada de console.log, porque stdout lleva el protocolo. Los logs van a
  stderr y ESLint lo vigila.
- HTTP solo local, con Host y Origin validados contra el DNS rebinding.
  Nunca se publica sin autenticación ni HTTPS.
- Resource vs tool: `adr://lista` solo entrega los nombres (datos). Para leer el
  contenido, el agente tiene que usar una tool (`leer_archivo`).

### Lo que aprendí
La seguridad se programa en el servidor, no se le pide al agente. El agente solo
puede hacer lo que el servidor expone.

### Capturas
![Rutas bloqueadas](capturas/s3-01-bloqueos-mcp.png)
![MCP conectado](capturas/s3-02-mcp-conectado.png)
![Agente usa MCP](capturas/s3-03-agente-usa-mcp.png)
![MCP por HTTP](capturas/s3-04-mcp-http.png)
![MCP Inspector](capturas/s3-05-inspector.png)
![Resource adr://lista](capturas/s3-06-resource-adr.png)
![guardar_nota](capturas/s3-07-guardar-nota.png)
![Nota no se sobrescribe](capturas/s3-08-nota-no-sobrescribe.png)

Pruebas: 182 en verde, y lint y tsc sin errores.