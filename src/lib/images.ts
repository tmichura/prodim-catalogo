import { existsSync } from "fs";
import { join } from "path";

const EXTENSIONES_SOPORTADAS = ["jpg", "jpeg", "png", "webp"];

/**
 * Busca la imagen de un producto en public/images/productos/ probando
 * varias extensiones (el sistema de facturación no las estandariza).
 * Devuelve la ruta pública (para usar en <img src>) o null si no hay imagen.
 */
export function resolverImagenProducto(codigo: number): string | null {
  for (const ext of EXTENSIONES_SOPORTADAS) {
    const rutaDisco = join(process.cwd(), "public", "images", "productos", `${codigo}.${ext}`);
    if (existsSync(rutaDisco)) {
      return `/images/productos/${codigo}.${ext}`;
    }
  }
  return null;
}
