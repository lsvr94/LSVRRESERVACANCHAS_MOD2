import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Prueba de punta a punta: un cliente MCP real arranca el servidor por stdio.
// Si el servidor escribiera algo que no es protocolo en stdout, la conexión fallaría.
const RAIZ_REPO = join(__dirname, "..", "..");
const cliente = new Client({ name: "prueba-fs-server", version: "0.0.0" });

type Texto = { type: string; text?: string };
const texto = (r: { content: unknown }) => (r.content as Texto[]).map((c) => c.text ?? "").join("\n");

beforeAll(async () => {
  await cliente.connect(
    new StdioClientTransport({
      command: join(RAIZ_REPO, "node_modules", ".bin", "tsx"),
      args: [join(RAIZ_REPO, "mcp_servers", "fs-server.ts")],
      cwd: RAIZ_REPO,
      stderr: "ignore",
    }),
  );
}, 30_000);

afterAll(async () => {
  await cliente.close();
});

describe("servidor MCP reservas-archivos (stdio)", () => {
  it("se presenta con su nombre y expone las 5 herramientas con descripción", async () => {
    expect(cliente.getServerVersion()?.name).toBe("reservas-archivos");
    const { tools } = await cliente.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "buscar_texto",
      "contar_lineas",
      "guardar_nota",
      "leer_archivo",
      "listar_archivos",
    ]);
    for (const t of tools) expect(t.description?.length).toBeGreaterThan(20);
  });

  it("las 4 herramientas de lectura están anotadas como solo lectura", async () => {
    const { tools } = await cliente.listTools();
    for (const nombre of ["listar_archivos", "leer_archivo", "contar_lineas", "buscar_texto"]) {
      expect(tools.find((t) => t.name === nombre)?.annotations?.readOnlyHint, nombre).toBe(true);
    }
  });

  it("guardar_nota está anotada como escritura no destructiva", async () => {
    const { tools } = await cliente.listTools();
    const nota = tools.find((t) => t.name === "guardar_nota");
    expect(nota?.annotations?.readOnlyHint).toBe(false);
    expect(nota?.annotations?.destructiveHint).toBe(false);
  });

  it("expone el resource adr://lista con los nombres de las ADR en texto plano", async () => {
    const { resources } = await cliente.listResources();
    const adr = resources.find((r) => r.uri === "adr://lista");
    expect(adr?.mimeType).toBe("text/plain");

    const { contents } = await cliente.readResource({ uri: "adr://lista" });
    const nombres = (contents[0] as { text: string }).text.split("\n");
    expect(nombres).toContain("0001-stack.md");
    expect(nombres).toContain("0002-donde-viven-las-reglas.md");
    expect(nombres).toContain("0003-microservicio-canchas.md");
  });

  it.each([
    ["nombre '../x'", { nombre: "../x", texto: "hola" }, "Nombre inválido '../x'"],
    ["nombre '.env'", { nombre: ".env", texto: "hola" }, "Nombre inválido '.env'"],
    ["nombre 'Mayus'", { nombre: "Mayus", texto: "hola" }, "Nombre inválido 'Mayus'"],
    ["texto de 5 001 caracteres", { nombre: "larga", texto: "x".repeat(5_001) }, "el máximo es 5 000"],
  ])("guardar_nota con %s llega como error de herramienta, sin escribir", async (_caso, argumentos, mensaje) => {
    const r = await cliente.callTool({ name: "guardar_nota", arguments: argumentos });
    expect(r.isError).toBe(true);
    expect(texto(r)).toContain(mensaje);
  });

  it("listar_archivos lista una carpeta del repo, sin protegidos", async () => {
    const raiz = await cliente.callTool({ name: "listar_archivos", arguments: {} });
    expect(raiz.isError).toBeFalsy();
    const nombres = texto(raiz).split("\n");
    expect(nombres).toContain("docs/");
    expect(nombres).toContain("AGENTS.md");
    expect(nombres).not.toContain("node_modules/");
    expect(nombres).not.toContain(".git/");
    expect(nombres.some((n) => n.startsWith(".env"))).toBe(false);

    const adr = await cliente.callTool({ name: "listar_archivos", arguments: { carpeta: "docs/adr" } });
    expect(texto(adr)).toContain("0001-stack.md");
  });

  it("leer_archivo lee AGENTS.md", async () => {
    const r = await cliente.callTool({ name: "leer_archivo", arguments: { ruta: "AGENTS.md" } });
    expect(r.isError).toBeFalsy();
    expect(texto(r)).toContain("# Reservas de canchas");
  });

  it("leer_archivo('.env.local') llega como error de herramienta, sin leer el archivo", async () => {
    const r = await cliente.callTool({ name: "leer_archivo", arguments: { ruta: ".env.local" } });
    expect(r.isError).toBe(true);
    expect(texto(r)).toBe("Acceso denegado: '.env.local' es una carpeta o archivo protegido");
  });

  it("salir del proyecto llega como error de herramienta, sin detalles internos", async () => {
    const r = await cliente.callTool({ name: "leer_archivo", arguments: { ruta: "../../../etc/passwd" } });
    expect(r.isError).toBe(true);
    expect(texto(r)).toBe("Acceso denegado: '../../../etc/passwd' está fuera del proyecto");
    expect(texto(r)).not.toContain(RAIZ_REPO);
  });

  it("contar_lineas cuenta las líneas de AGENTS.md", async () => {
    const contenido = await readFile(join(RAIZ_REPO, "AGENTS.md"), "utf8");
    const esperado = contenido.split("\n").length - (contenido.endsWith("\n") ? 1 : 0);
    const r = await cliente.callTool({ name: "contar_lineas", arguments: { ruta: "AGENTS.md" } });
    expect(r.isError).toBeFalsy();
    expect(texto(r)).toBe(String(esperado));
  });

  it("contar_lineas('.env.local') llega como error de herramienta", async () => {
    const r = await cliente.callTool({ name: "contar_lineas", arguments: { ruta: ".env.local" } });
    expect(r.isError).toBe(true);
    expect(texto(r)).toBe("Acceso denegado: '.env.local' es una carpeta o archivo protegido");
  });

  it("buscar_texto encuentra el título de AGENTS.md y no entra a carpetas protegidas", async () => {
    const r = await cliente.callTool({ name: "buscar_texto", arguments: { patron: "# Reservas de canchas" } });
    expect(r.isError).toBeFalsy();
    const lineas = texto(r).split("\n");
    expect(lineas).toContain("AGENTS.md:1: # Reservas de canchas");
    for (const l of lineas) expect(l).not.toMatch(/^(node_modules|\.git|\.next|\.env)/);
  });

  it("buscar_texto sin coincidencias lo dice claramente", async () => {
    // Se arma en tiempo de ejecución para que este mismo archivo .ts no coincida.
    const patron = ["zzz", "no", "existe", Date.now()].join("-");
    const r = await cliente.callTool({ name: "buscar_texto", arguments: { patron } });
    expect(r.isError).toBeFalsy();
    expect(texto(r)).toBe(`Sin coincidencias para '${patron}'`);
  });
});

// guardar_nota escribe de verdad: se prueba contra una raíz temporal (FS_RAIZ), nunca contra el repo.
describe("guardar_nota de punta a punta (raíz temporal)", () => {
  const clienteNotas = new Client({ name: "prueba-notas", version: "0.0.0" });
  let raizTemporal = "";

  beforeAll(async () => {
    raizTemporal = await mkdtemp(join(tmpdir(), "mcp-e2e-notas-"));
    await clienteNotas.connect(
      new StdioClientTransport({
        command: join(RAIZ_REPO, "node_modules", ".bin", "tsx"),
        args: [join(RAIZ_REPO, "mcp_servers", "fs-server.ts")],
        cwd: RAIZ_REPO,
        env: { PATH: process.env.PATH ?? "", FS_RAIZ: raizTemporal },
        stderr: "ignore",
      }),
    );
  }, 30_000);

  afterAll(async () => {
    await clienteNotas.close();
    await rm(raizTemporal, { recursive: true, force: true });
  });

  it("crea la nota y no la sobrescribe la segunda vez", async () => {
    const primera = await clienteNotas.callTool({ name: "guardar_nota", arguments: { nombre: "prueba", texto: "hola" } });
    expect(primera.isError).toBeFalsy();
    expect(texto(primera)).toBe("Nota guardada en docs/notas/prueba.md");
    expect(await readFile(join(raizTemporal, "docs", "notas", "prueba.md"), "utf8")).toBe("hola");

    const segunda = await clienteNotas.callTool({ name: "guardar_nota", arguments: { nombre: "prueba", texto: "otra" } });
    expect(segunda.isError).toBe(true);
    expect(texto(segunda)).toBe("Ya existe la nota 'prueba' (docs/notas/prueba.md); no se sobrescribe. Elige otro nombre.");
    expect(await readFile(join(raizTemporal, "docs", "notas", "prueba.md"), "utf8")).toBe("hola");
  });
});
