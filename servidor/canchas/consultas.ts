import "server-only";
// API pública del contexto canchas. No puede importar nada de reservas (ESLint).
import type { Tarifa } from "@/lib/canchas/tarifas";
import { obtenerSupabase } from "@/servidor/supabase";

export type CanchaConTarifas = { id: number; nombre: string; tarifas: Tarifa[] };

type FilaCancha = {
  id: number;
  nombre: string;
  tarifas: { hora_desde: number; hora_hasta: number; precio_hora: number | string }[];
};

const COLUMNAS = "id, nombre, tarifas(hora_desde, hora_hasta, precio_hora)";

function aCancha(fila: FilaCancha): CanchaConTarifas {
  return {
    id: fila.id,
    nombre: fila.nombre,
    tarifas: fila.tarifas
      .map((t) => ({ hora_desde: t.hora_desde, hora_hasta: t.hora_hasta, precio_hora: Number(t.precio_hora) }))
      .sort((a, b) => a.hora_desde - b.hora_desde),
  };
}

export async function listarCanchasConTarifas(): Promise<CanchaConTarifas[]> {
  const { data, error } = await obtenerSupabase().from("canchas").select(COLUMNAS).order("id");
  if (error) throw error;
  return (data as unknown as FilaCancha[]).map(aCancha);
}

/** La cancha con sus tarifas, o null si no existe. */
export async function obtenerCanchaConTarifas(canchaId: number): Promise<CanchaConTarifas | null> {
  const { data, error } = await obtenerSupabase()
    .from("canchas")
    .select(COLUMNAS)
    .eq("id", canchaId)
    .maybeSingle();
  if (error) throw error;
  return data ? aCancha(data as unknown as FilaCancha) : null;
}
