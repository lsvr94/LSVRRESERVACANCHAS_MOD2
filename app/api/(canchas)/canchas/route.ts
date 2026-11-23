import { connection } from "next/server";
import { MONEDA } from "@/lib/canchas/tarifas";
import { listarCanchasConTarifas } from "@/servidor/canchas/consultas";
import { responderInesperado } from "@/servidor/http";

/** GET /api/canchas: canchas con sus tarifas. */
export async function GET() {
  // Con cacheComponents, un GET sin datos de la petición se prerenderizaría en el build.
  await connection();
  try {
    const canchas = await listarCanchasConTarifas();
    return Response.json({ canchas: canchas.map((c) => ({ ...c, moneda: MONEDA })) });
  } catch (error) {
    return responderInesperado(error);
  }
}
