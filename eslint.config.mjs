import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const PATRONES_MCP = [
  {
    regex: "(^|/)servidor(/|$)",
    message: "Los servidores MCP no importan de servidor/: no necesitan la base ni la clave secreta (AGENTS.md).",
  },
  {
    regex: "^@supabase/",
    message: "Los servidores MCP no hablan con Supabase (AGENTS.md).",
  },
];

/** Funciones de node:fs que escriben, cambian o borran archivos (también sus versiones *Sync). */
const ESCRITURA_FS = [
  "writeFile", "appendFile", "mkdir", "mkdtemp", "rm", "rmdir", "unlink", "rename", "copyFile", "cp",
  "symlink", "link", "truncate", "chmod", "chown", "utimes", "open", "createWriteStream",
];

/** Prohíbe en node:fs y node:fs/promises las funciones de escritura, salvo las permitidas. */
function escrituraFs(permitidas = []) {
  const prohibidas = ESCRITURA_FS.filter((f) => !permitidas.includes(f));
  const nombres = ["default", ...prohibidas, ...prohibidas.map((f) => `${f}Sync`)];
  const message =
    "mcp_servers/ es de solo lectura; la única escritura es guardar_nota en mcp_servers/notas.ts (AGENTS.md).";
  return ["fs", "node:fs", "fs/promises", "node:fs/promises"].map((name) => ({ name, importNames: nombres, message }));
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Frontera entre contextos (AGENTS.md): reservas puede usar canchas, nunca al revés.
  {
    files: ["lib/canchas/**", "servidor/canchas/**", "app/api/(canchas)/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "(^|/)reservas(/|$)",
              message: "El contexto canchas no puede importar de reservas (AGENTS.md).",
            },
          ],
        },
      ],
    },
  },
  // Las pantallas usan solo la API con fetch (AGENTS.md): nada de servidor/ ni de Supabase.
  {
    files: ["app/reservas/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "(^|/)servidor(/|$)",
              message: "Las pantallas usan solo la API con fetch; no importes de servidor/ (AGENTS.md).",
            },
            {
              regex: "^@supabase/",
              message: "Las pantallas no hablan con la base; usa la API con fetch (AGENTS.md).",
            },
          ],
        },
      ],
    },
  },
  // Servidores MCP (AGENTS.md): no necesitan la base ni la clave secreta, y en stdio
  // stdout es el canal del protocolo, así que nada de console.log (logs a stderr).
  // Son de solo lectura: la única excepción es mcp_servers/notas.ts (guardar_nota),
  // que solo puede usar writeFile y mkdir para crear notas nuevas en docs/notas/.
  {
    files: ["mcp_servers/**"],
    rules: {
      "no-restricted-imports": ["error", { paths: escrituraFs(), patterns: PATRONES_MCP }],
      "no-console": ["error", { allow: ["error", "warn"] }],
    },
  },
  {
    files: ["mcp_servers/notas.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: escrituraFs(["writeFile", "mkdir"]), patterns: PATRONES_MCP }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
