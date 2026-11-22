export const HORA_APERTURA = 10;
export const HORA_CIERRE = 23;

/**
 * Una reserva dura 1 hora, así que la última hora de inicio válida es HORA_CIERRE - 1.
 */
export function esHoraDeInicioValida(hora: number): boolean {
  return Number.isInteger(hora) && hora >= HORA_APERTURA && hora < HORA_CIERRE;
}
