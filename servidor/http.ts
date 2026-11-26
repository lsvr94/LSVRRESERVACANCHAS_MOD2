import "server-only";
// Común a los dos contextos: no importa de canchas ni de reservas.
import { cuerpoDeError, type ErrorApi } from "@/lib/compartido/errores";

/** Respuesta con el formato único de error. */
export function responderError(error: ErrorApi): Response {
  return Response.json(cuerpoDeError(error), { status: error.status });
}

/** Error inesperado: se registra en el servidor y el cliente recibe un 500 genérico. */
export function responderInesperado(error: unknown): Response {
  console.error("[api] error inesperado:", error);
  return responderError({
    status: 500,
    codigo: "ERROR_INTERNO",
    mensaje: "Ocurrió un error inesperado. Intenta de nuevo.",
  });
}

/** Lee el cuerpo JSON; si no es JSON válido, devuelve el 422 del formato único. */
export async function leerJson(request: Request): Promise<{ cuerpo: unknown } | { error: ErrorApi }> {
  try {
    return { cuerpo: await request.json() };
  } catch {
    return {
      error: {
        status: 422,
        codigo: "DATOS_INVALIDOS",
        mensaje: "Revisa los datos enviados.",
        campos: { cuerpo: "El cuerpo debe ser un JSON válido." },
      },
    };
  }
}
