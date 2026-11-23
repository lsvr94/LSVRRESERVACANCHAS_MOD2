import { describe, expect, it } from "vitest";
import { puedeCambiarEstado } from "../../lib/reservas/estados";

describe("puedeCambiarEstado", () => {
  it("permite pendiente → confirmada", () => {
    expect(puedeCambiarEstado("pendiente", "confirmada")).toBe(true);
  });

  it("permite cancelar una pendiente o una confirmada", () => {
    expect(puedeCambiarEstado("pendiente", "cancelada")).toBe(true);
    expect(puedeCambiarEstado("confirmada", "cancelada")).toBe(true);
  });

  it("una cancelada no vuelve atrás", () => {
    expect(puedeCambiarEstado("cancelada", "pendiente")).toBe(false);
    expect(puedeCambiarEstado("cancelada", "confirmada")).toBe(false);
  });

  it("una confirmada no vuelve a pendiente", () => {
    expect(puedeCambiarEstado("confirmada", "pendiente")).toBe(false);
  });

  it("quedarse en el mismo estado no es un cambio válido", () => {
    expect(puedeCambiarEstado("pendiente", "pendiente")).toBe(false);
    expect(puedeCambiarEstado("cancelada", "cancelada")).toBe(false);
  });
});
