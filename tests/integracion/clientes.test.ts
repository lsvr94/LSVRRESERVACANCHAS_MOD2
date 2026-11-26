import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Cliente temporal con sus propias reservas, para que el orden y el contenido sean deterministas.
const TELEFONO = "+51900009999";
const TELEFONO_SIN_RESERVAS = "+51900009998";
const BASE = "http://localhost/api";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let clienteId = 0;
let clienteSinReservasId = 0;

async function limpiar() {
  const { data } = await db.from("clientes").select("id").in("telefono", [TELEFONO, TELEFONO_SIN_RESERVAS]);
  const ids = (data ?? []).map((c) => c.id);
  if (ids.length > 0) {
    await db.from("reservas").delete().in("cliente_id", ids);
    await db.from("clientes").delete().in("id", ids);
  }
}

/** Import dinámico: si la ruta todavía no existe, falla solo la prueba que la usa. */
async function getCliente(id: number | string) {
  const { GET } = await import("@/app/api/(reservas)/clientes/[id]/route");
  return GET(new Request(`${BASE}/clientes/${id}`) as never, { params: Promise.resolve({ id: String(id) }) });
}

async function getReservasDeCliente(id: number | string) {
  const { GET } = await import("@/app/api/(reservas)/clientes/[id]/reservas/route");
  return GET(new Request(`${BASE}/clientes/${id}/reservas`) as never, {
    params: Promise.resolve({ id: String(id) }),
  });
}

beforeAll(async () => {
  await limpiar();
  const { data, error } = await db
    .from("clientes")
    .insert([
      { nombre: "Cliente de prueba", telefono: TELEFONO },
      { nombre: "Cliente sin reservas", telefono: TELEFONO_SIN_RESERVAS },
    ])
    .select("id, telefono");
  if (error) throw error;
  clienteId = data.find((c) => c.telefono === TELEFONO)!.id;
  clienteSinReservasId = data.find((c) => c.telefono === TELEFONO_SIN_RESERVAS)!.id;

  // El precio lo fija el trigger desde tarifas.
  const reservas = await db.from("reservas").insert([
    { cliente_id: clienteId, cancha_id: 2, fecha: "2099-12-27", hora_inicio: 10, estado: "cancelada", precio: 0 },
    { cliente_id: clienteId, cancha_id: 1, fecha: "2099-12-28", hora_inicio: 10, estado: "pendiente", precio: 0 },
    { cliente_id: clienteId, cancha_id: 3, fecha: "2099-12-28", hora_inicio: 18, estado: "confirmada", precio: 0 },
  ]);
  if (reservas.error) throw reservas.error;
});

afterAll(limpiar);

describe("GET /api/clientes/[id]", () => {
  it("200 con el teléfono enmascarado (solo los 3 últimos dígitos)", async () => {
    const r = await getCliente(clienteId);
    expect(r.status).toBe(200);
    const texto = await r.text();
    expect(JSON.parse(texto)).toEqual({ id: clienteId, nombre: "Cliente de prueba", telefono: "+********999" });
    expect(texto).not.toContain(TELEFONO);
  });

  it("404 si no existe; 422 si el id no es válido", async () => {
    const noExiste = await getCliente(999999999);
    expect(noExiste.status).toBe(404);
    expect((await noExiste.json()).error.codigo).toBe("CLIENTE_NO_ENCONTRADO");

    const invalido = await getCliente("abc");
    expect(invalido.status).toBe(422);
    expect((await invalido.json()).error.campos).toHaveProperty("id");
  });
});

describe("GET /api/clientes/[id]/reservas", () => {
  it("200 con sus reservas, de la más reciente a la más antigua, sin teléfono", async () => {
    const r = await getReservasDeCliente(clienteId);
    expect(r.status).toBe(200);
    const texto = await r.text();
    const cuerpo = JSON.parse(texto);

    expect(cuerpo.cliente).toEqual({ id: clienteId, nombre: "Cliente de prueba" });
    expect(
      cuerpo.reservas.map((x: { fecha: string; hora_inicio: number }) => `${x.fecha} ${x.hora_inicio}`),
    ).toEqual(["2099-12-28 18", "2099-12-28 10", "2099-12-27 10"]);
    expect(cuerpo.reservas[0]).toMatchObject({
      hora_fin: 19,
      cancha: { id: 3, nombre: "Cancha 3" },
      precio: 120,
      moneda: "PEN",
      estado: "confirmada",
    });
    expect(cuerpo.reservas[1]).toMatchObject({ precio: 80, estado: "pendiente" });
    expect(cuerpo.reservas[2]).toMatchObject({ precio: 80, estado: "cancelada" });
    expect(texto).not.toContain("telefono");
  });

  it("un cliente sin reservas → lista vacía", async () => {
    const r = await getReservasDeCliente(clienteSinReservasId);
    expect(r.status).toBe(200);
    expect((await r.json()).reservas).toEqual([]);
  });

  it("404 si el cliente no existe; 422 si el id no es válido", async () => {
    const noExiste = await getReservasDeCliente(999999999);
    expect(noExiste.status).toBe(404);
    expect((await noExiste.json()).error.codigo).toBe("CLIENTE_NO_ENCONTRADO");

    expect((await getReservasDeCliente("0")).status).toBe(422);
  });
});
