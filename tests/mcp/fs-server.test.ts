import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
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
  it("se presenta con su nombre y expone las 2 herramientas con descripción", async () => {
    expect(cliente.getServerVersion()?.name).toBe("reservas-archivos");
    const { tools } = await cliente.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["leer_archivo", "listar_archivos"]);
    for (const t of tools) expect(t.description?.length).toBeGreaterThan(20);
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
});
