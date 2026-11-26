import type { ErrorApi } from "../compartido/errores";

/** Lo mínimo que trae un error de Postgres vía Supabase (PostgrestError). */
export type ErrorDeBase = { code?: string; message?: string };

// Códigos SQLSTATE de Postgres.
const VIOLACION_UNICA = "23505";
const VIOLACION_FK = "23503";
const VIOLACION_CHECK = "23514";
// SQLSTATE propio del trigger reservas_transicion_estado
// (supabase/migrations/*_transiciones_de_estado.sql). No cambiar por separado.
const TRANSICION_NO_PERMITIDA = "RS001";

/** Supabase no da el nombre de la restricción aparte; viene entre comillas en el mensaje. */
function nombreDeRestriccion(mensaje = ""): string | null {
  return mensaje.match(/constraint "([^"]+)"/)?.[1] ?? null;
}

/**
 * Convierte un error de la base al insertar o actualizar reservas en un error de la API
 * (ADR-0002: la base detecta, nuestro código traduce). Nunca expone el mensaje original.
 */
export function traducirErrorDeBase(error: ErrorDeBase): ErrorApi {
  const restriccion = nombreDeRestriccion(error.message);

  // Nombre del índice de supabase/migrations/*_esquema_reservas.sql (comentado en la base). No renombrar por separado.
  if (error.code === VIOLACION_UNICA && restriccion === "reservas_bloque_ocupado_unico") {
    return {
      status: 409,
      codigo: "BLOQUE_OCUPADO",
      mensaje: "Ese bloque acaba de ser reservado, elige otro.",
    };
  }
  if (error.code === TRANSICION_NO_PERMITIDA) {
    return {
      status: 409,
      codigo: "TRANSICION_NO_PERMITIDA",
      mensaje: "Ese cambio de estado no está permitido.",
    };
  }
  if (error.code === VIOLACION_FK && restriccion === "reservas_cliente_id_fkey") {
    return { status: 422, codigo: "CLIENTE_NO_EXISTE", mensaje: "El cliente no existe." };
  }
  if (error.code === VIOLACION_FK && restriccion === "reservas_cancha_id_fkey") {
    return { status: 422, codigo: "CANCHA_NO_EXISTE", mensaje: "La cancha no existe." };
  }
  if (error.code === VIOLACION_CHECK) {
    return { status: 422, codigo: "DATOS_INVALIDOS", mensaje: "Los datos de la reserva no son válidos." };
  }
  return {
    status: 500,
    codigo: "ERROR_INTERNO",
    mensaje: "Ocurrió un error inesperado. Intenta de nuevo.",
  };
}
