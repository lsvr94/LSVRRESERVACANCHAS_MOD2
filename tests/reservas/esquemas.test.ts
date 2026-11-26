import { describe, expect, it } from "vitest";
import {
  esquemaCambioEstado,
  esquemaCrearReserva,
  esquemaDisponibilidad,
  esquemaIdReserva,
} from "../../lib/reservas/esquemas";
import { ahoraEnLima } from "../../lib/reservas/fechas";

const ahora = ahoraEnLima(new Date("2026-11-23T20:15:00Z")); // 23/11, 15:15 en Lima

/** Campos con error, para comparar sin depender del texto exacto. */
function camposConError(resultado: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return resultado.error?.issues.map((i) => i.path.join(".")) ?? [];
}

describe("esquemaDisponibilidad", () => {
  const esquema = esquemaDisponibilidad(ahora);

  it("acepta los query params (texto) y convierte cancha_id a número", () => {
    const r = esquema.safeParse({ fecha: "2026-11-24", cancha_id: "1" });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ fecha: "2026-11-24", cancha_id: 1 });
  });

  it("acepta hoy", () => {
    expect(esquema.safeParse({ fecha: "2026-11-23", cancha_id: "2" }).success).toBe(true);
  });

  it("rechaza una fecha pasada", () => {
    const r = esquema.safeParse({ fecha: "2026-11-22", cancha_id: "1" });
    expect(camposConError(r)).toEqual(["fecha"]);
  });

  it("rechaza fechas mal formadas o inexistentes", () => {
    for (const fecha of ["24-11-2026", "2026-13-01", "mañana", ""]) {
      expect(camposConError(esquema.safeParse({ fecha, cancha_id: "1" }))).toEqual(["fecha"]);
    }
  });

  it("rechaza cancha_id no numérico, decimal, cero o ausente", () => {
    for (const cancha_id of ["abc", "1.5", "0", undefined]) {
      expect(camposConError(esquema.safeParse({ fecha: "2026-11-24", cancha_id }))).toEqual([
        "cancha_id",
      ]);
    }
  });
});

describe("esquemaCrearReserva", () => {
  const esquema = esquemaCrearReserva(ahora);
  const valido = { cliente_id: 1, cancha_id: 1, fecha: "2026-11-24", hora_inicio: 19 };

  it("acepta una reserva válida", () => {
    expect(esquema.safeParse(valido).data).toEqual(valido);
  });

  it("rechaza horas fuera de 10 a 22 o no enteras", () => {
    for (const hora_inicio of [9, 23, 10.5]) {
      expect(camposConError(esquema.safeParse({ ...valido, hora_inicio }))).toEqual(["hora_inicio"]);
    }
  });

  it("rechaza una fecha pasada (error en fecha)", () => {
    expect(camposConError(esquema.safeParse({ ...valido, fecha: "2026-11-22" }))).toEqual(["fecha"]);
  });

  it("rechaza un bloque de hoy que ya empezó (error en hora_inicio)", () => {
    const r = esquema.safeParse({ ...valido, fecha: "2026-11-23", hora_inicio: 15 });
    expect(camposConError(r)).toEqual(["hora_inicio"]);
  });

  it("acepta un bloque de hoy que aún no empieza", () => {
    expect(esquema.safeParse({ ...valido, fecha: "2026-11-23", hora_inicio: 16 }).success).toBe(true);
  });

  it("rechaza campos extra como precio o estado (los fija el servidor)", () => {
    const r = esquema.safeParse({ ...valido, precio: 1, estado: "confirmada" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].code).toBe("unrecognized_keys");
  });

  it("no convierte texto a número en el cuerpo JSON", () => {
    expect(camposConError(esquema.safeParse({ ...valido, cliente_id: "1" }))).toEqual(["cliente_id"]);
  });

  it("rechaza campos faltantes", () => {
    const r = esquema.safeParse({});
    expect(camposConError(r).sort()).toEqual(["cancha_id", "cliente_id", "fecha", "hora_inicio"]);
  });
});

describe("esquemaIdReserva", () => {
  it("convierte el id de la URL a número", () => {
    expect(esquemaIdReserva.safeParse({ id: "7" }).data).toEqual({ id: 7 });
  });

  it("rechaza id no numérico, decimal o ≤ 0", () => {
    for (const id of ["abc", "1.5", "0", "-3"]) {
      expect(camposConError(esquemaIdReserva.safeParse({ id }))).toEqual(["id"]);
    }
  });
});

describe("esquemaCambioEstado", () => {
  it("acepta los tres estados", () => {
    for (const estado of ["pendiente", "confirmada", "cancelada"]) {
      expect(esquemaCambioEstado.safeParse({ estado }).data).toEqual({ estado });
    }
  });

  it("rechaza estados inválidos, ausentes o no textuales (error en estado)", () => {
    for (const cuerpo of [{ estado: "pagada" }, {}, { estado: 1 }]) {
      expect(camposConError(esquemaCambioEstado.safeParse(cuerpo))).toEqual(["estado"]);
    }
  });

  it("rechaza campos extra", () => {
    const r = esquemaCambioEstado.safeParse({ estado: "confirmada", precio: 0 });
    expect(r.error?.issues[0].code).toBe("unrecognized_keys");
  });
});
