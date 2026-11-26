// Funciones puras de los scripts MCP (probar-mcp.ts y configurar-mcp.ts).
// Pruebas: tests/scripts/mcp-util.test.ts.

/** Un servidor MCP local listo para configurar en un agente (rutas absolutas). */
export type ServidorMcp = {
  nombre: string;
  command: string;
  args: string[];
  env: Record<string, string>;
};

// ---------- probar-mcp ----------

export const USO =
  "Uso: npm run mcp:probar -- <servidor.ts | URL http> [herramienta] [clave=valor ...]\n" +
  "  Ej.: npm run mcp:probar -- mcp_servers/fs-server.ts leer_archivo ruta=AGENTS.md\n" +
  "       npm run mcp:probar -- http://127.0.0.1:8765/mcp listar_archivos carpeta=docs";

/** "3" → 3, "true" → true, '["a"]' → ["a"]; si no es JSON válido, el texto tal cual. */
export function valorDeTexto(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

export type ArgumentosPrueba =
  | { ok: true; servidor: string; herramienta?: string; argumentos: Record<string, unknown> }
  | { ok: false; error: string };

export function parsearArgumentos(argv: readonly string[]): ArgumentosPrueba {
  const [servidor, herramienta, ...pares] = argv;
  if (!servidor) return { ok: false, error: "Falta el servidor." };

  const argumentos: Record<string, unknown> = {};
  for (const par of pares) {
    const i = par.indexOf("=");
    if (i <= 0) return { ok: false, error: `Argumento inválido '${par}': usa clave=valor` };
    argumentos[par.slice(0, i)] = valorDeTexto(par.slice(i + 1));
  }
  return herramienta ? { ok: true, servidor, herramienta, argumentos } : { ok: true, servidor, argumentos };
}

// ---------- configurar-mcp ----------

/** Lee el name de `new McpServer({ name: "…" })` en el código fuente de un servidor. */
export function nombreDelServidor(codigoFuente: string): string | null {
  return codigoFuente.match(/new McpServer\(\s*\{[^}]*?\bname:\s*["']([^"']+)["']/)?.[1] ?? null;
}

type ConfigJson = Record<string, unknown> & { mcpServers: Record<string, Record<string, unknown>> };

/** Formato de Claude Code (.mcp.json) y Antigravity (.agents/mcp_config.json). */
export function configJson(servidores: readonly ServidorMcp[]): ConfigJson {
  return {
    mcpServers: Object.fromEntries(
      servidores.map((s) => [s.nombre, { command: s.command, args: [...s.args], env: { ...s.env } }]),
    ),
  };
}

/** Conserva otras claves y servidores ajenos; reemplaza los nuestros. */
export function fusionarJson(existente: unknown, nuevo: ConfigJson): ConfigJson {
  const base = typeof existente === "object" && existente !== null ? (existente as Record<string, unknown>) : {};
  const servidores =
    typeof base.mcpServers === "object" && base.mcpServers !== null
      ? (base.mcpServers as ConfigJson["mcpServers"])
      : {};
  return { ...base, mcpServers: { ...servidores, ...nuevo.mcpServers } };
}

const INICIO = "# >>> generado por npm run mcp:configurar";
const FIN = "# <<< generado por npm run mcp:configurar";

/** Cadena TOML básica: JSON.stringify produce escapes válidos en TOML ("\\", "\"", \uXXXX). */
const tomlTexto = (s: string) => JSON.stringify(s);

/** Formato de Codex (.codex/config.toml), dentro de un bloque delimitado para poder regenerarlo. */
export function configToml(servidores: readonly ServidorMcp[]): string {
  const lineas = [`${INICIO} (rutas de esta máquina; no subir al repo)`];
  for (const s of servidores) {
    const clave = `mcp_servers.${tomlTexto(s.nombre)}`;
    lineas.push(
      "",
      `[${clave}]`,
      `command = ${tomlTexto(s.command)}`,
      `args = [${s.args.map(tomlTexto).join(", ")}]`,
      "",
      `[${clave}.env]`,
      ...Object.entries(s.env).map(([k, v]) => `${k} = ${tomlTexto(v)}`),
    );
  }
  lineas.push("", FIN);
  return `${lineas.join("\n")}\n`;
}

/** Reemplaza solo nuestro bloque (o lo agrega al final); el resto del archivo queda igual. */
export function fusionarToml(existente: string | null, bloque: string): string {
  if (!existente || existente.trim() === "") return bloque;
  const inicio = existente.indexOf(INICIO);
  const fin = existente.indexOf(FIN);
  if (inicio !== -1 && fin > inicio) {
    const despues = existente.indexOf("\n", fin);
    return existente.slice(0, inicio) + bloque + (despues === -1 ? "" : existente.slice(despues + 1));
  }
  return `${existente.trimEnd()}\n\n${bloque}`;
}
