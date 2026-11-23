import { describe, expect, it } from "vitest";
import {
  ahoraEnLima,
  bloqueYaEmpezo,
  esFechaPasada,
  validarBloqueReservable,
} from "../../lib/reservas/fechas";

// 2026-11-23T03:30Z = 22/11 a las 22:30 en Lima (UTC-5).
const nocheDel22 = new Date("2026-11-23T03:30:00Z");
// 2026-11-23T20:15Z = 23/11 a las 15:15 en Lima.
const tardeDel23 = new Date("2026-11-23T20:15:00Z");

describe("ahoraEnLima", () => {
  it("usa la fecha de Lima aunque en UTC ya sea el día siguiente", () => {
    expect(ahoraEnLima(nocheDel22)).toEqual({ fecha: "2026-11-22", hora: 22 });
  });

  it("devuelve la hora local de Lima (UTC-5)", () => {
    expect(ahoraEnLima(tardeDel23)).toEqual({ fecha: "2026-11-23", hora: 15 });
  });

  it("medianoche en Lima es hora 0, no 24", () => {
    expect(ahoraEnLima(new Date("2026-11-23T05:00:00Z"))).toEqual({ fecha: "2026-11-23", hora: 0 });
  });
});

describe("esFechaPasada", () => {
  const ahora = ahoraEnLima(tardeDel23);

  it("ayer es pasada; hoy y mañana no", () => {
    expect(esFechaPasada("2026-11-22", ahora)).toBe(true);
    expect(esFechaPasada("2026-11-23", ahora)).toBe(false);
    expect(esFechaPasada("2026-11-24", ahora)).toBe(false);
  });

  it("compara bien entre meses y años", () => {
    expect(esFechaPasada("2026-10-31", ahora)).toBe(true);
    expect(esFechaPasada("2027-01-01", ahora)).toBe(false);
  });
});

describe("bloqueYaEmpezo", () => {
  const ahora = ahoraEnLima(tardeDel23); // 23/11, 15:15

  it("hoy: los bloques hasta la hora actual ya empezaron", () => {
    expect(bloqueYaEmpezo("2026-11-23", 11, ahora)).toBe(true);
    expect(bloqueYaEmpezo("2026-11-23", 15, ahora)).toBe(true);
  });

  it("hoy: los bloques de la siguiente hora en adelante no", () => {
    expect(bloqueYaEmpezo("2026-11-23", 16, ahora)).toBe(false);
  });

  it("días pasados ya empezaron; días futuros no", () => {
    expect(bloqueYaEmpezo("2026-11-22", 22, ahora)).toBe(true);
    expect(bloqueYaEmpezo("2026-11-24", 10, ahora)).toBe(false);
  });
});

describe("validarBloqueReservable", () => {
  const ahora = ahoraEnLima(tardeDel23);

  it("acepta un bloque futuro dentro del horario", () => {
    expect(validarBloqueReservable("2026-11-23", 16, ahora)).toBeNull();
    expect(validarBloqueReservable("2026-11-24", 10, ahora)).toBeNull();
  });

  it("rechaza horas fuera de 10 a 22", () => {
    expect(validarBloqueReservable("2026-11-24", 9, ahora)).toBe("HORA_INVALIDA");
    expect(validarBloqueReservable("2026-11-24", 23, ahora)).toBe("HORA_INVALIDA");
  });

  it("rechaza fechas pasadas", () => {
    expect(validarBloqueReservable("2026-11-22", 20, ahora)).toBe("FECHA_PASADA");
  });

  it("rechaza un bloque de hoy que ya empezó", () => {
    expect(validarBloqueReservable("2026-11-23", 15, ahora)).toBe("BLOQUE_YA_EMPEZO");
  });
});
