// Acceso al disco del servidor MCP de archivos. Solo lectura: no hay ninguna función que escriba.
// Herramientas: listar_archivos, leer_archivo, contar_lineas y buscar_texto.
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { comprobarRuta, esProtegida, TAMANO_MAXIMO } from "./rutas";

/** Error con un mensaje apto para el agente (sin rutas absolutas ni detalles del sistema). */
export class ErrorDeHerramienta extends Error {}

function exigir(resultado: ReturnType<typeof comprobarRuta>): string {
  if (!resultado.ok) throw new ErrorDeHerramienta(resultado.error);
  return resultado.relativa;
}

/**
 * Resuelve una ruta pedida por el agente y la valida dos veces:
 * 1) antes de tocar el disco (resuelve ".."), así un secreto se rechaza sin leerlo ni ver si existe;
 * 2) después de seguir los enlaces simbólicos (realpath), así un enlace no sirve para escapar.
 */
export async function resolverRutaSegura(raiz: string, rutaPedida: string) {
  const raizReal = await realpath(raiz);
  const absoluta = path.resolve(raizReal, rutaPedida);
  exigir(comprobarRuta(raizReal, absoluta, rutaPedida));

  let real: string;
  try {
    real = await realpath(absoluta);
  } catch {
    throw new ErrorDeHerramienta(`No existe '${rutaPedida}'`);
  }
  const relativa = exigir(comprobarRuta(raizReal, real, rutaPedida));
  return { real, relativa };
}

/** Nombres ordenados de una carpeta; las carpetas terminan en "/"; sin protegidos. */
export async function listarArchivos(raiz: string, carpeta: string): Promise<string[]> {
  const { real, relativa } = await resolverRutaSegura(raiz, carpeta);
  if (!(await stat(real)).isDirectory()) {
    throw new ErrorDeHerramienta(`'${carpeta}' no es una carpeta`);
  }
  const entradas = await readdir(real, { withFileTypes: true });
  return entradas
    .filter((e) => !esProtegida(path.posix.join(relativa, e.name)))
    .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
    .sort((a, b) => a.localeCompare(b, "en"));
}

/** Contenido UTF-8 de un archivo de texto de hasta TAMANO_MAXIMO bytes. */
export async function leerArchivo(raiz: string, ruta: string): Promise<string> {
  const { real } = await resolverRutaSegura(raiz, ruta);
  const info = await stat(real);
  if (info.isDirectory()) {
    throw new ErrorDeHerramienta(`'${ruta}' es una carpeta; usa listar_archivos`);
  }
  if (info.size > TAMANO_MAXIMO) {
    throw new ErrorDeHerramienta(`'${ruta}' pesa ${info.size} bytes; el máximo es 100 000`);
  }
  const contenido = await readFile(real);
  if (contenido.includes(0)) {
    throw new ErrorDeHerramienta(`'${ruta}' no es un archivo de texto`);
  }
  return contenido.toString("utf8");
}

/** Líneas de un texto: separadas por "\n"; una última línea sin salto también cuenta. */
export function contarLineasDeTexto(texto: string): number {
  if (texto === "") return 0;
  return texto.split("\n").length - (texto.endsWith("\n") ? 1 : 0);
}

/** Número de líneas de un archivo; reutiliza leerArchivo, así pasa por las mismas validaciones. */
export async function contarLineas(raiz: string, ruta: string): Promise<number> {
  return contarLineasDeTexto(await leerArchivo(raiz, ruta));
}

export const EXTENSIONES_BUSCABLES = [".ts", ".tsx", ".md", ".sql"];
export const MAX_COINCIDENCIAS = 30;
const MAX_LARGO_LINEA = 200;

export type ResultadoBusqueda = { coincidencias: string[]; truncado: boolean };

/**
 * Busca un texto literal (no regex, distingue mayúsculas) en los archivos buscables del proyecto.
 * Nunca entra a rutas protegidas; los enlaces simbólicos solo se siguen si apuntan a un archivo
 * dentro del proyecto y no protegido (los enlaces a carpetas no se recorren: evita ciclos).
 * Archivos de más de TAMANO_MAXIMO bytes o binarios se saltan.
 */
export async function buscarTexto(
  raiz: string,
  patron: string,
  limite: number = MAX_COINCIDENCIAS,
): Promise<ResultadoBusqueda> {
  const raizReal = await realpath(raiz);
  const coincidencias: string[] = [];
  let truncado = false;

  async function buscarEnArchivo(absoluta: string, relativa: string) {
    if (!EXTENSIONES_BUSCABLES.includes(path.extname(relativa))) return;
    if ((await stat(absoluta)).size > TAMANO_MAXIMO) return;
    const contenido = await readFile(absoluta);
    if (contenido.includes(0)) return;
    const lineas = contenido.toString("utf8").split("\n");
    for (const [i, linea] of lineas.entries()) {
      if (!linea.includes(patron)) continue;
      if (coincidencias.length >= limite) {
        truncado = true;
        return;
      }
      const texto = linea.trim();
      const recortado = texto.length > MAX_LARGO_LINEA ? `${texto.slice(0, MAX_LARGO_LINEA)}…` : texto;
      coincidencias.push(`${relativa}:${i + 1}: ${recortado}`);
    }
  }

  async function recorrer(carpeta: string, relativaCarpeta: string) {
    const entradas = (await readdir(carpeta, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name, "en"),
    );
    for (const e of entradas) {
      if (truncado) return;
      const relativa = relativaCarpeta === "" ? e.name : `${relativaCarpeta}/${e.name}`;
      if (esProtegida(relativa)) continue;
      const absoluta = path.join(carpeta, e.name);
      if (e.isDirectory()) {
        await recorrer(absoluta, relativa);
      } else if (e.isFile()) {
        await buscarEnArchivo(absoluta, relativa);
      } else if (e.isSymbolicLink()) {
        const real = await realpath(absoluta).catch(() => null);
        if (real === null || !comprobarRuta(raizReal, real, relativa).ok) continue;
        if ((await stat(real)).isFile()) await buscarEnArchivo(real, relativa);
      }
    }
  }

  await recorrer(raizReal, "");
  return { coincidencias, truncado };
}
