import { describe, expect, it } from "vitest";
import {
  configJson,
  configToml,
  fusionarJson,
  fusionarToml,
  nombreDelServidor,
  parsearArgumentos,
  valorDeTexto,
  type ServidorMcp,
} from "../../scripts/mcp-util";

// Ruta con espacios, como la real del repo.
const RAIZ = "/Users/yo/DIPLOMA EN AI/proyecto";
const SERVIDOR: ServidorMcp = {
  nombre: "reservas-archivos",
  command: `${RAIZ}/node_modules/.bin/tsx`,
  args: [`${RAIZ}/mcp_servers/fs-server.ts`],
  env: { FS_RAIZ: RAIZ },
};

describe("valorDeTexto", () => {
  it("convierte números, booleanos y JSON; lo demás queda como texto", () => {
    expect(valorDeTexto("3")).toBe(3);
    expect(valorDeTexto("true")).toBe(true);
    expect(valorDeTexto('["a"]')).toEqual(["a"]);
    expect(valorDeTexto("docs/adr")).toBe("docs/adr");
    expect(valorDeTexto("AGENTS.md")).toBe("AGENTS.md");
  });
});

describe("parsearArgumentos", () => {
  it("servidor solo", () => {
    expect(parsearArgumentos(["mcp_servers/fs-server.ts"])).toEqual({
      ok: true,
      servidor: "mcp_servers/fs-server.ts",
      argumentos: {},
    });
  });

  it("servidor, herramienta y clave=valor (el valor puede tener '=')", () => {
    expect(parsearArgumentos(["http://127.0.0.1:8765/mcp", "leer_archivo", "ruta=AGENTS.md", "filtro=a=b"])).toEqual({
      ok: true,
      servidor: "http://127.0.0.1:8765/mcp",
      herramienta: "leer_archivo",
      argumentos: { ruta: "AGENTS.md", filtro: "a=b" },
    });
  });

  it("errores de uso", () => {
    expect(parsearArgumentos([]).ok).toBe(false);
    const sinIgual = parsearArgumentos(["s.ts", "leer_archivo", "AGENTS.md"]);
    expect(sinIgual).toEqual({ ok: false, error: "Argumento inválido 'AGENTS.md': usa clave=valor" });
  });
});

describe("nombreDelServidor", () => {
  it("lee el name de new McpServer({...})", () => {
    expect(nombreDelServidor('const s = new McpServer({ name: "reservas-archivos", version: "1.0.0" });')).toBe(
      "reservas-archivos",
    );
    expect(nombreDelServidor("new McpServer({\n  name: 'otro',\n})")).toBe("otro");
    expect(nombreDelServidor("sin servidor")).toBeNull();
  });
});

describe("configJson (Claude Code y Antigravity)", () => {
  it("genera mcpServers con command, args y env absolutos", () => {
    expect(configJson([SERVIDOR])).toEqual({
      mcpServers: {
        "reservas-archivos": { command: SERVIDOR.command, args: SERVIDOR.args, env: { FS_RAIZ: RAIZ } },
      },
    });
  });

  it("fusionar conserva otras claves y servidores ajenos, y reemplaza el nuestro", () => {
    const existente = {
      otraClave: 1,
      mcpServers: { ajeno: { command: "x" }, "reservas-archivos": { command: "viejo" } },
    };
    const r = fusionarJson(existente, configJson([SERVIDOR]));
    expect(r.otraClave).toBe(1);
    expect(r.mcpServers.ajeno).toEqual({ command: "x" });
    expect(r.mcpServers["reservas-archivos"].command).toBe(SERVIDOR.command);
    expect(fusionarJson(null, configJson([SERVIDOR]))).toEqual(configJson([SERVIDOR]));
  });
});

describe("configToml (Codex)", () => {
  const bloque = configToml([SERVIDOR]);

  it("usa [mcp_servers.<nombre>] y la subtabla env, con cadenas entre comillas (rutas con espacios)", () => {
    expect(bloque).toContain('[mcp_servers."reservas-archivos"]');
    expect(bloque).toContain(`command = "${SERVIDOR.command}"`);
    expect(bloque).toContain(`args = ["${SERVIDOR.args[0]}"]`);
    expect(bloque).toContain('[mcp_servers."reservas-archivos".env]');
    expect(bloque).toContain(`FS_RAIZ = "${RAIZ}"`);
    expect(bloque.startsWith("# >>> generado por npm run mcp:configurar")).toBe(true);
    expect(bloque.trimEnd().endsWith("# <<< generado por npm run mcp:configurar")).toBe(true);
  });

  it("escapa comillas y barras invertidas", () => {
    const raro = configToml([{ ...SERVIDOR, env: { FS_RAIZ: 'C:\\a "b"' } }]);
    expect(raro).toContain('FS_RAIZ = "C:\\\\a \\"b\\""');
  });

  it("fusionar reemplaza solo el bloque generado y es idempotente", () => {
    const ajeno = 'model = "o4"\n\n[mcp_servers.otro]\ncommand = "x"\n';
    const una = fusionarToml(ajeno, bloque);
    const dos = fusionarToml(una, bloque);
    expect(dos).toBe(una);
    expect(una).toContain('model = "o4"');
    expect(una).toContain("[mcp_servers.otro]");
    expect(una.split("# >>> generado").length).toBe(2);
    expect(fusionarToml(null, bloque)).toBe(bloque);
  });
});
