// reservas → canchas está permitido; canchas nunca importa de reservas.
import { tarifaParaHora, type Tarifa } from "../canchas/tarifas";
import { HORA_APERTURA, HORA_CIERRE } from "./bloques";
import { bloqueYaEmpezo, type AhoraLocal } from "./fechas";

export type BloqueLibre = { hora_inicio: number; hora_fin: number; precio: number };

/**
 * Bloques que se pueden reservar en una cancha y fecha: de 10 a 22, sin los
 * ocupados (reservas no canceladas), sin los que ya empezaron y sin los que no
 * tienen tarifa.
 */
export function bloquesLibres(params: {
  fecha: string;
  horasOcupadas: readonly number[];
  tarifas: readonly Tarifa[];
  ahora: AhoraLocal;
}): BloqueLibre[] {
  const { fecha, horasOcupadas, tarifas, ahora } = params;
  const ocupadas = new Set(horasOcupadas);
  const libres: BloqueLibre[] = [];

  for (let hora = HORA_APERTURA; hora < HORA_CIERRE; hora++) {
    if (ocupadas.has(hora) || bloqueYaEmpezo(fecha, hora, ahora)) continue;
    const precio = tarifaParaHora(tarifas, hora);
    if (precio === null) continue;
    libres.push({ hora_inicio: hora, hora_fin: hora + 1, precio });
  }
  return libres;
}
