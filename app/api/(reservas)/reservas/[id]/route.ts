import type { NextRequest } from "next/server";
import { errorDeValidacion } from "@/lib/compartido/validacion";
import { esquemaIdReserva } from "@/lib/reservas/esquemas";
import { responderError, responderInesperado } from "@/servidor/http";
import { obtenerReserva } from "@/servidor/reservas/consultas";

/** GET /api/reservas/[id]: una reserva con su cancha y cliente (sin teléfono). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/reservas/[id]">) {
  const entrada = esquemaIdReserva.safeParse(await ctx.params);
  if (!entrada.success) return responderError(errorDeValidacion(entrada.error));

  try {
    const reserva = await obtenerReserva(entrada.data.id);
    if (!reserva) {
      return responderError({ status: 404, codigo: "RESERVA_NO_ENCONTRADA", mensaje: "La reserva no existe." });
    }
    return Response.json(reserva);
  } catch (error) {
    return responderInesperado(error);
  }
}
