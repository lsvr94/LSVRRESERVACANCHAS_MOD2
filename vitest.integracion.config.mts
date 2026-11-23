import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const raiz = fileURLToPath(new URL(".", import.meta.url));

// `npm run test:integracion`: pruebas contra Supabase local (necesita Docker y `npx supabase start`).
export default defineConfig({
  resolve: {
    alias: {
      "@": raiz,
      // En Next, "server-only" se resuelve vacío en el servidor; en Vitest no existe esa condición.
      "server-only": `${raiz}node_modules/server-only/empty.js`,
    },
  },
  test: {
    include: ["tests/integracion/**/*.test.ts"],
    setupFiles: ["tests/integracion/entorno.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Las pruebas comparten la base: un archivo a la vez.
    fileParallelism: false,
  },
});
