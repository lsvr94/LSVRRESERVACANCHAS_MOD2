import type { NextRequest } from "next/server";
import { MONEDA } from "@/lib/canchas/tarifas";
import { errorDeValidacion } from "@/lib/compartido/validacion";
import { bloquesLibres } from "@/lib/reservas/disponibilidad";
import { esquemaDisponibilidad } from "@/lib/reservas/esquemas";
import { ahoraEnLima } from "@/lib/reservas/fechas";
import { obtenerCanchaConTarifas } from "@/servidor/canchas/consultas";
import { responderError, responderInesperado } from "@/servidor/http";
import { horasOcupadas } from "@/servidor/reservas/consultas";

/** GET /api/disponibilidad?fecha=YYYY-MM-DD&cancha_id=N: bloques libres con su precio. */
export async function GET(request: NextRequest) {
  const ahora = ahoraEnLima(new Date());
  const entrada = esquemaDisponibilidad(ahora).safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!entrada.success) return responderError(errorDeValidacion(entrada.error));
  const { fecha, cancha_id } = entrada.data;

  try {
    const cancha = await obtenerCanchaConTarifas(cancha_id);
    if (!cancha) {
      return responderError({ status: 404, codigo: "CANCHA_NO_ENCONTRADA", mensaje: "La cancha no existe." });
    }
    const ocupadas = await horasOcupadas(cancha_id, fecha);
    return Response.json({
      fecha,
      cancha_id,
      moneda: MONEDA,
      bloques_libres: bloquesLibres({ fecha, horasOcupadas: ocupadas, tarifas: cancha.tarifas, ahora }),
    });
  } catch (error) {
    return responderInesperado(error);
  }
}
