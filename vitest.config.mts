import { configDefaults, defineConfig } from "vitest/config";

// `npm test`: solo pruebas unitarias (sin Docker). Las de integración van con `npm run test:integracion`.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tests/integracion/**"],
  },
});
