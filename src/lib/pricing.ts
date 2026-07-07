/**
 * Parsing de los strings de precio provistos por Prodim.
 * Formato esperado: "<escala><UNIDAD> x $<precio> c/<unidad>"
 * Ejemplos reales:
 *   "LT x $990 c/lt"      -> escala mínima (1 unidad/litro/kg)
 *   "20LT x $891 c/lt"    -> escala intermedia
 *   "60LT x $743 c/lt"    -> escala mayorista
 *   "U x $14164 c/u"      -> producto envasado por unidad
 *   ""                    -> esa escala no existe para el producto
 */

export interface EscalaPrecio {
  /** Texto original, se muestra tal cual en la card ("20LT x $891 c/lt") */
  raw: string;
  /** Cantidad mínima de la escala (1 si el string no trae número, ej. "LT", "U") */
  cantidadMinima: number;
  /** Unidad de venta (lt, kg, u) en minúsculas */
  unidad: string;
  /** Precio unitario numérico, para poder calcular subtotales */
  precioUnitario: number;
  /** Etiqueta corta para mostrar en selectores ("LT", "20LT", "60LT") */
  etiqueta: string;
}

const PRICE_REGEX = /^(\d*)\s*([A-Za-zÁÉÍÓÚáéíóúÑñ]+)\s*x\s*\$([\d.,]+)\s*c\/([\w.]+)$/i;

export function parseEscala(raw: string): EscalaPrecio | null {
  const value = raw?.trim();
  if (!value) return null;

  const match = value.match(PRICE_REGEX);
  if (!match) return null;

  const [, cantidadStr, unidadEtiqueta, precioStr, unidadPrecio] = match;
  const cantidadMinima = cantidadStr ? parseInt(cantidadStr, 10) : 1;
  const precioUnitario = parseFloat(precioStr.replace(/\./g, "").replace(",", "."));

  return {
    raw: value,
    cantidadMinima,
    unidad: unidadPrecio.toLowerCase(),
    precioUnitario,
    etiqueta: `${cantidadStr || "1"}${unidadEtiqueta.toUpperCase()}`,
  };
}

export function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}
