import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorDeValidacion } from "../../lib/compartido/validacion";

const esquema = z.strictObject({
  hora_inicio: z.number({ error: "Debe ser un número." }).int().min(10, { error: "Mínimo 10." }),
  fecha: z.string({ error: "Falta la fecha." }),
});

describe("errorDeValidacion", () => {
  it("devuelve 422 DATOS_INVALIDOS con un mensaje por campo", () => {
    const r = esquema.safeParse({ hora_inicio: 9 });
    expect(errorDeValidacion(r.error!)).toEqual({
      status: 422,
      codigo: "DATOS_INVALIDOS",
      mensaje: "Revisa los datos enviados.",
      campos: { hora_inicio: "Mínimo 10.", fecha: "Falta la fecha." },
    });
  });

  it("marca cada campo extra como no permitido", () => {
    const r = esquema.safeParse({ hora_inicio: 10, fecha: "x", precio: 1, estado: "y" });
    expect(errorDeValidacion(r.error!).campos).toEqual({
      precio: "Campo no permitido.",
      estado: "Campo no permitido.",
    });
  });

  it("si el cuerpo no es un objeto, el error va en 'cuerpo'", () => {
    const r = esquema.safeParse("hola");
    expect(Object.keys(errorDeValidacion(r.error!).campos!)).toEqual(["cuerpo"]);
  });

  it("si un campo tiene varios errores, se queda con el primero", () => {
    const doble = z.object({ x: z.string().min(3, { error: "Corto." }).regex(/^\d+$/, { error: "Solo dígitos." }) });
    const r = doble.safeParse({ x: "a" });
    expect(errorDeValidacion(r.error!).campos).toEqual({ x: "Corto." });
  });
});
