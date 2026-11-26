import { describe, expect, it } from "vitest";
import { enmascararTelefono } from "../../lib/reservas/clientes";

describe("enmascararTelefono", () => {
  it("deja visibles solo los 3 últimos dígitos y conserva el +", () => {
    expect(enmascararTelefono("+51900000001")).toBe("+********001");
  });

  it("funciona sin prefijo", () => {
    expect(enmascararTelefono("987654321")).toBe("******321");
  });

  it("conserva espacios y guiones", () => {
    expect(enmascararTelefono("+51 987 654-321")).toBe("+** *** ***-321");
  });

  it("con 3 dígitos o menos no oculta nada", () => {
    expect(enmascararTelefono("123")).toBe("123");
    expect(enmascararTelefono("12")).toBe("12");
  });
});
