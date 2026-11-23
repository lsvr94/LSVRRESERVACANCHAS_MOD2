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

Archivos previstos dentro de la App Next.js (todavía no existen). La validación va en dos capas, según la ADR-0002.

```mermaid
flowchart LR
    navegador["Navegador"]
    db[("Supabase Postgres")]

    subgraph app["App Next.js"]
        pagina["app/reservas/page.tsx<br/>(página)"]
        acciones["app/reservas/actions.ts<br/>(server actions)"]
        esquemas["lib/esquemas.ts<br/>(validación Zod)"]
        reglas["lib/reservas.ts<br/>(reglas)"]
        cliente_db["lib/supabase/server.ts<br/>(cliente de Supabase)"]
    end

    navegador -->|"HTTP"| pagina
    pagina -->|"Envía formulario"| acciones
    acciones -->|"Valida entrada"| esquemas
    esquemas -->|"Usa reglas puras"| reglas
    acciones -->|"Lee y escribe"| cliente_db
    cliente_db -->|"SQL (restricciones únicas y CHECK)"| db
```
