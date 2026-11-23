/** Error de la API antes de convertirlo en respuesta HTTP. */
export type ErrorApi = {
  status: 404 | 409 | 422 | 500;
  codigo: string;
  mensaje: string;
  /** Solo en errores de validación: campo → mensaje. */
  campos?: Record<string, string>;
};

/** Formato único del cuerpo de error: { error: { codigo, mensaje, campos? } }. */
export function cuerpoDeError(e: ErrorApi) {
  const { codigo, mensaje, campos } = e;
  return { error: campos ? { codigo, mensaje, campos } : { codigo, mensaje } };
}
