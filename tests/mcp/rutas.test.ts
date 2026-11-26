import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  comprobarRuta,
  esProtegida,
  mensajeFuera,
  mensajeProtegida,
  TAMANO_MAXIMO,
} from "../../mcp_servers/rutas";

const RAIZ = "/repo";

describe("mensajes", () => {
  it("usan el texto exacto pedido", () => {
    expect(mensajeFuera("../x")).toBe("Acceso denegado: '../x' está fuera del proyecto");
    expect(mensajeProtegida(".env")).toBe("Acceso denegado: '.env' es una carpeta o archivo protegido");
  });

  it("el tamaño máximo es 100 000 bytes", () => {
    expect(TAMANO_MAXIMO).toBe(100_000);
  });
});

describe("esProtegida", () => {
  it("bloquea .env y todo .env* en cualquier parte de la ruta", () => {
    for (const ruta of [".env", ".env.local", ".env.production", "docs/.env", "a/b/.env.test"]) {
      expect(esProtegida(ruta), ruta).toBe(true);
    }
  });

  it("bloquea carpetas internas y de otros agentes en cualquier nivel", () => {
    for (const ruta of [
      ".git",
      ".git/config",
      "node_modules",
      "node_modules/zod/package.json",
      "a/node_modules/b",
      ".next/server",
      "supabase/.temp",
      "supabase/.temp/cli-latest",
      ".mcp.json",
      ".codex/config",
      ".gemini",
      ".agents/x",
    ]) {
      expect(esProtegida(ruta), ruta).toBe(true);
    }
  });

  it("permite archivos normales con nombres parecidos", () => {
    for (const ruta of [".", "AGENTS.md", "supabase/config.toml", "supabase/migrations", "docs/adr", "app/.gitkeep", "mi.env.md"]) {
      expect(esProtegida(ruta), ruta).toBe(false);
    }
  });
});

describe("comprobarRuta", () => {
  it("permite la raíz y lo que está dentro", () => {
    expect(comprobarRuta(RAIZ, "/repo", ".")).toEqual({ ok: true, relativa: "." });
    expect(comprobarRuta(RAIZ, "/repo/docs/adr", "docs/adr")).toEqual({ ok: true, relativa: "docs/adr" });
  });

  it("rechaza lo que sale de la raíz (con el texto de la ruta pedida, no la absoluta)", () => {
    expect(comprobarRuta(RAIZ, "/", "../..")).toEqual({ ok: false, error: mensajeFuera("../..") });
    expect(comprobarRuta(RAIZ, "/etc/passwd", "/etc/passwd")).toEqual({
      ok: false,
      error: mensajeFuera("/etc/passwd"),
    });
  });

  it("no cae en la trampa del prefijo: /repo2 no está dentro de /repo", () => {
    expect(comprobarRuta(RAIZ, "/repo2/secreto", "../repo2/secreto").ok).toBe(false);
  });

  it("rechaza rutas protegidas dentro del proyecto", () => {
    expect(comprobarRuta(RAIZ, "/repo/.env.local", ".env.local")).toEqual({
      ok: false,
      error: mensajeProtegida(".env.local"),
    });
    expect(comprobarRuta(RAIZ, "/repo/supabase/.temp/x", "supabase/.temp/x").ok).toBe(false);
  });
});

// Casos de la clase (sesión 3), resolviendo la ruta pedida como lo hace el servidor.
describe("casos de la clase", () => {
  const comprobar = (r: string) => comprobarRuta(RAIZ, path.posix.resolve(RAIZ, r), r);

  it.each(["../x", "docs/../../x", "/etc/passwd", "../repo2/x"])("'%s' está fuera del proyecto", (r) => {
    expect(comprobar(r)).toEqual({ ok: false, error: mensajeFuera(r) });
  });

  it.each([".env", ".env.local", ".git/config", "docs/../.env.local", "supabase/.temp/cli-latest"])(
    "'%s' es protegida",
    (r) => {
      expect(comprobar(r)).toEqual({ ok: false, error: mensajeProtegida(r) });
    },
  );

  it.each([
    ["AGENTS.md", "AGENTS.md"],
    ["docs/adr/0001-stack.md", "docs/adr/0001-stack.md"],
    ["docs/../AGENTS.md", "AGENTS.md"],
    ["./supabase/migrations", "supabase/migrations"],
  ])("'%s' se permite", (r, relativa) => {
    expect(comprobar(r)).toEqual({ ok: true, relativa });
  });
});
