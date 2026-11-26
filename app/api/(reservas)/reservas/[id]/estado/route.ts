import type { NextRequest } from "next/server";
import { errorDeValidacion } from "@/lib/compartido/validacion";
import { traducirErrorDeBase } from "@/lib/reservas/errores-db";
import { esquemaCambioEstado, esquemaIdReserva } from "@/lib/reservas/esquemas";
import { mensajeTransicionNoPermitida, puedeCambiarEstado } from "@/lib/reservas/estados";
import { leerJson, responderError, responderInesperado } from "@/servidor/http";
import { actualizarEstado, obtenerEstado, obtenerReserva } from "@/servidor/reservas/consultas";

/** PATCH /api/reservas/[id]/estado: confirma o cancela una reserva. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/reservas/[id]/estado">) {
  const params = esquemaIdReserva.safeParse(await ctx.params);
  if (!params.success) return responderError(errorDeValidacion(params.error));

  const json = await leerJson(request);
  if ("error" in json) return responderError(json.error);
  const entrada = esquemaCambioEstado.safeParse(json.cuerpo);
  if (!entrada.success) return responderError(errorDeValidacion(entrada.error));

  const id = params.data.id;
  const nuevo = entrada.data.estado;

  try {
    const actual = await obtenerEstado(id);
    if (actual === null) {
      return responderError({ status: 404, codigo: "RESERVA_NO_ENCONTRADA", mensaje: "La reserva no existe." });
    }
    if (!puedeCambiarEstado(actual, nuevo)) {
      return responderError({
        status: 409,
        codigo: "TRANSICION_NO_PERMITIDA",
        mensaje: mensajeTransicionNoPermitida(actual, nuevo),
      });
    }

    const resultado = await actualizarEstado(id, actual, nuevo);
    if ("error" in resultado) {
      const error = traducirErrorDeBase(resultado.error);
      if (error.status === 500) return responderInesperado(resultado.error);
      return responderError(error);
    }
    if (!resultado.actualizada) {
      // Otra petición cambió el estado entre la lectura y el UPDATE.
      return responderError({
        status: 409,
        codigo: "TRANSICION_NO_PERMITIDA",
        mensaje: "La reserva cambió de estado mientras tanto. Vuelve a cargarla.",
      });
    }

    const reserva = await obtenerReserva(id);
    if (!reserva) {
      return responderError({ status: 404, codigo: "RESERVA_NO_ENCONTRADA", mensaje: "La reserva no existe." });
    }
    return Response.json(reserva);
  } catch (error) {
    return responderInesperado(error);
  }
}
