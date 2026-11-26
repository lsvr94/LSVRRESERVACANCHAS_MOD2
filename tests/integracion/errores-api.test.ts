import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getDisponibilidad } from "@/app/api/(reservas)/disponibilidad/route";
import { POST as postReserva } from "@/app/api/(reservas)/reservas/route";

// Casos que antes solo se probaron a mano con curl (docs/codigos-http.md).
const FECHA = "2099-12-26";
const CANCHA_SIN_TARIFA = 98;
const BASE = "http://localhost/api";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let clienteId = 0;

async function limpiar() {
  await db.from("reservas").delete().eq("fecha", FECHA);
  await db.from("canchas").delete().eq("id", CANCHA_SIN_TARIFA);
}

function post(cuerpo: string | Record<string, unknown>) {
  return postReserva(
    new Request(`${BASE}/reservas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
    }),
  );
}

async function error(respuesta: Response) {
  return (await respuesta.json()).error as { codigo: string; campos?: Record<string, string> };
}

beforeAll(async () => {
  await limpiar();
  const { data, error: e } = await db.from("clientes").select("id").eq("telefono", "+51900000001").single();
  if (e) throw e;
  clienteId = data.id;
});

afterAll(limpiar);

describe("POST /api/reservas: datos del cuerpo que no existen (422, nuestro código o la base)", () => {
  it("cliente inexistente → 422 CLIENTE_NO_EXISTE (FK de la base)", async () => {
    const r = await post({ cliente_id: 999999999, cancha_id: 1, fecha: FECHA, hora_inicio: 10 });
    expect(r.status).toBe(422);
    expect((await error(r)).codigo).toBe("CLIENTE_NO_EXISTE");
  });

  it("cancha inexistente → 422 CANCHA_NO_EXISTE (nuestro código)", async () => {
    const r = await post({ cliente_id: clienteId, cancha_id: 999, fecha: FECHA, hora_inicio: 10 });
    expect(r.status).toBe(422);
    expect((await error(r)).codigo).toBe("CANCHA_NO_EXISTE");
  });

  it("cancha sin tarifa → 422 SIN_TARIFA (nuestro código)", async () => {
    const cancha = await db.from("canchas").insert({ id: CANCHA_SIN_TARIFA, nombre: "Cancha temporal sin tarifa" });
    expect(cancha.error).toBeNull();
    const r = await post({ cliente_id: clienteId, cancha_id: CANCHA_SIN_TARIFA, fecha: FECHA, hora_inicio: 10 });
    expect(r.status).toBe(422);
    expect((await error(r)).codigo).toBe("SIN_TARIFA");
  });
});

describe("POST /api/reservas: validación con Zod (422 DATOS_INVALIDOS)", () => {
  const valido = { cliente_id: 1, cancha_id: 1, fecha: FECHA, hora_inicio: 10 };

  it("hora 23 → error en hora_inicio", async () => {
    const e = await error(await post({ ...valido, hora_inicio: 23 }));
    expect(e.codigo).toBe("DATOS_INVALIDOS");
    expect(Object.keys(e.campos!)).toEqual(["hora_inicio"]);
  });

  it("fecha pasada → error en fecha", async () => {
    const e = await error(await post({ ...valido, fecha: "2020-01-01" }));
    expect(e.campos).toEqual({ fecha: "La fecha ya pasó." });
  });

  it("precio y estado enviados por el cliente → campos no permitidos", async () => {
    const r = await post({ ...valido, precio: 1, estado: "confirmada" });
    expect(r.status).toBe(422);
    expect((await error(r)).campos).toEqual({ precio: "Campo no permitido.", estado: "Campo no permitido." });
  });

  it("JSON roto → error en cuerpo", async () => {
    const r = await post('{"cliente_id": 1,');
    expect(r.status).toBe(422);
    expect(Object.keys((await error(r)).campos!)).toEqual(["cuerpo"]);
  });
});

describe("GET /api/disponibilidad", () => {
  it("cancha inexistente → 404 CANCHA_NO_ENCONTRADA", async () => {
    const r = await getDisponibilidad(new NextRequest(`${BASE}/disponibilidad?fecha=${FECHA}&cancha_id=999`));
    expect(r.status).toBe(404);
    expect((await error(r)).codigo).toBe("CANCHA_NO_ENCONTRADA");
  });
});
