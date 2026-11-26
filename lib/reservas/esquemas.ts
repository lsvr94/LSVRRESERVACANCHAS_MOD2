import { z } from "zod";
import { HORA_APERTURA, HORA_CIERRE } from "./bloques";
import { ESTADOS_RESERVA } from "./estados";
import { esFechaPasada, validarBloqueReservable, type AhoraLocal } from "./fechas";

const MENSAJE_FECHA = "Usa el formato AAAA-MM-DD con una fecha real.";
const MENSAJE_FECHA_PASADA = "La fecha ya pasó.";
const MENSAJE_ID = "Debe ser un número entero mayor que 0.";
const MENSAJE_HORA = `Debe ser una hora entera entre ${HORA_APERTURA} y ${HORA_CIERRE - 1}.`;

/** Id que llega como texto (query o URL). */
const idDesdeTexto = z.coerce.number({ error: MENSAJE_ID }).int({ error: MENSAJE_ID }).positive({ error: MENSAJE_ID });
/** Id en un cuerpo JSON: debe venir ya como número. */
const idNumerico = z.number({ error: MENSAJE_ID }).int({ error: MENSAJE_ID }).positive({ error: MENSAJE_ID });
// abort: si el formato falla, no se evalúa "fecha pasada" (un solo error por campo).
const fechaIso = z.iso.date({ error: MENSAJE_FECHA, abort: true });

/**
 * Query de GET /api/disponibilidad. Recibe "ahora" (en Lima) para que la regla
 * "fecha no pasada" sea pura y se pueda probar.
 */
export function esquemaDisponibilidad(ahora: AhoraLocal) {
  return z.object({
    fecha: fechaIso.refine((fecha) => !esFechaPasada(fecha, ahora), { error: MENSAJE_FECHA_PASADA }),
    cancha_id: idDesdeTexto,
  });
}

/** Cuerpo de POST /api/reservas. Estricto: precio y estado los fija el servidor. */
export function esquemaCrearReserva(ahora: AhoraLocal) {
  return z
    .strictObject({
      cliente_id: idNumerico,
      cancha_id: idNumerico,
      fecha: fechaIso,
      hora_inicio: z
        .number({ error: MENSAJE_HORA })
        .int({ error: MENSAJE_HORA })
        .min(HORA_APERTURA, { error: MENSAJE_HORA })
        .max(HORA_CIERRE - 1, { error: MENSAJE_HORA }),
    })
    // Solo si cada campo ya es válido; si no, el error del campo basta.
    .superRefine((datos, ctx) => {
      const motivo = validarBloqueReservable(datos.fecha, datos.hora_inicio, ahora);
      if (motivo === "FECHA_PASADA") {
        ctx.addIssue({ code: "custom", path: ["fecha"], message: MENSAJE_FECHA_PASADA });
      } else if (motivo === "BLOQUE_YA_EMPEZO") {
        ctx.addIssue({ code: "custom", path: ["hora_inicio"], message: "Ese bloque de hoy ya empezó." });
      } else if (motivo === "HORA_INVALIDA") {
        ctx.addIssue({ code: "custom", path: ["hora_inicio"], message: MENSAJE_HORA });
      }
    }, { when: (payload) => payload.issues.length === 0 });
}

export type CrearReserva = z.infer<ReturnType<typeof esquemaCrearReserva>>;

/** Parámetros de la URL de GET /api/reservas/[id]. */
export const esquemaIdReserva = z.object({ id: idDesdeTexto });

/** Cuerpo de PATCH /api/reservas/[id]/estado. */
export const esquemaCambioEstado = z.strictObject({
  estado: z.enum(ESTADOS_RESERVA, { error: "Debe ser pendiente, confirmada o cancelada." }),
});
