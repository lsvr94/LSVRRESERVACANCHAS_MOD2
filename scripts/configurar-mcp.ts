// Genera la configuración MCP del proyecto para los servidores de mcp_servers/:
//   Claude Code → .mcp.json · Codex → .codex/config.toml · Antigravity → .agents/mcp_config.json
// Usa rutas absolutas (el agente puede lanzarlo desde cualquier carpeta), por eso estos
// archivos son de esta máquina y NO se suben al repo (.gitignore).
//   npm run mcp:configurar
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configJson, configToml, fusionarJson, fusionarToml, nombreDelServidor, type ServidorMcp } from "./mcp-util";

const RAIZ = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const TSX = path.join(RAIZ, "node_modules", ".bin", "tsx");

const DESTINOS = {
  claude: path.join(RAIZ, ".mcp.json"),
  codex: path.join(RAIZ, ".codex", "config.toml"),
  antigravity: path.join(RAIZ, ".agents", "mcp_config.json"),
};

async function descubrirServidores(): Promise<ServidorMcp[]> {
  const carpeta = path.join(RAIZ, "mcp_servers");
  const archivos = (await readdir(carpeta)).filter((a) => a.endsWith("-server.ts")).sort();
  const servidores: ServidorMcp[] = [];
  for (const archivo of archivos) {
    const ruta = path.join(carpeta, archivo);
    const nombre = nombreDelServidor(await readFile(ruta, "utf8"));
    if (!nombre) {
      console.warn(`Omitido ${archivo}: no se encontró new McpServer({ name: … }).`);
      continue;
    }
    servidores.push({ nombre, command: TSX, args: [ruta], env: { FS_RAIZ: RAIZ } });
  }
  return servidores;
}

async function leerSiExiste(ruta: string): Promise<string | null> {
  return existsSync(ruta) ? readFile(ruta, "utf8") : null;
}

async function escribir(ruta: string, contenido: string) {
  await mkdir(path.dirname(ruta), { recursive: true });
  await writeFile(ruta, contenido);
}

async function escribirJson(ruta: string, servidores: ServidorMcp[]) {
  const actual = await leerSiExiste(ruta);
  let existente: unknown = null;
  if (actual) {
    try {
      existente = JSON.parse(actual);
    } catch {
      throw new Error(`${path.relative(RAIZ, ruta)} no es JSON válido; corrígelo o bórralo y vuelve a correr.`);
    }
  }
  await escribir(ruta, `${JSON.stringify(fusionarJson(existente, configJson(servidores)), null, 2)}\n`);
}

/** true si git ignora la ruta (git check-ignore sale con 0). */
function estaIgnorado(ruta: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", ruta], { cwd: RAIZ, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!existsSync(TSX)) throw new Error("Falta tsx: corre `npm ci` primero.");
  const servidores = await descubrirServidores();
  if (servidores.length === 0) throw new Error("No hay servidores en mcp_servers/ (*-server.ts).");

  await escribirJson(DESTINOS.claude, servidores);
  await escribir(DESTINOS.codex, fusionarToml(await leerSiExiste(DESTINOS.codex), configToml(servidores)));
  await escribirJson(DESTINOS.antigravity, servidores);

  console.log(`Servidores: ${servidores.map((s) => s.nombre).join(", ")}`);
  let todosIgnorados = true;
  for (const [agente, ruta] of Object.entries(DESTINOS)) {
    const ignorado = estaIgnorado(ruta);
    todosIgnorados &&= ignorado;
    console.log(`  ${agente.padEnd(12)} ${path.relative(RAIZ, ruta).padEnd(26)} ${ignorado ? "ignorado por git ✔" : "¡NO está en .gitignore!"}`);
  }
  console.log("Estos archivos tienen rutas absolutas de esta máquina: no los subas al repo.");
  console.log("Codex solo usa .codex/config.toml si el proyecto está marcado como de confianza.");
  if (!todosIgnorados) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`No se pudo configurar MCP: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
