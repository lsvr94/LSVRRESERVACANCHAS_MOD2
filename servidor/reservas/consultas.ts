import "server-only";
import { MONEDA } from "@/lib/canchas/tarifas";
import type { EstadoReserva } from "@/lib/reservas/estados";
import type { ErrorDeBase } from "@/lib/reservas/errores-db";
import type { CrearReserva } from "@/lib/reservas/esquemas";
import { obtenerSupabase } from "@/servidor/supabase";

type FilaReserva = {
  id: number;
  cliente_id: number;
  cancha_id: number;
  fecha: string;
  hora_inicio: number;
  estado: EstadoReserva;
  precio: number | string;
  creada_en: string;
};

/** Respuesta de POST /api/reservas (contrato acordado). */
export type ReservaCreada = Omit<FilaReserva, "precio"> & {
  hora_fin: number;
  precio: number;
  moneda: typeof MONEDA;
};

/** Respuesta de GET /api/reservas/[id]: sin teléfono del cliente. */
export type ReservaDetalle = {
  id: number;
  cancha: { id: number; nombre: string };
  cliente: { id: number; nombre: string };
  fecha: string;
  hora_inicio: number;
  hora_fin: number;
  estado: EstadoReserva;
  precio: number;
  moneda: typeof MONEDA;
  creada_en: string;
};

/** Horas de inicio ocupadas (reservas no canceladas) de una cancha en una fecha. */
export async function horasOcupadas(canchaId: number, fecha: string): Promise<number[]> {
  const { data, error } = await obtenerSupabase()
    .from("reservas")
    .select("hora_inicio")
    .eq("cancha_id", canchaId)
    .eq("fecha", fecha)
    .neq("estado", "cancelada");
  if (error) throw error;
  return (data as { hora_inicio: number }[]).map((r) => r.hora_inicio);
}

/**
 * Inserta sin consultar antes si el bloque está libre: el índice único decide
 * (ADR-0002). El error se devuelve para que la ruta lo traduzca.
 */
export async function insertarReserva(
  datos: CrearReserva & { precio: number },
): Promise<{ reserva: ReservaCreada } | { error: ErrorDeBase }> {
  const { data, error } = await obtenerSupabase()
    .from("reservas")
    .insert(datos)
    .select("id, cliente_id, cancha_id, fecha, hora_inicio, estado, precio, creada_en")
    .single();
  if (error) return { error };
  const fila = data as FilaReserva;
  return {
    reserva: { ...fila, hora_fin: fila.hora_inicio + 1, precio: Number(fila.precio), moneda: MONEDA },
  };
}

type FilaDetalle = Omit<FilaReserva, "cliente_id" | "cancha_id"> & {
  cancha: { id: number; nombre: string };
  cliente: { id: number; nombre: string };
};

/** La reserva con su cancha y cliente, o null si no existe. */
export async function obtenerReserva(id: number): Promise<ReservaDetalle | null> {
  const { data, error } = await obtenerSupabase()
    .from("reservas")
    .select(
      "id, fecha, hora_inicio, estado, precio, creada_en, cancha:canchas(id, nombre), cliente:clientes(id, nombre)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const f = data as unknown as FilaDetalle;
  return {
    id: f.id,
    cancha: f.cancha,
    cliente: f.cliente,
    fecha: f.fecha,
    hora_inicio: f.hora_inicio,
    hora_fin: f.hora_inicio + 1,
    estado: f.estado,
    precio: Number(f.precio),
    moneda: MONEDA,
    creada_en: f.creada_en,
  };
}
