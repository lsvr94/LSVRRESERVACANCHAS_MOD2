// Reglas de rutas seguras del servidor MCP de archivos. Puro: solo manipula texto
// (node:path), nunca toca el disco. Las pruebas están en tests/mcp/rutas.test.ts.
import path from "node:path";

/** Tamaño máximo de archivo que se puede leer, en bytes. */
export const TAMANO_MAXIMO = 100_000;

/** Nombres bloqueados en cualquier nivel de la ruta (además de todo lo que empiece por ".env"). */
const PROTEGIDOS = new Set([".git", "node_modules", ".next", ".mcp.json", ".codex", ".gemini", ".agents"]);

/** Secuencias de carpetas bloqueadas (p. ej. supabase/.temp, que guarda datos del CLI). */
const SECUENCIAS_PROTEGIDAS = [["supabase", ".temp"]];

export function mensajeFuera(ruta: string): string {
  return `Acceso denegado: '${ruta}' está fuera del proyecto`;
}

export function mensajeProtegida(ruta: string): string {
  return `Acceso denegado: '${ruta}' es una carpeta o archivo protegido`;
}

function segmentos(ruta: string): string[] {
  return ruta.split(/[\\/]+/).filter((s) => s !== "" && s !== ".");
}

/** true si algún segmento de la ruta (relativa a la raíz) es un secreto o una carpeta interna. */
export function esProtegida(rutaRelativa: string): boolean {
  const partes = segmentos(rutaRelativa);
  if (partes.some((p) => p.startsWith(".env") || PROTEGIDOS.has(p))) return true;
  return SECUENCIAS_PROTEGIDAS.some((secuencia) =>
    partes.some((_, i) => secuencia.every((s, j) => partes[i + j] === s)),
  );
}

export type ResultadoRuta = { ok: true; relativa: string } | { ok: false; error: string };

/**
 * Decide si una ruta ya resuelta (absoluta, sin ".." ni enlaces) se puede usar.
 * `rutaPedida` es lo que escribió el agente: es lo único que aparece en los mensajes,
 * para no revelar rutas absolutas del equipo.
 */
export function comprobarRuta(raiz: string, rutaAbsoluta: string, rutaPedida: string): ResultadoRuta {
  const relativa = path.relative(raiz, rutaAbsoluta);
  // Fuera si sube de la raíz o está en otra unidad (Windows). Así "/repo2" no cuenta como dentro de "/repo".
  if (path.isAbsolute(relativa) || segmentos(relativa)[0] === "..") {
    return { ok: false, error: mensajeFuera(rutaPedida) };
  }
  if (esProtegida(relativa)) {
    return { ok: false, error: mensajeProtegida(rutaPedida) };
  }
  return { ok: true, relativa: relativa === "" ? "." : relativa.split(path.sep).join("/") };
}
