"use client";

// "Mis reservas": usa SOLO la API con fetch (AGENTS.md). De lib/ solo importa funciones puras.
import { useEffect, useState, type FormEvent } from "react";
import {
  MENSAJE_ERROR_CONEXION,
  etiquetaEstado,
  formatearBloque,
  formatearFecha,
  formatearPrecio,
  interpretarRespuestaMisReservas,
  type ResultadoMisReservas,
} from "@/lib/reservas/presentacion";

/** Aviso de la pantalla de reservas: se creó una reserva para este cliente (n cambia en cada una). */
export type ReservaCreada = { clienteId: number; n: number } | null;

const estiloCampo =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const COLOR_ESTADO: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  confirmada: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  cancelada: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function MisReservas({ reservaCreada }: { reservaCreada: ReservaCreada }) {
  const [idTexto, setIdTexto] = useState("");
  // Consulta pedida por el usuario: qué ID y cuántas veces (para "Reintentar").
  const [consulta, setConsulta] = useState<{ id: string; intento: number } | null>(null);
  const [respuesta, setRespuesta] = useState<{ clave: string; resultado: ResultadoMisReservas } | null>(null);

  // Si se reservó para el cliente que se está mostrando, la clave cambia y la lista se recarga.
  const refresco = consulta && reservaCreada && String(reservaCreada.clienteId) === consulta.id ? reservaCreada.n : 0;
  const clave = consulta ? `${consulta.id}|${consulta.intento}|${refresco}` : null;
  const cargando = clave !== null && respuesta?.clave !== clave;
  // Mientras recarga se sigue mostrando el último resultado.
  const resultado = respuesta?.resultado ?? null;

  useEffect(() => {
    if (clave === null || consulta === null) return;
    const control = new AbortController();
    fetch(`/api/clientes/${encodeURIComponent(consulta.id)}/reservas`, { cache: "no-store", signal: control.signal })
      .then(async (r) => {
        const cuerpo: unknown = await r.json().catch(() => null);
        setRespuesta({ clave, resultado: interpretarRespuestaMisReservas(r.status, cuerpo) });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRespuesta({ clave, resultado: { tipo: "error", mensaje: MENSAJE_ERROR_CONEXION } });
      });
    return () => control.abort();
  }, [clave, consulta]);

  function verReservas(evento: FormEvent) {
    evento.preventDefault();
    const id = idTexto.trim();
    if (id === "") return;
    setConsulta((c) => ({ id, intento: (c?.intento ?? 0) + 1 }));
  }

  return (
    <section aria-labelledby="titulo-mis-reservas" className="flex flex-col gap-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 id="titulo-mis-reservas" className="text-xl font-semibold">
        Mis reservas
      </h2>

      <form onSubmit={verReservas} className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          ID de cliente
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="Ej.: 1"
            className={estiloCampo}
            value={idTexto}
            onChange={(e) => setIdTexto(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={idTexto.trim() === "" || cargando}
          className="h-12 shrink-0 rounded-lg bg-zinc-900 px-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600 dark:bg-zinc-100 dark:text-zinc-900 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
        >
          {cargando ? "Buscando…" : "Ver mis reservas"}
        </button>
      </form>

      {cargando && resultado === null && (
        <p role="status" className="text-zinc-600 dark:text-zinc-400">
          Buscando tus reservas…
        </p>
      )}
      {resultado && <ResultadoLista resultado={resultado} onReintentar={() => setConsulta((c) => c && { ...c, intento: c.intento + 1 })} />}
    </section>
  );
}

function ResultadoLista({ resultado, onReintentar }: { resultado: ResultadoMisReservas; onReintentar: () => void }) {
  if (resultado.tipo === "no_encontrado") {
    return (
      <p role="alert" className="rounded-lg bg-amber-50 p-4 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
        {resultado.mensaje}
      </p>
    );
  }
  if (resultado.tipo === "invalido") {
    return (
      <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">
        <p>{resultado.mensaje}</p>
        {resultado.campos.length > 0 && (
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
  if (resultado.tipo === "error") {
    return (
      <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">
        <p>{resultado.mensaje}</p>
        <button type="button" onClick={onReintentar} className="mt-2 rounded-lg border border-current px-3 py-1.5 text-sm font-medium">
          Reintentar
        </button>
      </div>
    );
  }

  const { cliente, reservas } = resultado;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Reservas de <strong className="text-zinc-900 dark:text-zinc-100">{cliente.nombre}</strong>
      </p>
      {reservas.length === 0 ? (
        <p className="rounded-lg bg-zinc-100 p-4 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">Aún no tienes reservas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reservas.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex flex-col">
                <span className="font-medium">
                  {formatearFecha(r.fecha)} · {formatearBloque(r.hora_inicio)}
                </span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {r.cancha.nombre} · {formatearPrecio(r.precio)}
                </span>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${COLOR_ESTADO[r.estado] ?? ""}`}>
                {etiquetaEstado(r.estado)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
