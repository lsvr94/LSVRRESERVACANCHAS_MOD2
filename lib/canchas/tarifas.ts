/** Franja de precio de una cancha: aplica a las horas de inicio en [hora_desde, hora_hasta). */
export type Tarifa = {
  hora_desde: number;
  hora_hasta: number;
  precio_hora: number;
};

/** Precio del bloque que empieza a `hora`, o null si ninguna tarifa la cubre. */
export function tarifaParaHora(tarifas: readonly Tarifa[], hora: number): number | null {
  const tarifa = tarifas.find((t) => hora >= t.hora_desde && hora < t.hora_hasta);
  return tarifa ? tarifa.precio_hora : null;
}
