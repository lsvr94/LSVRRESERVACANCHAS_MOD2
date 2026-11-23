import { esHoraDeInicioValida } from "./bloques";

export const ZONA_HORARIA_NEGOCIO = "America/Lima";

/** Fecha (YYYY-MM-DD) y hora entera (0–23) en la zona del negocio. */
export type AhoraLocal = { fecha: string; hora: number };

const formato = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA_NEGOCIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

/**
 * "Hoy" y la hora actual en America/Lima. Recibe el instante como parámetro
 * (en vez de leer el reloj) para que la función sea pura y se pueda probar.
 */
export function ahoraEnLima(instante: Date): AhoraLocal {
  const partes = Object.fromEntries(formato.formatToParts(instante).map((p) => [p.type, p.value]));
  return { fecha: `${partes.year}-${partes.month}-${partes.day}`, hora: Number(partes.hour) };
}

/** Las fechas YYYY-MM-DD se pueden comparar como texto. */
export function esFechaPasada(fecha: string, ahora: AhoraLocal): boolean {
  return fecha < ahora.fecha;
}

/** Un bloque ya empezó si su fecha es pasada, o si es hoy y su hora ya llegó. */
export function bloqueYaEmpezo(fecha: string, hora: number, ahora: AhoraLocal): boolean {
  return esFechaPasada(fecha, ahora) || (fecha === ahora.fecha && hora <= ahora.hora);
}

export type MotivoNoReservable = "HORA_INVALIDA" | "FECHA_PASADA" | "BLOQUE_YA_EMPEZO";

/** null si el bloque se puede reservar; si no, el motivo. */
export function validarBloqueReservable(
  fecha: string,
  hora: number,
  ahora: AhoraLocal,
): MotivoNoReservable | null {
  if (!esHoraDeInicioValida(hora)) return "HORA_INVALIDA";
  if (esFechaPasada(fecha, ahora)) return "FECHA_PASADA";
  if (bloqueYaEmpezo(fecha, hora, ahora)) return "BLOQUE_YA_EMPEZO";
  return null;
}
