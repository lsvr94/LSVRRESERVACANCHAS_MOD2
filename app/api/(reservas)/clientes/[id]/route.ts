import type { NextRequest } from "next/server";
import { errorDeValidacion } from "@/lib/compartido/validacion";
import { esquemaIdCliente } from "@/lib/reservas/esquemas";
import { responderError, responderInesperado } from "@/servidor/http";
import { obtenerCliente } from "@/servidor/reservas/consultas";

/** GET /api/clientes/[id]: id, nombre y teléfono enmascarado (solo los 3 últimos dígitos). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/clientes/[id]">) {
  const entrada = esquemaIdCliente.safeParse(await ctx.params);
  if (!entrada.success) return responderError(errorDeValidacion(entrada.error));

  try {
    const cliente = await obtenerCliente(entrada.data.id);
    if (!cliente) {
      return responderError({ status: 404, codigo: "CLIENTE_NO_ENCONTRADO", mensaje: "El cliente no existe." });
    }
    return Response.json(cliente);
  } catch (error) {
    return responderInesperado(error);
  }
}
