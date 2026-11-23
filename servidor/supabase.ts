import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

function variable(nombre: "SUPABASE_URL" | "SUPABASE_SECRET_KEY"): string {
  const valor = process.env[nombre];
  // Se nombra la variable que falta, nunca se muestra su valor.
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}.`);
  return valor;
}

/**
 * Cliente de Supabase solo para el servidor. Usa la clave secreta, que omite RLS:
 * no hay login todavía (ADR-0001), así que el acceso se controla en nuestras rutas.
 * Se crea al primer uso para que el build no exija las variables.
 */
export function obtenerSupabase(): SupabaseClient {
  cliente ??= createClient(variable("SUPABASE_URL"), variable("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}
