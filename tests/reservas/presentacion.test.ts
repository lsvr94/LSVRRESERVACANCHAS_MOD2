import { describe, expect, it } from "vitest";
import {
  MENSAJE_ERROR_CONEXION,
  MENSAJE_OCUPADO,
  formatearBloque,
  formatearFecha,
  formatearPrecio,
  interpretarRespuestaReserva,
} from "../../lib/reservas/presentacion";

describe("formatos", () => {
  it("precio en soles con dos decimales", () => {
    expect(formatearPrecio(120)).toMatch(/^S\/\s?120\.00$/);
    expect(formatearPrecio(80.5)).toMatch(/^S\/\s?80\.50$/);
  });

  it("bloque de una hora", () => {
    expect(formatearBloque(19)).toBe("19:00–20:00");
    expect(formatearBloque(10)).toBe("10:00–11:00");
  });

  it("fecha en formato peruano", () => {
    expect(formatearFecha("2026-11-25")).toBe("25/11/2026");
  });
});

describe("interpretarRespuestaReserva", () => {
  it("201 → éxito con cancha, fecha, bloque, precio y estado", () => {
    const r = interpretarRespuestaReserva(
      201,
      { id: 7, fecha: "2026-11-25", hora_inicio: 19, precio: 120, estado: "pendiente" },
      "Cancha 2",
    );
    expect(r.tipo).toBe("exito");
    expect(r.mensaje).toMatch(/^Reserva #7 creada: Cancha 2, 25\/11\/2026, 19:00–20:00, S\/\s?120\.00 \(pendiente\)\.$/);
  });

  it("409 → mensaje fijo de bloque ocupado", () => {
    const r = interpretarRespuestaReserva(409, { error: { codigo: "BLOQUE_OCUPADO", mensaje: "x" } }, "Cancha 1");
    expect(r).toEqual({ tipo: "ocupado", mensaje: MENSAJE_OCUPADO });
    expect(MENSAJE_OCUPADO).toBe("Ese bloque acaba de ser reservado, elige otro.");
  });

  it("422 con campos → un mensaje por campo con etiqueta legible", () => {
    const r = interpretarRespuestaReserva(
      422,
      {
        error: {
          codigo: "DATOS_INVALIDOS",
          mensaje: "Revisa los datos enviados.",
          campos: { cliente_id: "Debe ser un número entero mayor que 0.", hora_inicio: "Ese bloque de hoy ya empezó." },
        },
      },
      "Cancha 1",
    );
    expect(r).toEqual({
      tipo: "invalido",
      mensaje: "Revisa los datos enviados.",
      campos: [
        { etiqueta: "ID de cliente", mensaje: "Debe ser un número entero mayor que 0." },
        { etiqueta: "Hora", mensaje: "Ese bloque de hoy ya empezó." },
      ],
    });
  });

  it("422 sin campos (p. ej. cliente inexistente) → el mensaje de la API", () => {
    const r = interpretarRespuestaReserva(
      422,
      { error: { codigo: "CLIENTE_NO_EXISTE", mensaje: "El cliente no existe." } },
      "Cancha 1",
    );
    expect(r).toEqual({ tipo: "invalido", mensaje: "El cliente no existe.", campos: [] });
  });

  it("un campo desconocido conserva su nombre como etiqueta", () => {
    const r = interpretarRespuestaReserva(
      422,
      { error: { codigo: "DATOS_INVALIDOS", mensaje: "Revisa", campos: { precio: "Campo no permitido." } } },
      "Cancha 1",
    );
    expect(r).toMatchObject({ tipo: "invalido", campos: [{ etiqueta: "precio", mensaje: "Campo no permitido." }] });
  });

  it("500 u otra respuesta → error de conexión", () => {
    expect(interpretarRespuestaReserva(500, { error: {} }, "Cancha 1")).toEqual({
      tipo: "error",
      mensaje: MENSAJE_ERROR_CONEXION,
    });
  });

  it("un cuerpo inesperado no rompe: se trata como error", () => {
    expect(interpretarRespuestaReserva(201, null, "Cancha 1").tipo).toBe("error");
    expect(interpretarRespuestaReserva(422, "texto", "Cancha 1").tipo).toBe("error");
  });
});
