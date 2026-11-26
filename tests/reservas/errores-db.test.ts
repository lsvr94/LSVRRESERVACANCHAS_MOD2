import { describe, expect, it } from "vitest";
import { cuerpoDeError } from "../../lib/compartido/errores";
import { traducirErrorDeBase } from "../../lib/reservas/errores-db";

// Mensajes reales de Postgres (copiados de la prueba de la migración).
describe("traducirErrorDeBase", () => {
  it("choque en el índice único → 409 BLOQUE_OCUPADO", () => {
    const e = traducirErrorDeBase({
      code: "23505",
      message: 'duplicate key value violates unique constraint "reservas_bloque_ocupado_unico"',
    });
    expect(e.status).toBe(409);
    expect(e.codigo).toBe("BLOQUE_OCUPADO");
    expect(e.mensaje).toMatch(/elige otro/);
  });

  it("cliente inexistente (FK) → 422 CLIENTE_NO_EXISTE", () => {
    const e = traducirErrorDeBase({
      code: "23503",
      message:
        'insert or update on table "reservas" violates foreign key constraint "reservas_cliente_id_fkey"',
    });
    expect(e).toMatchObject({ status: 422, codigo: "CLIENTE_NO_EXISTE" });
  });

  it("cancha inexistente (FK) → 422 CANCHA_NO_EXISTE", () => {
    const e = traducirErrorDeBase({
      code: "23503",
      message:
        'insert or update on table "reservas" violates foreign key constraint "reservas_cancha_id_fkey"',
    });
    expect(e).toMatchObject({ status: 422, codigo: "CANCHA_NO_EXISTE" });
  });

  it("violación de CHECK (escritura que se saltó Zod) → 422 DATOS_INVALIDOS", () => {
    const e = traducirErrorDeBase({
      code: "23514",
      message: 'new row for relation "reservas" violates check constraint "reservas_hora_inicio_check"',
    });
    expect(e).toMatchObject({ status: 422, codigo: "DATOS_INVALIDOS" });
  });

  it("cualquier otro error → 500 genérico, sin filtrar el mensaje de la base", () => {
    const e = traducirErrorDeBase({ code: "08006", message: "connection failure at 127.0.0.1" });
    expect(e.status).toBe(500);
    expect(e.codigo).toBe("ERROR_INTERNO");
    expect(e.mensaje).not.toMatch(/127\.0\.0\.1/);
  });

  it("un 23505 de otra restricción no se confunde con un choque", () => {
    const e = traducirErrorDeBase({
      code: "23505",
      message: 'duplicate key value violates unique constraint "clientes_telefono_key"',
    });
    expect(e.codigo).not.toBe("BLOQUE_OCUPADO");
  });
});

describe("cuerpoDeError", () => {
  it("arma el formato único sin el status", () => {
    expect(cuerpoDeError({ status: 409, codigo: "BLOQUE_OCUPADO", mensaje: "Ocupado" })).toEqual({
      error: { codigo: "BLOQUE_OCUPADO", mensaje: "Ocupado" },
    });
  });

  it("incluye campos solo cuando hay", () => {
    expect(
      cuerpoDeError({
        status: 422,
        codigo: "DATOS_INVALIDOS",
        mensaje: "Revisa los datos",
        campos: { hora_inicio: "Debe estar entre 10 y 22" },
      }),
    ).toEqual({
      error: {
        codigo: "DATOS_INVALIDOS",
        mensaje: "Revisa los datos",
        campos: { hora_inicio: "Debe estar entre 10 y 22" },
      },
    });
  });
});

describe("traducirErrorDeBase: trigger de transiciones", () => {
  it("SQLSTATE RS001 (trigger reservas_transicion_estado) → 409 TRANSICION_NO_PERMITIDA", () => {
    const e = traducirErrorDeBase({ code: "RS001", message: "Transición no permitida: cancelada → pendiente" });
    expect(e).toMatchObject({ status: 409, codigo: "TRANSICION_NO_PERMITIDA" });
    expect(e.mensaje).not.toMatch(/→/); // no se expone el mensaje de la base
  });
});
