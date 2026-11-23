import { execSync } from "node:child_process";

// Toma SUPABASE_URL y SUPABASE_SECRET_KEY de Supabase local, sin leer .env.local
// y sin imprimir sus valores (AGENTS.md).
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  let salida = "";
  try {
    salida = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    throw new Error("Supabase local no responde. Levántalo con: npx supabase start");
  }
  const leer = (nombre: string) => salida.match(new RegExp(`^${nombre}="?([^"\\n]+)"?$`, "m"))?.[1];
  const url = leer("API_URL");
  const clave = leer("SECRET_KEY");
  if (!url || !clave) {
    throw new Error("No se pudo obtener API_URL o SECRET_KEY de `supabase status`. ¿Está levantado?");
  }
  process.env.SUPABASE_URL = url;
  process.env.SUPABASE_SECRET_KEY = clave;
}
