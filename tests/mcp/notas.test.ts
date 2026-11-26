import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listarAdr } from "../../mcp_servers/archivos";
import { guardarNota, MAX_LARGO_NOMBRE, MAX_LARGO_TEXTO, validarNota } from "../../mcp_servers/notas";
import { mensajeFuera } from "../../mcp_servers/rutas";

const nombreInvalido = (n: string) =>
  `Nombre inválido '${n}': solo minúsculas, números y guiones, máximo 40 caracteres, sin rutas ni extensión`;

describe("validarNota", () => {
  it("los límites son 40 caracteres de nombre y 5 000 de texto", () => {
    expect(MAX_LARGO_NOMBRE).toBe(40);
    expect(MAX_LARGO_TEXTO).toBe(5_000);
  });

  it.each(["idea-1", "a", "2026-11-25-reunion", "x".repeat(40)])("acepta el nombre '%s'", (nombre) => {
    expect(validarNota(nombre, "hola")).toEqual({ ok: true });
  });

  it.each([
    "../x",
    "../../etc/passwd",
    "docs/x",
    "/etc/x",
    "a\\b",
    ".env",
    ".env.local",
    "..",
    "x.md",
    "Idea",
    "MAYUS",
    "con espacio",
    "ñandu",
    "",
    "x".repeat(41),
  ])("rechaza el nombre %j", (nombre) => {
    expect(validarNota(nombre, "hola")).toEqual({ ok: false, error: nombreInvalido(nombre) });
  });

  it("acepta 5 000 caracteres de texto y rechaza 5 001", () => {
    expect(validarNota("ok", "x".repeat(5_000))).toEqual({ ok: true });
    expect(validarNota("ok", "x".repeat(5_001))).toEqual({
      ok: false,
      error: "El texto tiene 5001 caracteres; el máximo es 5 000",
    });
  });
});

// Proyecto falso con un archivo fuera de él, para comprobar que nada se escapa.
let base = "";
let raiz = "";

beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), "mcp-notas-"));
  raiz = join(base, "proyecto");
  await mkdir(join(raiz, "docs", "adr", "sub"), { recursive: true });
  await writeFile(join(raiz, "docs", "adr", "0002-b.md"), "b");
  await writeFile(join(raiz, "docs", "adr", "0001-a.md"), "a");
  await writeFile(join(raiz, "docs", "adr", "notas.txt"), "no es ADR");
  await writeFile(join(base, "externo.md"), "original");
});

afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("guardarNota", () => {
  it("crea docs/notas/<nombre>.md (y la carpeta si no existe) con el texto exacto", async () => {
    expect(existsSync(join(raiz, "docs", "notas"))).toBe(false);
    expect(await guardarNota(raiz, "idea", "# Idea\nñandú ✓\n")).toBe("docs/notas/idea.md");
    expect(await readFile(join(raiz, "docs", "notas", "idea.md"), "utf8")).toBe("# Idea\nñandú ✓\n");
  });

  it("no sobrescribe una nota existente: error claro y el contenido original intacto", async () => {
    await guardarNota(raiz, "unica", "primera");
    await expect(guardarNota(raiz, "unica", "segunda")).rejects.toThrow(
      "Ya existe la nota 'unica' (docs/notas/unica.md); no se sobrescribe. Elige otro nombre.",
    );
    expect(await readFile(join(raiz, "docs", "notas", "unica.md"), "utf8")).toBe("primera");
  });

  it("rechaza nombres peligrosos sin escribir nada", async () => {
    for (const nombre of ["../x", "../../escape", "docs/x", "/tmp/x", ".env", "Mayus", "x".repeat(41)]) {
      await expect(guardarNota(raiz, nombre, "hola"), nombre).rejects.toThrow(nombreInvalido(nombre));
    }
    expect(existsSync(join(raiz, "docs", "x.md"))).toBe(false);
    expect(existsSync(join(raiz, "docs", "escape.md"))).toBe(false);
    expect(existsSync(join(raiz, "docs", "notas", ".env.md"))).toBe(false);
    expect(existsSync(join(raiz, ".env"))).toBe(false);
  });

  it("rechaza texto demasiado largo sin crear el archivo", async () => {
    await expect(guardarNota(raiz, "larga", "x".repeat(5_001))).rejects.toThrow("el máximo es 5 000");
    expect(existsSync(join(raiz, "docs", "notas", "larga.md"))).toBe(false);
  });

  it("no sigue un enlace plantado con el nombre de la nota", async () => {
    await mkdir(join(raiz, "docs", "notas"), { recursive: true });
    await symlink(join(base, "externo.md"), join(raiz, "docs", "notas", "trampa.md"));
    await expect(guardarNota(raiz, "trampa", "pisado")).rejects.toThrow("Ya existe la nota 'trampa'");
    expect(await readFile(join(base, "externo.md"), "utf8")).toBe("original");
  });

  it("si docs/notas es un enlace que sale del proyecto, deniega", async () => {
    const otraRaiz = join(base, "otro-proyecto");
    await mkdir(join(otraRaiz, "docs"), { recursive: true });
    await mkdir(join(base, "notas-fuera"));
    await symlink(join(base, "notas-fuera"), join(otraRaiz, "docs", "notas"));
    await expect(guardarNota(otraRaiz, "x", "hola")).rejects.toThrow(mensajeFuera("docs/notas/x.md"));
    expect(existsSync(join(base, "notas-fuera", "x.md"))).toBe(false);
  });
});

describe("listarAdr", () => {
  it("devuelve solo los .md de docs/adr, ordenados", async () => {
    expect(await listarAdr(raiz)).toEqual(["0001-a.md", "0002-b.md"]);
  });
});
