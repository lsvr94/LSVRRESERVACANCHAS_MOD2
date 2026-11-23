import { describe, expect, it } from "vitest";
import type { Tarifa } from "../../lib/canchas/tarifas";
import { bloquesLibres } from "../../lib/reservas/disponibilidad";
import { ahoraEnLima } from "../../lib/reservas/fechas";

const tarifas: Tarifa[] = [
  { hora_desde: 10, hora_hasta: 18, precio_hora: 80 },
  { hora_desde: 18, hora_hasta: 23, precio_hora: 120 },
];
const ahora = ahoraEnLima(new Date("2026-11-23T20:15:00Z")); // 23/11, 15:15 en Lima

describe("bloquesLibres", () => {
  it("un día futuro sin reservas tiene los 13 bloques (10 a 22) con su precio", () => {
    const libres = bloquesLibres({ fecha: "2026-11-24", horasOcupadas: [], tarifas, ahora });
    expect(libres).toHaveLength(13);
    expect(libres[0]).toEqual({ hora_inicio: 10, hora_fin: 11, precio: 80 });
    expect(libres[8]).toEqual({ hora_inicio: 18, hora_fin: 19, precio: 120 });
    expect(libres[12]).toEqual({ hora_inicio: 22, hora_fin: 23, precio: 120 });
  });

  it("quita los bloques ocupados", () => {
    const libres = bloquesLibres({ fecha: "2026-11-24", horasOcupadas: [10, 18], tarifas, ahora });
    const horas = libres.map((b) => b.hora_inicio);
    expect(horas).not.toContain(10);
    expect(horas).not.toContain(18);
    expect(horas).toHaveLength(11);
  });

  it("hoy no muestra los bloques que ya empezaron", () => {
    const libres = bloquesLibres({ fecha: "2026-11-23", horasOcupadas: [], tarifas, ahora });
    expect(libres.map((b) => b.hora_inicio)).toEqual([16, 17, 18, 19, 20, 21, 22]);
  });

  it("una fecha pasada no tiene bloques libres", () => {
    expect(bloquesLibres({ fecha: "2026-11-22", horasOcupadas: [], tarifas, ahora })).toEqual([]);
  });

  it("no muestra bloques sin tarifa, porque no se podrían reservar", () => {
    const soloDia: Tarifa[] = [{ hora_desde: 10, hora_hasta: 18, precio_hora: 80 }];
    const libres = bloquesLibres({ fecha: "2026-11-24", horasOcupadas: [], tarifas: soloDia, ahora });
    expect(libres.map((b) => b.hora_inicio)).toEqual([10, 11, 12, 13, 14, 15, 16, 17]);
  });
});
