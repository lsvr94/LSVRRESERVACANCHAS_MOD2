// Textos y formatos de la pantalla de reservas. Puro: no accede a datos.

export const MENSAJE_OCUPADO = "Ese bloque acaba de ser reservado, elige otro.";
export const MENSAJE_ERROR_CONEXION = "No pudimos conectar con el servidor. Intenta de nuevo.";

const precio = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

export function formatearPrecio(monto: number): string {
  return precio.format(monto);
}

export function formatearBloque(horaInicio: number): string {
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return `${hh(horaInicio)}–${hh(horaInicio + 1)}`;
}

/** "2026-11-25" → "25/11/2026". */
export function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

const ETIQUETAS: Record<string, string> = {
  cliente_id: "ID de cliente",
  cancha_id: "Cancha",
  fecha: "Fecha",
  hora_inicio: "Hora",
  cuerpo: "Datos",
};

export type ResultadoReserva =
  | { tipo: "exito"; mensaje: string }
  | { tipo: "ocupado"; mensaje: string }
  | { tipo: "invalido"; mensaje: string; campos: { etiqueta: string; mensaje: string }[] }
  | { tipo: "error"; mensaje: string };

type CuerpoError = { error: { mensaje: string; campos?: Record<string, string> } };
type CuerpoReserva = { id: number; fecha: string; hora_inicio: number; precio: number; estado: string };

function esObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function esCuerpoError(x: unknown): x is CuerpoError {
  return esObjeto(x) && esObjeto(x.error) && typeof x.error.mensaje === "string";
}

function esCuerpoReserva(x: unknown): x is CuerpoReserva {
  return (
    esObjeto(x) &&
    typeof x.id === "number" &&
    typeof x.fecha === "string" &&
    typeof x.hora_inicio === "number" &&
    typeof x.precio === "number" &&
    typeof x.estado === "string"
  );
}

/** Traduce la respuesta de POST /api/reservas a lo que la pantalla debe mostrar. */
export function interpretarRespuestaReserva(
  status: number,
  cuerpo: unknown,
  nombreCancha: string,
): ResultadoReserva {
  if (status === 201 && esCuerpoReserva(cuerpo)) {
    return {
      tipo: "exito",
      mensaje:
        `Reserva #${cuerpo.id} creada: ${nombreCancha}, ${formatearFecha(cuerpo.fecha)}, ` +
        `${formatearBloque(cuerpo.hora_inicio)}, ${formatearPrecio(cuerpo.precio)} (${cuerpo.estado}).`,
    };
  }
  if (status === 409) return { tipo: "ocupado", mensaje: MENSAJE_OCUPADO };
  if (status === 422 && esCuerpoError(cuerpo)) {
    const campos = Object.entries(cuerpo.error.campos ?? {}).map(([campo, mensaje]) => ({
      etiqueta: ETIQUETAS[campo] ?? campo,
      mensaje,
    }));
    return { tipo: "invalido", mensaje: cuerpo.error.mensaje, campos };
  }
  return { tipo: "error", mensaje: MENSAJE_ERROR_CONEXION };
}

const NOMBRES_ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
};

export function etiquetaEstado(estado: string): string {
  return NOMBRES_ESTADO[estado] ?? estado;
}

/** Una reserva tal como la devuelve GET /api/clientes/[id]/reservas. */
export type ReservaDeCliente = {
  id: number;
  fecha: string;
  hora_inicio: number;
  hora_fin: number;
  cancha: { id: number; nombre: string };
  precio: number;
  moneda: string;
  estado: string;
  creada_en: string;
};

export type ResultadoMisReservas =
  | { tipo: "ok"; cliente: { id: number; nombre: string }; reservas: ReservaDeCliente[] }
  | { tipo: "no_encontrado"; mensaje: string }
  | { tipo: "invalido"; mensaje: string; campos: { etiqueta: string; mensaje: string }[] }
  | { tipo: "error"; mensaje: string };

function esCuerpoMisReservas(x: unknown): x is { cliente: { id: number; nombre: string }; reservas: ReservaDeCliente[] } {
  return (
    esObjeto(x) &&
    esObjeto(x.cliente) &&
    typeof x.cliente.id === "number" &&
    typeof x.cliente.nombre === "string" &&
    Array.isArray(x.reservas)
  );
}

/** Traduce la respuesta de GET /api/clientes/[id]/reservas a lo que muestra "Mis reservas". */
export function interpretarRespuestaMisReservas(status: number, cuerpo: unknown): ResultadoMisReservas {
  if (status === 200 && esCuerpoMisReservas(cuerpo)) {
    return { tipo: "ok", cliente: cuerpo.cliente, reservas: cuerpo.reservas };
  }
  if (status === 404) return { tipo: "no_encontrado", mensaje: "No existe un cliente con ese ID." };
  if (status === 422 && esCuerpoError(cuerpo)) {
    const campos = Object.entries(cuerpo.error.campos ?? {}).map(([campo, mensaje]) => ({
      // En esta consulta, el [id] de la URL es el ID de cliente.
      etiqueta: campo === "id" ? "ID de cliente" : (ETIQUETAS[campo] ?? campo),
      mensaje,
    }));
    return { tipo: "invalido", mensaje: cuerpo.error.mensaje, campos };
  }
  return { tipo: "error", mensaje: MENSAJE_ERROR_CONEXION };
}
