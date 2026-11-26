import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buscarTexto, MAX_COINCIDENCIAS } from "../../mcp_servers/archivos";

// Proyecto falso para buscar_texto: el token AGUJA aparece en sitios permitidos y prohibidos.
let base = "";
let raiz = "";

async function escribir(ruta: string, contenido: string | Buffer) {
  await mkdir(dirname(ruta), { recursive: true });
  await writeFile(ruta, contenido);
}

beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), "mcp-buscar-"));
  raiz = join(base, "proyecto");
  const p = (r: string) => join(raiz, r);

  // Permitidos
  await escribir(p("AGENTS.md"), "# Proyecto\n  AGUJA en la línea dos  \nfin\n");
  await escribir(p("lib/a.ts"), "export const x = 'AGUJA';\n");
  await escribir(p("app/b.tsx"), "<p>AGUJA</p>\r\n");
  await escribir(p("supabase/migrations/c.sql"), "-- nada\n-- AGUJA aquí\n");
  await escribir(p("lib/literal.ts"), "axb\nf(a.b)\n");
  await escribir(p("lib/largo.md"), `${"x".repeat(300)}AGUJA\n`);

  // Extensiones no buscables
  await escribir(p("notas.txt"), "AGUJA\n");
  await escribir(p("datos.json"), '"AGUJA"\n');

  // Protegidos
  await escribir(p("node_modules/p/index.ts"), "AGUJA\n");
  await escribir(p(".git/x.md"), "AGUJA\n");
  await escribir(p(".env.local"), "AGUJA=1\n");
  await escribir(p(".next/x.ts"), "AGUJA\n");
  await escribir(p("supabase/.temp/x.sql"), "AGUJA\n");

  // Grandes o binarios: se saltan sin error
  await escribir(p("docs/grande.md"), `AGUJA\n${"x".repeat(100_001)}`);
  await escribir(p("docs/binario.md"), Buffer.from("AGUJA\u0000\n"));

  // Muchas coincidencias, en otra carpeta para poder probar el límite
  await escribir(p("muchas/m.md"), Array.from({ length: 40 }, (_, i) => `MUCHAS ${i + 1}`).join("\n"));

  // Enlaces: hacia fuera, hacia un secreto, hacia una carpeta fuera, y uno válido
  await escribir(join(base, "fuera.ts"), "AGUJA fuera\n");
  await mkdir(join(base, "carpeta-fuera"), { recursive: true });
  await escribir(join(base, "carpeta-fuera", "x.ts"), "AGUJA carpeta fuera\n");
  await symlink(join(base, "fuera.ts"), p("enlace-fuera.ts"));
  await symlink(p(".env.local"), p("secreto.md"));
  await symlink(join(base, "carpeta-fuera"), p("dir-fuera"));
  await symlink(p("lib/a.ts"), p("enlace-valido.ts"));
});

afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("buscarTexto", () => {
  it("devuelve 'ruta:línea: texto' ordenado, solo en .ts/.tsx/.md/.sql y sin protegidos ni enlaces externos", async () => {
    const { coincidencias, truncado } = await buscarTexto(raiz, "AGUJA");
    expect(truncado).toBe(false);
    expect(coincidencias).toEqual([
      "AGENTS.md:2: AGUJA en la línea dos",
      "app/b.tsx:1: <p>AGUJA</p>",
      "enlace-valido.ts:1: export const x = 'AGUJA';",
      "lib/a.ts:1: export const x = 'AGUJA';",
      `lib/largo.md:1: ${"x".repeat(200)}…`,
      "supabase/migrations/c.sql:2: -- AGUJA aquí",
    ]);
  });

  it("nunca muestra contenido de protegidos, de fuera del proyecto ni de otras extensiones", async () => {
    const texto = (await buscarTexto(raiz, "AGUJA")).coincidencias.join("\n");
    for (const prohibido of ["node_modules", ".git", ".env", ".next", ".temp", "secreto.md", "fuera", "notas.txt", "datos.json", "grande.md", "binario.md"]) {
      expect(texto, prohibido).not.toContain(prohibido);
    }
  });

  it("busca texto literal, no expresiones regulares", async () => {
    expect((await buscarTexto(raiz, "a.b")).coincidencias).toEqual(["lib/literal.ts:2: f(a.b)"]);
    expect((await buscarTexto(raiz, "f(")).coincidencias).toEqual(["lib/literal.ts:2: f(a.b)"]);
    expect((await buscarTexto(raiz, ".*")).coincidencias).toEqual([]);
  });

  it(`devuelve como máximo ${MAX_COINCIDENCIAS} coincidencias y avisa que hay más`, async () => {
    const { coincidencias, truncado } = await buscarTexto(raiz, "MUCHAS");
    expect(MAX_COINCIDENCIAS).toBe(30);
    expect(coincidencias).toHaveLength(30);
    expect(coincidencias[0]).toBe("muchas/m.md:1: MUCHAS 1");
    expect(coincidencias[29]).toBe("muchas/m.md:30: MUCHAS 30");
    expect(truncado).toBe(true);
  });

  it("sin coincidencias devuelve una lista vacía", async () => {
    expect(await buscarTexto(raiz, "NO-EXISTE-ESTO")).toEqual({ coincidencias: [], truncado: false });
  });
});
