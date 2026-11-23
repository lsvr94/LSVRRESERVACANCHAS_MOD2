import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
