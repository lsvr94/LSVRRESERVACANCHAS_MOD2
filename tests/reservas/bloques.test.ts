import { describe, expect, it } from "vitest";
import { esHoraDeInicioValida } from "../../lib/reservas/bloques";

describe("esHoraDeInicioValida", () => {
  it("acepta 10 y 22", () => {
    expect(esHoraDeInicioValida(10)).toBe(true);
    expect(esHoraDeInicioValida(22)).toBe(true);
  });

  it("rechaza 9, 23 y 10.5", () => {
    expect(esHoraDeInicioValida(9)).toBe(false);
    expect(esHoraDeInicioValida(23)).toBe(false);
    expect(esHoraDeInicioValida(10.5)).toBe(false);
  });
});
