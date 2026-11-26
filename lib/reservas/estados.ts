export const ESTADOS_RESERVA = ["pendiente", "confirmada", "cancelada"] as const;
export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

/**
 * Cambios permitidos (AGENTS.md): pendiente → confirmada; pendiente o confirmada → cancelada.
 * La misma regla está en la base (trigger reservas_transicion_estado): si cambia una, cambia la otra.
 */
const TRANSICIONES: Record<EstadoReserva, readonly EstadoReserva[]> = {
  pendiente: ["confirmada", "cancelada"],
  confirmada: ["cancelada"],
  cancelada: [],
};

export function puedeCambiarEstado(de: EstadoReserva, a: EstadoReserva): boolean {
  return TRANSICIONES[de].includes(a);
}

export function mensajeTransicionNoPermitida(de: EstadoReserva, a: EstadoReserva): string {
  return `No se puede pasar una reserva de ${de} a ${a}.`;
}
