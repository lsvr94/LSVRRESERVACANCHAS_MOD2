// Acceso al disco del servidor MCP de archivos. Solo lectura: no hay ninguna función que escriba.
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
