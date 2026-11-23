import { describe, expect, it } from "vitest";
import { tarifaParaHora, type Tarifa } from "../../lib/canchas/tarifas";

const tarifas: Tarifa[] = [
  { hora_desde: 10, hora_hasta: 18, precio_hora: 80 },
  { hora_desde: 18, hora_hasta: 23, precio_hora: 120 },
];

describe("tarifaParaHora", () => {
  it("usa la tarifa de día de 10 a 17", () => {
    expect(tarifaParaHora(tarifas, 10)).toBe(80);
    expect(tarifaParaHora(tarifas, 17)).toBe(80);
  });

  it("a las 18 ya aplica la tarifa de noche (hora_hasta no se incluye)", () => {
    expect(tarifaParaHora(tarifas, 18)).toBe(120);
    expect(tarifaParaHora(tarifas, 22)).toBe(120);
  });

  it("devuelve null si ninguna tarifa cubre la hora", () => {
    expect(tarifaParaHora(tarifas, 9)).toBeNull();
    expect(tarifaParaHora([{ hora_desde: 10, hora_hasta: 18, precio_hora: 80 }], 20)).toBeNull();
    expect(tarifaParaHora([], 12)).toBeNull();
  });
});
