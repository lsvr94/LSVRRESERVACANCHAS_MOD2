"use client";

// Esta pantalla usa SOLO la API con fetch (AGENTS.md). De lib/ solo importa funciones puras.
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { ahoraEnLima } from "@/lib/reservas/fechas";
import {
  MENSAJE_ERROR_CONEXION,
  formatearBloque,
  formatearPrecio,
  interpretarRespuestaReserva,
  type ResultadoReserva,
} from "@/lib/reservas/presentacion";

// Tipos de las respuestas de la API (declarados aquí: la pantalla no importa de servidor/).
type Cancha = { id: number; nombre: string };
type Bloque = { hora_inicio: number; hora_fin: number; precio: number };

type EstadoCanchas = { intento: number } & ({ ok: true; canchas: Cancha[] } | { ok: false });
type EstadoBloques = { clave: string } & ({ ok: true; bloques: Bloque[] } | { ok: false; mensaje: string });

/** "Hoy" en Lima, leído solo en el navegador (en el servidor es null: se muestra "Cargando…"). */
function useHoyEnLima(): string | null {
  return useSyncExternalStore(
    () => () => {},
    () => ahoraEnLima(new Date()).fecha,
    () => null,
  );
}

async function pedirJson(url: string, init?: RequestInit) {
  const respuesta = await fetch(url, { cache: "no-store", ...init });
  const cuerpo: unknown = await respuesta.json().catch(() => null);
  return { status: respuesta.status, cuerpo };
}

function esAborto(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function mensajeDeError(cuerpo: unknown): string | null {
  if (typeof cuerpo !== "object" || cuerpo === null || !("error" in cuerpo)) return null;
  const { error } = cuerpo as { error?: { mensaje?: unknown } };
  return typeof error?.mensaje === "string" ? error.mensaje : null;
}

const estiloCampo =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const estiloBotonSecundario =
  "mt-2 rounded-lg border border-current px-3 py-1.5 text-sm font-medium";

export function PantallaReservas() {
  const hoy = useHoyEnLima();

  // --- Canchas (GET /api/canchas) ---
  const [intentoCanchas, setIntentoCanchas] = useState(0);
  const [estadoCanchas, setEstadoCanchas] = useState<EstadoCanchas | null>(null);
  const cargandoCanchas = estadoCanchas?.intento !== intentoCanchas;

  useEffect(() => {
    const control = new AbortController();
    pedirJson("/api/canchas", { signal: control.signal })
      .then(({ status, cuerpo }) => {
        const canchas = (cuerpo as { canchas?: Cancha[] } | null)?.canchas;
        setEstadoCanchas(
          status === 200 && Array.isArray(canchas)
            ? { intento: intentoCanchas, ok: true, canchas }
            : { intento: intentoCanchas, ok: false },
        );
      })
      .catch((error) => {
        if (!esAborto(error)) setEstadoCanchas({ intento: intentoCanchas, ok: false });
      });
    return () => control.abort();
  }, [intentoCanchas]);

  const canchas = estadoCanchas?.ok ? estadoCanchas.canchas : [];

  // --- Selección ---
  const [canchaElegida, setCanchaElegida] = useState<number | null>(null);
  const [fechaElegida, setFechaElegida] = useState<string | null>(null);
  const [horaElegida, setHoraElegida] = useState<number | null>(null);
  const [clienteId, setClienteId] = useState("");
  const canchaId = canchaElegida ?? canchas[0]?.id ?? null;
  const fecha = fechaElegida ?? hoy;
  const cancha = canchas.find((c) => c.id === canchaId);

  // --- Bloques libres (GET /api/disponibilidad) ---
  const [version, setVersion] = useState(0);
  const [estadoBloques, setEstadoBloques] = useState<EstadoBloques | null>(null);
  const claveBloques = canchaId !== null && fecha !== null ? `${canchaId}|${fecha}|${version}` : null;
  const cargandoBloques = claveBloques !== null && estadoBloques?.clave !== claveBloques;

  useEffect(() => {
    if (claveBloques === null || canchaId === null || fecha === null) return;
    const control = new AbortController();
    const url = `/api/disponibilidad?${new URLSearchParams({ fecha, cancha_id: String(canchaId) })}`;
    pedirJson(url, { signal: control.signal })
      .then(({ status, cuerpo }) => {
        const bloques = (cuerpo as { bloques_libres?: Bloque[] } | null)?.bloques_libres;
        if (status === 200 && Array.isArray(bloques)) {
          setEstadoBloques({ clave: claveBloques, ok: true, bloques });
        } else {
          const mensaje = status >= 500 ? MENSAJE_ERROR_CONEXION : (mensajeDeError(cuerpo) ?? MENSAJE_ERROR_CONEXION);
          setEstadoBloques({ clave: claveBloques, ok: false, mensaje });
        }
      })
      .catch((error) => {
        if (!esAborto(error)) setEstadoBloques({ clave: claveBloques, ok: false, mensaje: MENSAJE_ERROR_CONEXION });
      });
    return () => control.abort();
  }, [claveBloques, canchaId, fecha]);

  const bloques = !cargandoBloques && estadoBloques?.ok ? estadoBloques.bloques : [];
  // Si el bloque elegido ya no está libre (p. ej. tras refrescar), se deselecciona.
  const hora = bloques.some((b) => b.hora_inicio === horaElegida) ? horaElegida : null;

  // --- Reservar (POST /api/reservas) ---
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoReserva | null>(null);
  const puedeReservar = hora !== null && clienteId.trim() !== "" && !enviando;

  function cambiarSeleccion() {
    setHoraElegida(null);
    setResultado(null);
  }

  async function reservar(evento: FormEvent) {
    evento.preventDefault();
    if (!puedeReservar || canchaId === null || fecha === null) return;
    setEnviando(true);
    setResultado(null);
    try {
      const { status, cuerpo } = await pedirJson("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: Number(clienteId), cancha_id: canchaId, fecha, hora_inicio: hora }),
      });
      const r = interpretarRespuestaReserva(status, cuerpo, cancha?.nombre ?? `Cancha ${canchaId}`);
      setResultado(r);
      if (r.tipo === "exito" || r.tipo === "ocupado") {
        setHoraElegida(null);
        setVersion((v) => v + 1); // refresca los bloques libres
      }
    } catch {
      setResultado({ tipo: "error", mensaje: MENSAJE_ERROR_CONEXION });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Reservar cancha</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Bloques de 1 hora, de 10:00 a 23:00 (hora de Lima).
        </p>
      </header>

      {hoy === null || cargandoCanchas ? (
        <p role="status" className="text-zinc-600 dark:text-zinc-400">
          Cargando…
        </p>
      ) : !estadoCanchas?.ok ? (
        <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">
          <p>{MENSAJE_ERROR_CONEXION}</p>
          <button type="button" className={estiloBotonSecundario} onClick={() => setIntentoCanchas((i) => i + 1)}>
            Reintentar
          </button>
        </div>
      ) : (
        <form onSubmit={reservar} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Cancha
              <select
                className={estiloCampo}
                value={canchaId ?? ""}
                onChange={(e) => {
                  setCanchaElegida(Number(e.target.value));
                  cambiarSeleccion();
                }}
              >
                {canchas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Fecha
              <input
                type="date"
                className={estiloCampo}
                min={hoy}
                value={fecha ?? ""}
                onChange={(e) => {
                  // Vacío o pasado → hoy (el navegador no siempre respeta min al escribir).
                  const valor = e.target.value;
                  setFechaElegida(valor && valor >= hoy ? valor : hoy);
                  cambiarSeleccion();
                }}
              />
            </label>
          </div>

          <section aria-labelledby="titulo-bloques" className="flex flex-col gap-2">
            <h2 id="titulo-bloques" className="text-sm font-medium">
              Bloques libres
            </h2>
            {cargandoBloques ? (
              <p role="status" className="text-zinc-600 dark:text-zinc-400">
                Buscando bloques libres…
              </p>
            ) : estadoBloques && !estadoBloques.ok ? (
              <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">
                <p>{estadoBloques.mensaje}</p>
                <button type="button" className={estiloBotonSecundario} onClick={() => setVersion((v) => v + 1)}>
                  Reintentar
                </button>
              </div>
            ) : bloques.length === 0 ? (
              <p className="rounded-lg bg-zinc-100 p-4 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                No hay bloques libres.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {bloques.map((b) => {
                  const elegido = b.hora_inicio === hora;
                  return (
                    <button
                      key={b.hora_inicio}
                      type="button"
                      aria-pressed={elegido}
                      onClick={() => {
                        setHoraElegida(b.hora_inicio);
                        setResultado(null);
                      }}
                      className={
                        "flex min-h-14 flex-col items-center justify-center rounded-lg border px-2 py-2 text-sm " +
                        (elegido
                          ? "border-emerald-700 bg-emerald-700 text-white"
                          : "border-zinc-300 bg-white hover:border-emerald-600 dark:border-zinc-700 dark:bg-zinc-900")
                      }
                    >
                      <span className="font-medium">{formatearBloque(b.hora_inicio)}</span>
                      <span className={elegido ? "text-emerald-50" : "text-zinc-600 dark:text-zinc-400"}>
                        {formatearPrecio(b.precio)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <label className="flex flex-col gap-1 text-sm font-medium">
            ID de cliente
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder="Ej.: 1"
              className={estiloCampo}
              value={clienteId}
              onChange={(e) => {
                setClienteId(e.target.value);
                setResultado(null);
              }}
            />
          </label>

          <button
            type="submit"
            disabled={!puedeReservar}
            className="h-12 rounded-lg bg-emerald-700 text-base font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          >
            {enviando ? "Reservando…" : hora !== null ? `Reservar ${formatearBloque(hora)}` : "Elige un bloque"}
          </button>

          {resultado && <Resultado resultado={resultado} />}
        </form>
      )}
    </main>
  );
}

function Resultado({ resultado }: { resultado: ResultadoReserva }) {
  if (resultado.tipo === "exito") {
    return (
      <p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
        {resultado.mensaje}
      </p>
    );
  }
  if (resultado.tipo === "ocupado") {
    return (
      <p role="alert" className="rounded-lg bg-amber-50 p-4 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
        {resultado.mensaje}
      </p>
    );
  }
  return (
    <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">
      <p>{resultado.mensaje}</p>
      {resultado.tipo === "invalido" && resultado.campos.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {resultado.campos.map((c) => (
            <li key={c.etiqueta}>
              <strong>{c.etiqueta}:</strong> {c.mensaje}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
