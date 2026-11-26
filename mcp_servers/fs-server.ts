// Servidor MCP "reservas-archivos" (SDK v2): lista, lee, cuenta líneas y busca texto en archivos del proyecto, solo lectura.
//   npm run mcp:archivos            → stdio (lo arranca el cliente MCP)
//   npm run mcp:archivos -- --http  → Streamable HTTP en http://127.0.0.1:8765/mcp
// NUNCA escribir en stdout (console.log): en stdio es el canal del protocolo. Logs → stderr.
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toNodeHandler } from "@modelcontextprotocol/node";
import {
  createMcpHandler,
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  McpServer,
  originValidationResponse,
} from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import {
  buscarTexto,
  contarLineas,
  ErrorDeHerramienta,
  leerArchivo,
  listarArchivos,
  MAX_COINCIDENCIAS,
} from "./archivos";

const RAIZ = process.env.FS_RAIZ ?? fileURLToPath(new URL("..", import.meta.url));
const HOST = "127.0.0.1";
const PUERTO = 8765;

function log(...partes: unknown[]) {
  console.error("[reservas-archivos]", ...partes);
}

/** Resultado de herramienta: texto o error de herramienta (isError) con mensaje apto para el agente. */
async function ejecutar(accion: () => Promise<string>) {
  try {
    return { content: [{ type: "text" as const, text: await accion() }] };
  } catch (error) {
    if (error instanceof ErrorDeHerramienta) {
      return { isError: true, content: [{ type: "text" as const, text: error.message }] };
    }
    log("error inesperado:", error); // el detalle solo va a stderr
    return { isError: true, content: [{ type: "text" as const, text: "No se pudo completar la operación." }] };
  }
}

function crearServidor(): McpServer {
  const servidor = new McpServer({ name: "reservas-archivos", version: "1.0.0" });

  servidor.registerTool(
    "listar_archivos",
    {
      description:
        "Lista los archivos y carpetas de una carpeta del proyecto de reservas de canchas (solo lectura). " +
        "Devuelve un nombre por línea, ordenado; las carpetas terminan en '/'. " +
        "No muestra secretos (.env*) ni carpetas internas (.git, node_modules, .next). " +
        "Úsala primero para descubrir qué archivos existen antes de leerlos.",
      inputSchema: z.object({
        carpeta: z
          .string()
          .default(".")
          .describe("Carpeta relativa a la raíz del proyecto, por ejemplo '.', 'docs' o 'lib/reservas'."),
      }),
    },
    async ({ carpeta }) =>
      ejecutar(async () => {
        const nombres = await listarArchivos(RAIZ, carpeta);
        return nombres.length > 0 ? nombres.join("\n") : "(carpeta vacía)";
      }),
  );

  servidor.registerTool(
    "leer_archivo",
    {
      description:
        "Lee el contenido de un archivo de texto UTF-8 del proyecto de reservas de canchas (solo lectura, " +
        "máximo 100 000 bytes). Sirve para código, documentación (AGENTS.md, docs/), migraciones SQL y pruebas. " +
        "No puede leer secretos (.env*) ni archivos fuera del proyecto. Si no sabes la ruta, usa listar_archivos.",
      inputSchema: z.object({
        ruta: z.string().min(1).describe("Ruta del archivo relativa a la raíz del proyecto, por ejemplo 'AGENTS.md'."),
      }),
    },
    async ({ ruta }) => ejecutar(() => leerArchivo(RAIZ, ruta)),
  );

  servidor.registerTool(
    "contar_lineas",
    {
      description:
        "Cuenta las líneas de un archivo de texto del proyecto de reservas de canchas (solo lectura) y devuelve " +
        "solo el número, por ejemplo '62'. Una última línea sin salto final también cuenta; un archivo vacío da 0. " +
        "Tiene los mismos límites que leer_archivo: máximo 100 000 bytes, sin secretos (.env*) ni carpetas internas, " +
        "nada fuera del proyecto. Úsala cuando solo necesitas el tamaño de un archivo, sin leerlo entero.",
      inputSchema: z.object({
        ruta: z.string().min(1).describe("Ruta del archivo relativa a la raíz del proyecto, por ejemplo 'AGENTS.md'."),
      }),
    },
    async ({ ruta }) => ejecutar(async () => String(await contarLineas(RAIZ, ruta))),
  );

  servidor.registerTool(
    "buscar_texto",
    {
      description:
        "Busca un texto LITERAL (no es una expresión regular; distingue mayúsculas y minúsculas) en los archivos " +
        ".ts, .tsx, .md y .sql del proyecto de reservas de canchas (solo lectura). Devuelve hasta " +
        `${MAX_COINCIDENCIAS} coincidencias, una por línea, con el formato 'ruta:línea: texto'. ` +
        "No busca en secretos (.env*), carpetas internas (.git, node_modules, .next) ni fuera del proyecto. " +
        "Para ver el contexto de una coincidencia, usa leer_archivo con esa ruta.",
      inputSchema: z.object({
        patron: z
          .string()
          .min(1)
          .max(200)
          .describe("Texto exacto a buscar, por ejemplo 'registerTool' o 'create table'. Los caracteres como . * ( no son especiales."),
      }),
    },
    async ({ patron }) =>
      ejecutar(async () => {
        const { coincidencias, truncado } = await buscarTexto(RAIZ, patron);
        if (coincidencias.length === 0) return `Sin coincidencias para '${patron}'`;
        const aviso = truncado
          ? `\n(se muestran solo las primeras ${MAX_COINCIDENCIAS} coincidencias; usa un patrón más específico)`
          : "";
        return coincidencias.join("\n") + aviso;
      }),
  );

  return servidor;
}

function servirHttp() {
  const mcp = createMcpHandler(crearServidor);
  const manejador = toNodeHandler({
    fetch: async (peticion: Request) => {
      // Solo localhost: evita DNS rebinding (la v2 no valida Host ni Origin por sí sola).
      const rechazo =
        hostHeaderValidationResponse(peticion, localhostAllowedHostnames()) ??
        originValidationResponse(peticion, localhostAllowedOrigins());
      if (rechazo) return rechazo;
      if (new URL(peticion.url).pathname !== "/mcp") return new Response("No encontrado", { status: 404 });
      return mcp.fetch(peticion);
    },
  });

  createServer((req, res) => {
    manejador(req, res).catch((error) => {
      log("error HTTP:", error);
      if (!res.headersSent) res.writeHead(500).end();
    });
  }).listen(PUERTO, HOST, () => log(`escuchando en http://${HOST}:${PUERTO}/mcp (raíz: ${path.basename(RAIZ)})`));
}

if (process.argv.includes("--http")) {
  servirHttp();
} else {
  serveStdio(crearServidor);
  log("listo por stdio");
}
