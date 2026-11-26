import type { NextRequest } from "next/server";
import { errorDeValidacion } from "@/lib/compartido/validacion";
import { esquemaIdCliente } from "@/lib/reservas/esquemas";
import { responderError, responderInesperado } from "@/servidor/http";
import { listarReservasDeCliente, obtenerCliente } from "@/servidor/reservas/consultas";

/** GET /api/clientes/[id]/reservas: reservas del cliente, de la más reciente a la más antigua. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/clientes/[id]/reservas">) {
  const entrada = esquemaIdCliente.safeParse(await ctx.params);
  if (!entrada.success) return responderError(errorDeValidacion(entrada.error));

  try {
    const cliente = await obtenerCliente(entrada.data.id);
    if (!cliente) {
      return responderError({ status: 404, codigo: "CLIENTE_NO_ENCONTRADO", mensaje: "El cliente no existe." });
    }
    const reservas = await listarReservasDeCliente(cliente.id);
    // Sin teléfono: la lista solo necesita saber de quién son.
    return Response.json({ cliente: { id: cliente.id, nombre: cliente.nombre }, reservas });
  } catch (error) {
    return responderInesperado(error);
  }
}
