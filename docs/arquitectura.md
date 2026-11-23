# Arquitectura

## 1. Contexto

Quién usa el sistema de reservas.

```mermaid
flowchart LR
    cliente["Cliente"]
    admin["Administrador"]
    dev["Desarrollador"]
    agente["Agente IA"]
    sistema["Sistema de reservas"]

    cliente -->|"Reserva cancha"| sistema
    admin -->|"Gestiona reservas"| sistema
    dev -->|"Da instrucciones"| agente
    dev -->|"Desarrolla"| sistema
    agente -->|"Consulta y prueba"| sistema
```

## 2. Contenedores

Piezas del sistema y cómo se conectan.

```mermaid
flowchart LR
    navegador["Navegador"]
    app["App Next.js"]
    db[("Supabase Postgres")]
    agente["Agente IA"]
    mcp["Servidores MCP"]

    navegador -->|"HTTP"| app
    app -->|"Lee y escribe"| db
    agente --> mcp
    mcp -->|"Solo lectura"| db
    mcp -->|"Escrituras"| app
```

## 3. Componentes de la app (C4 nivel 3)

Monolito modular con dos contextos: `canchas` (canchas y tarifas) y `reservas` (clientes, reservas y disponibilidad). `reservas` puede usar `canchas`, nunca al revés; ESLint lo hace cumplir. `lib/` tiene solo reglas puras y esquemas Zod; `servidor/` accede a Supabase. La validación va en dos capas, según la ADR-0002.

```mermaid
flowchart TB
    subgraph app["App Next.js"]
        subgraph ctx_reservas["Contexto reservas"]
            rutas_reservas["app/api/(reservas)/<br/>(disponibilidad, reservas)"]
            esquemas["lib/reservas/<br/>(esquemas Zod y reglas puras)"]
            datos_reservas["servidor/reservas/consultas.ts"]
        end

        subgraph ctx_canchas["Contexto canchas"]
            ruta_canchas["app/api/(canchas)/canchas"]
            datos_canchas["servidor/canchas/consultas.ts"]
        end

        cliente_db["servidor/supabase.ts<br/>(cliente de Supabase)"]
    end

    db[("Supabase Postgres")]

    rutas_reservas -->|"Valida entrada"| esquemas
    rutas_reservas -->|"Lee y escribe"| datos_reservas
    ruta_canchas -->|"Lee"| datos_canchas
    ctx_reservas -->|"Usa (nunca al revés)"| ctx_canchas
    datos_reservas --> cliente_db
    datos_canchas --> cliente_db
    cliente_db -->|"SQL (índice único parcial y CHECK)"| db
```

Se quitaron, para simplificar, el navegador, `lib/canchas/tarifas.ts`, `lib/compartido/` y `servidor/http.ts` (formato de error y validación), y las flechas entre reglas puras; la dependencia reservas → canchas se muestra una sola vez, entre contextos.

## 4. Riesgos aceptados

Riesgos conocidos que se aceptan mientras el sistema sea un MVP que corre en local o en demos.

| Riesgo | Por qué se acepta en el MVP | Cuándo resolverlo |
|---|---|---|
| **Cualquiera puede crear reservas para cualquier `cliente_id`**, sin login ni límite de peticiones. La API usa la clave secreta de Supabase, que omite RLS. | No hay login por decisión (ADR-0001) y el sistema no está publicado. | **Antes de publicar en internet:** límite de peticiones por IP, verificar al cliente (login o código por SMS) y exigir `Content-Type: application/json` en el POST. |
| **Exposición de datos personales:** `GET /api/reservas/[id]` usa ids consecutivos y muestra el nombre del cliente; `CLIENTE_NO_EXISTE` revela qué ids de cliente existen. | Solo hay clientes de prueba del seed. | **Antes de cargar datos reales de clientes:** quitar el nombre de la respuesta o usar un identificador público aleatorio (uuid). |
