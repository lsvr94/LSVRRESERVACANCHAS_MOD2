# Resumen S3: MCP (2026-11-25)

1. Un servidor MCP expone **herramientas** (acciones con parámetros, p. ej. `leer_archivo`, `buscar_texto`, `contar_lineas`) y **resources** (datos de solo lectura con URI, p. ej. `adr://lista`).
2. El mismo servidor puede correr por **stdio** (el agente lo lanza como proceso; stdout es el protocolo, así que nada de `console.log`) o por **HTTP** (`http://127.0.0.1:8765/mcp`).
3. La seguridad va en el servidor: rutas restringidas al proyecto, solo lectura por defecto y una única escritura acotada (`guardar_nota`, que solo crea notas nuevas en `docs/notas/`), todo vigilado por ESLint.
4. Se puede probar sin agente con un cliente propio (`npm run mcp:probar`) o con MCP Inspector, que muestra los mensajes JSON-RPC (initialize, tools/list, tools/call, resources/read).
5. `npm run mcp:configurar` conecta el servidor a Claude Code, Codex y otros agentes, y se usa el SDK v2 (`@modelcontextprotocol/server`/`client`), nunca la v1 `@modelcontextprotocol/sdk`.
