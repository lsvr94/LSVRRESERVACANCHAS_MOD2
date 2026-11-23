export const ESTADOS_RESERVA = ["pendiente", "confirmada", "cancelada"] as const;
export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

/** Cambios permitidos (AGENTS.md): pendiente → confirmada; pendiente o confirmada → cancelada. */
const TRANSICIONES: Record<EstadoReserva, readonly EstadoReserva[]> = {
  pendiente: ["confirmada", "cancelada"],
  confirmada: ["cancelada"],
  cancelada: [],
};

export function puedeCambiarEstado(de: EstadoReserva, a: EstadoReserva): boolean {
  return TRANSICIONES[de].includes(a);
}
