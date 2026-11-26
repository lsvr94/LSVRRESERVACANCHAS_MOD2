// Única escritura de los servidores MCP (AGENTS.md): guardar_nota solo CREA archivos nuevos
// en docs/notas/. Nunca sobrescribe ni borra. ESLint solo permite writeFile y mkdir aquí.
// Pruebas: tests/mcp/notas.test.ts.
import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { ErrorDeHerramienta } from "./archivos";
import { comprobarRuta } from "./rutas";

export const MAX_LARGO_NOMBRE = 40;
export const MAX_LARGO_TEXTO = 5_000;
export const CARPETA_NOTAS = "docs/notas";

/** Solo minúsculas, números y guiones: así no caben "/", "\", "..", ".env" ni extensiones. */
const NOMBRE_VALIDO = /^[a-z0-9-]+$/;

export type ResultadoValidacion = { ok: true } | { ok: false; error: string };

export function validarNota(nombre: string, texto: string): ResultadoValidacion {
  if (!NOMBRE_VALIDO.test(nombre) || nombre.length > MAX_LARGO_NOMBRE) {
    return {
      ok: false,
      error: `Nombre inválido '${nombre}': solo minúsculas, números y guiones, máximo 40 caracteres, sin rutas ni extensión`,
    };
  }
  if (texto.length > MAX_LARGO_TEXTO) {
    return { ok: false, error: `El texto tiene ${texto.length} caracteres; el máximo es 5 000` };
  }
  return { ok: true };
}

/** Crea docs/notas/<nombre>.md y devuelve esa ruta relativa. Falla si la nota ya existe. */
export async function guardarNota(raiz: string, nombre: string, texto: string): Promise<string> {
  const validacion = validarNota(nombre, texto);
  if (!validacion.ok) throw new ErrorDeHerramienta(validacion.error);

  const relativa = `${CARPETA_NOTAS}/${nombre}.md`;
  const raizReal = await realpath(raiz);
  const carpeta = path.join(raizReal, ...CARPETA_NOTAS.split("/"));
  await mkdir(carpeta, { recursive: true });

  // Si docs/ o docs/notas/ fueran enlaces que salen del proyecto (o a algo protegido), no se escribe.
  const comprobacion = comprobarRuta(raizReal, path.join(await realpath(carpeta), `${nombre}.md`), relativa);
  if (!comprobacion.ok) throw new ErrorDeHerramienta(comprobacion.error);

  try {
    // "wx" = crear en exclusiva (O_CREAT | O_EXCL): atómico, falla si ya existe,
    // incluso si lo que existe es un enlace simbólico plantado con ese nombre.
    await writeFile(path.join(carpeta, `${nombre}.md`), texto, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new ErrorDeHerramienta(
        `Ya existe la nota '${nombre}' (${relativa}); no se sobrescribe. Elige otro nombre.`,
      );
    }
    throw error;
  }
  return relativa;
}
