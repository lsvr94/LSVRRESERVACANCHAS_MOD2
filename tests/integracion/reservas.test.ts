import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getDisponibilidad } from "@/app/api/(reservas)/disponibilidad/route";
import { POST as postReserva } from "@/app/api/(reservas)/reservas/route";

// Fecha lejana: no choca con el seed y nunca es "pasada".
const FECHA = "2099-12-30";
const CANCHA_SIN_TARIFA = 99;
const BASE = "http://localhost/api";

// Cliente directo a la base (clave secreta), como lo haría un agente IA o un script.
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let clientes: number[] = [];

async function limpiar() {
  await db.from("reservas").delete().eq("fecha", FECHA);
  await db.from("canchas").delete().eq("id", CANCHA_SIN_TARIFA);
}

function reservar(cuerpo: Record<string, unknown>) {
  return postReserva(
    new Request(`${BASE}/reservas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    }),
  );
}

beforeAll(async () => {
  await limpiar();
  // Clientes del seed por teléfono (los ids pueden variar entre resets).
  const { data, error } = await db
    .from("clientes")
    .select("id, telefono")
    .in("telefono", ["+51900000001", "+51900000002", "+51900000003"])
    .order("telefono");
  if (error) throw error;
  clientes = data.map((c) => c.id);
  expect(clientes).toHaveLength(3);
});

afterAll(limpiar);

describe("reservas contra Supabase local", () => {
  it("POST válido → 201 con el precio de la tarifa", async () => {
    const respuesta = await reservar({ cliente_id: clientes[0], cancha_id: 1, fecha: FECHA, hora_inicio: 19 });
    expect(respuesta.status).toBe(201);
    const cuerpo = await respuesta.json();
    expect(cuerpo).toMatchObject({ cancha_id: 1, fecha: FECHA, hora_inicio: 19, precio: 120, estado: "pendiente" });
    expect(respuesta.headers.get("Location")).toBe(`/api/reservas/${cuerpo.id}`);
  });

  it("dos POST simultáneos al mismo bloque → uno 201 y otro 409", async () => {
    const respuestas = await Promise.all([
      reservar({ cliente_id: clientes[1], cancha_id: 2, fecha: FECHA, hora_inicio: 11 }),
      reservar({ cliente_id: clientes[2], cancha_id: 2, fecha: FECHA, hora_inicio: 11 }),
    ]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
    const perdedora = respuestas.find((r) => r.status === 409)!;
    expect((await perdedora.json()).error.codigo).toBe("BLOQUE_OCUPADO");
  });

  it("insert directo con precio 0 → el trigger guarda el precio real", async () => {
    const { data, error } = await db
      .from("reservas")
      .insert({ cliente_id: clientes[0], cancha_id: 3, fecha: FECHA, hora_inicio: 12, precio: 0 })
      .select("precio")
      .single();
    expect(error).toBeNull();
    expect(Number(data!.precio)).toBe(80);
  });

  it("update directo: el precio no se puede cambiar, y se recalcula si cambia la hora", async () => {
    const filtro = { cancha_id: 3, fecha: FECHA, hora_inicio: 12 };

    const precioCero = await db.from("reservas").update({ precio: 0 }).match(filtro).select("precio").single();
    expect(precioCero.error).toBeNull();
    expect(Number(precioCero.data!.precio)).toBe(80);

    const aLaNoche = await db.from("reservas").update({ hora_inicio: 20 }).match(filtro).select("precio").single();
    expect(aLaNoche.error).toBeNull();
    expect(Number(aLaNoche.data!.precio)).toBe(120);
  });

  it("insert directo en una cancha sin tarifa → la base lo rechaza", async () => {
    const cancha = await db.from("canchas").insert({ id: CANCHA_SIN_TARIFA, nombre: "Cancha de prueba sin tarifa" });
    expect(cancha.error).toBeNull();

    const { error } = await db
      .from("reservas")
      .insert({ cliente_id: clientes[0], cancha_id: CANCHA_SIN_TARIFA, fecha: FECHA, hora_inicio: 15, precio: 50 });
    expect(error?.code).toBe("23514");
    expect(error?.message).toMatch(/No hay tarifa/);
  });

  it("GET /api/disponibilidad no muestra el bloque reservado", async () => {
    const respuesta = await getDisponibilidad(new NextRequest(`${BASE}/disponibilidad?fecha=${FECHA}&cancha_id=1`));
    expect(respuesta.status).toBe(200);
    const horas = (await respuesta.json()).bloques_libres.map((b: { hora_inicio: number }) => b.hora_inicio);
    expect(horas).not.toContain(19);
    expect(horas).toContain(18);
  });
});
