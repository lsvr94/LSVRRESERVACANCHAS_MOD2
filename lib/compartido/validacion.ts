import type { z } from "zod";
import type { ErrorApi } from "./errores";

/** Convierte un error de Zod en el 422 del formato único, con un mensaje por campo. */
export function errorDeValidacion(error: z.ZodError): ErrorApi {
  const campos: Record<string, string> = {};

  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      for (const clave of issue.keys) campos[clave] ??= "Campo no permitido.";
      continue;
    }
    const campo = issue.path.length > 0 ? issue.path.join(".") : "cuerpo";
    campos[campo] ??= issue.message;
  }

  return { status: 422, codigo: "DATOS_INVALIDOS", mensaje: "Revisa los datos enviados.", campos };
}
