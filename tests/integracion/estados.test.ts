import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as postReserva } from "@/app/api/(reservas)/reservas/route";

// Fecha propia (reservas.test.ts usa 2099-12-30): no choca con el seed ni con otras pruebas.
const FECHA = "2099-12-29";
const BASE = "http://localhost/api";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let clienteId = 0;

/** Crea una reserva directo en la base y devuelve su id. */
async function crearReserva(cancha_id: number, hora_inicio: number, estado = "pendiente") {
  const { data, error } = await db
    .from("reservas")
    .insert({ cliente_id: clienteId, cancha_id, fecha: FECHA, hora_inicio, estado, precio: 0 })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

/** Llama a PATCH /api/reservas/[id]/estado. Import dinámico: si la ruta no existe, falla solo esta prueba. */
async function cambiarEstado(id: number | string, cuerpo: unknown) {
  const { PATCH } = await import("@/app/api/(reservas)/reservas/[id]/estado/route");
  return PATCH(
    new Request(`${BASE}/reservas/${id}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    }) as never,
    { params: Promise.resolve({ id: String(id) }) },
  );
}

beforeAll(async () => {
  await db.from("reservas").delete().eq("fecha", FECHA);
  const { data, error } = await db.from("clientes").select("id").eq("telefono", "+51900000001").single();
  if (error) throw error;
  clienteId = data.id;
});

afterAll(async () => {
  await db.from("reservas").delete().eq("fecha", FECHA);
});

describe("PATCH /api/reservas/[id]/estado", () => {
  it("pendiente → confirmada → cancelada: 200 con la reserva actualizada", async () => {
    const id = await crearReserva(1, 10);

    const confirmar = await cambiarEstado(id, { estado: "confirmada" });
    expect(confirmar.status).toBe(200);
    const cuerpo = await confirmar.json();
    expect(cuerpo).toMatchObject({ id, estado: "confirmada", fecha: FECHA, hora_inicio: 10, precio: 80 });
    expect(cuerpo.cancha).toEqual({ id: 1, nombre: "Cancha 1" });
    expect(cuerpo.cliente).not.toHaveProperty("telefono");

    const cancelar = await cambiarEstado(id, { estado: "cancelada" });
    expect(cancelar.status).toBe(200);
    expect((await cancelar.json()).estado).toBe("cancelada");
  });

  it("cancelada → pendiente: 409 TRANSICION_NO_PERMITIDA", async () => {
    const id = await crearReserva(1, 11, "cancelada");
    const r = await cambiarEstado(id, { estado: "pendiente" });
    expect(r.status).toBe(409);
    expect((await r.json()).error.codigo).toBe("TRANSICION_NO_PERMITIDA");
  });

  it("pendiente → pendiente (mismo estado): 409", async () => {
    const id = await crearReserva(1, 12);
    const r = await cambiarEstado(id, { estado: "pendiente" });
    expect(r.status).toBe(409);
  });

  it("reserva inexistente: 404; estado inválido: 422 con campos.estado", async () => {
    const noExiste = await cambiarEstado(999999999, { estado: "confirmada" });
    expect(noExiste.status).toBe(404);
    expect((await noExiste.json()).error.codigo).toBe("RESERVA_NO_ENCONTRADA");

    const id = await crearReserva(1, 13);
    const invalido = await cambiarEstado(id, { estado: "pagada" });
    expect(invalido.status).toBe(422);
    expect((await invalido.json()).error.campos).toHaveProperty("estado");
  });

  it("cancelar libera el bloque: un POST al mismo bloque da 201", async () => {
    const id = await crearReserva(2, 15);
    expect((await cambiarEstado(id, { estado: "cancelada" })).status).toBe(200);

    const nueva = await postReserva(
      new Request(`${BASE}/reservas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId, cancha_id: 2, fecha: FECHA, hora_inicio: 15 }),
      }),
    );
    expect(nueva.status).toBe(201);
  });

  it("dos PATCH simultáneos a confirmada: uno 200 y otro 409", async () => {
    const id = await crearReserva(2, 16);
    const respuestas = await Promise.all([
      cambiarEstado(id, { estado: "confirmada" }),
      cambiarEstado(id, { estado: "confirmada" }),
    ]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
  });
});

describe("trigger reservas_transicion_estado (escritura directa, como un agente IA)", () => {
  it("rechaza confirmada → pendiente con SQLSTATE RS001", async () => {
    const id = await crearReserva(3, 10, "confirmada");
    const { error } = await db.from("reservas").update({ estado: "pendiente" }).eq("id", id);
    expect(error?.code).toBe("RS001");
  });

  it("rechaza cancelada → confirmada con SQLSTATE RS001", async () => {
    const id = await crearReserva(3, 11, "cancelada");
    const { error } = await db.from("reservas").update({ estado: "confirmada" }).eq("id", id);
    expect(error?.code).toBe("RS001");
  });

  it("no bloquea un UPDATE que no cambia el estado", async () => {
    const id = await crearReserva(3, 12, "confirmada");
    const { error } = await db.from("reservas").update({ estado: "confirmada" }).eq("id", id);
    expect(error).toBeNull();
  });
});
