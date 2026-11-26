const DIGITOS_VISIBLES = 3;

/**
 * Oculta el teléfono salvo sus 3 últimos dígitos (riesgo 2 de docs/arquitectura.md).
 * Solo se reemplazan dígitos; "+", espacios y guiones se conservan.
 */
export function enmascararTelefono(telefono: string): string {
  const totalDigitos = telefono.replace(/\D/g, "").length;
  let digitosVistos = 0;
  return telefono.replace(/\d/g, (digito) => {
    digitosVistos++;
    return digitosVistos > totalDigitos - DIGITOS_VISIBLES ? digito : "*";
  });
}
