import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { leerArchivo, listarArchivos } from "../../mcp_servers/archivos";
import { mensajeFuera, mensajeProtegida } from "../../mcp_servers/rutas";

// Un "proyecto" falso en una carpeta temporal, con un secreto fuera de él.
let base = "";
let raiz = "";

beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), "mcp-archivos-"));
  raiz = join(base, "proyecto");
  await mkdir(join(raiz, "docs"), { recursive: true });
  await mkdir(join(raiz, "node_modules", "paquete"), { recursive: true });
  await mkdir(join(raiz, ".git"), { recursive: true });
  await writeFile(join(raiz, "AGENTS.md"), "# Hola\nñandú ✓\n");
  await writeFile(join(raiz, "docs", "b.md"), "b");
  await writeFile(join(raiz, "docs", "a.md"), "a");
  await writeFile(join(raiz, ".env.local"), "SECRETO=1");
  await writeFile(join(raiz, "grande.txt"), "x".repeat(100_001));
  await writeFile(join(raiz, "justo.txt"), "x".repeat(100_000));
  await writeFile(join(raiz, "imagen.bin"), Buffer.from([0x89, 0x50, 0x00, 0x47]));
  await writeFile(join(base, "fuera.txt"), "no deberías leer esto");
  // Enlaces simbólicos: uno sale del proyecto y otro apunta a un secreto.
  await symlink(join(base, "fuera.txt"), join(raiz, "atajo-fuera.txt"));
  await symlink(join(raiz, ".env.local"), join(raiz, "config.txt"));
});

afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("listarArchivos", () => {
  it("lista ordenado, con '/' en las carpetas y sin los protegidos", async () => {
    expect(await listarArchivos(raiz, ".")).toEqual([
      "AGENTS.md",
      "atajo-fuera.txt",
      "config.txt",
      "docs/",
      "grande.txt",
      "imagen.bin",
      "justo.txt",
    ]);
  });

  it("lista una subcarpeta", async () => {
    expect(await listarArchivos(raiz, "docs")).toEqual(["a.md", "b.md"]);
  });

  it("rechaza carpetas fuera del proyecto o protegidas", async () => {
    await expect(listarArchivos(raiz, "..")).rejects.toThrow(mensajeFuera(".."));
    await expect(listarArchivos(raiz, "node_modules")).rejects.toThrow(mensajeProtegida("node_modules"));
  });

  it("error claro si no existe o no es una carpeta", async () => {
    await expect(listarArchivos(raiz, "nada")).rejects.toThrow("No existe 'nada'");
    await expect(listarArchivos(raiz, "AGENTS.md")).rejects.toThrow("'AGENTS.md' no es una carpeta");
  });
});

describe("leerArchivo", () => {
  it("lee texto UTF-8", async () => {
    expect(await leerArchivo(raiz, "AGENTS.md")).toBe("# Hola\nñandú ✓\n");
    expect(await leerArchivo(raiz, "./docs/../docs/a.md")).toBe("a");
  });

  it("acepta exactamente 100 000 bytes y rechaza 100 001", async () => {
    expect((await leerArchivo(raiz, "justo.txt")).length).toBe(100_000);
    await expect(leerArchivo(raiz, "grande.txt")).rejects.toThrow(
      "'grande.txt' pesa 100001 bytes; el máximo es 100 000",
    );
  });

  it("rechaza .env.local sin importar si existe (bloqueo antes de tocar el disco)", async () => {
    await expect(leerArchivo(raiz, ".env.local")).rejects.toThrow(mensajeProtegida(".env.local"));
    await expect(leerArchivo(raiz, ".env.produccion")).rejects.toThrow(mensajeProtegida(".env.produccion"));
  });

  it("sigue los enlaces simbólicos: fuera del proyecto o hacia un secreto → denegado", async () => {
    await expect(leerArchivo(raiz, "atajo-fuera.txt")).rejects.toThrow(mensajeFuera("atajo-fuera.txt"));
    await expect(leerArchivo(raiz, "config.txt")).rejects.toThrow(mensajeProtegida("config.txt"));
  });

  it("rechaza '..' y rutas absolutas fuera del proyecto", async () => {
    await expect(leerArchivo(raiz, "../fuera.txt")).rejects.toThrow(mensajeFuera("../fuera.txt"));
    await expect(leerArchivo(raiz, join(base, "fuera.txt"))).rejects.toThrow("está fuera del proyecto");
  });

  it("errores claros: no existe, es carpeta o no es texto", async () => {
    await expect(leerArchivo(raiz, "nada.md")).rejects.toThrow("No existe 'nada.md'");
    await expect(leerArchivo(raiz, "docs")).rejects.toThrow("'docs' es una carpeta; usa listar_archivos");
    await expect(leerArchivo(raiz, "imagen.bin")).rejects.toThrow("'imagen.bin' no es un archivo de texto");
  });

  it("los mensajes no revelan rutas absolutas", async () => {
    const error = await leerArchivo(raiz, "nada.md").catch((e: Error) => e);
    expect((error as Error).message).not.toContain(base);
  });
});
