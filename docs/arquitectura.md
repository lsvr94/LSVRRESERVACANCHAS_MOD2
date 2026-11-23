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
