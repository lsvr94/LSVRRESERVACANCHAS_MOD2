import { tarifaParaHora } from "@/lib/canchas/tarifas";
import { errorDeValidacion } from "@/lib/compartido/validacion";
import { traducirErrorDeBase } from "@/lib/reservas/errores-db";
import { esquemaCrearReserva } from "@/lib/reservas/esquemas";
import { ahoraEnLima } from "@/lib/reservas/fechas";
import { obtenerCanchaConTarifas } from "@/servidor/canchas/consultas";
import { responderError, responderInesperado } from "@/servidor/http";
import { insertarReserva } from "@/servidor/reservas/consultas";

/** POST /api/reservas: crea una reserva pendiente con el precio de la tarifa vigente. */
export async function POST(request: Request) {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return responderError({
      status: 422,
      codigo: "DATOS_INVALIDOS",
      mensaje: "Revisa los datos enviados.",
      campos: { cuerpo: "El cuerpo debe ser un JSON válido." },
    });
  }

  const entrada = esquemaCrearReserva(ahoraEnLima(new Date())).safeParse(cuerpo);
  if (!entrada.success) return responderError(errorDeValidacion(entrada.error));
  const datos = entrada.data;

  try {
    const cancha = await obtenerCanchaConTarifas(datos.cancha_id);
    if (!cancha) {
      return responderError({ status: 422, codigo: "CANCHA_NO_EXISTE", mensaje: "La cancha no existe." });
    }
    const precio = tarifaParaHora(cancha.tarifas, datos.hora_inicio);
    if (precio === null) {
      return responderError({
        status: 422,
        codigo: "SIN_TARIFA",
        mensaje: "Ese bloque no tiene tarifa configurada.",
      });
    }

    // Sin consulta previa de disponibilidad: el índice único decide (ADR-0002).
    // El precio enviado es informativo: el trigger reservas_precio_insert lo recalcula desde tarifas.
    const resultado = await insertarReserva({ ...datos, precio });
    if ("error" in resultado) {
      const error = traducirErrorDeBase(resultado.error);
      if (error.status === 500) return responderInesperado(resultado.error);
      return responderError(error);
    }

    return Response.json(resultado.reserva, {
      status: 201,
      headers: { Location: `/api/reservas/${resultado.reserva.id}` },
    });
  } catch (error) {
    return responderInesperado(error);
  }
}
