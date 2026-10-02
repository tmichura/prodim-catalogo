/**
 * Mapea nombres de marcas reconocidas ("ariel", "skip", ...) a los
 * productos de Prodim que son su equivalente/imitación, para que al
 * buscar la marca original en el buscador también aparezcan los
 * nuestros aunque el nombre no la mencione.
 *
 * Cada regla usa un regex sobre el nombre del producto (en mayúsculas,
 * tal como viene del CSV) y, cuando hace falta, restringe por
 * categoría para evitar falsos positivos de palabras genéricas
 * (ej. "PREMIUM" también aparece en desodorantes y cortinas de baño
 * que no tienen nada que ver con Ariel).
 */
interface ReglaImitacion {
  /** Marca original que la gente busca (en minúsculas, sin acentos) */
  original: string;
  /** Coincide con el nombre del producto tal como viene del CSV (mayúsculas) */
  match: RegExp;
  /** Si está presente, la regla solo aplica dentro de estas categorías exactas */
  categorias?: string[];
}

const REGLAS: ReglaImitacion[] = [
  { original: "ariel", match: /ARY\s*ULTRA/i },
  { original: "ariel", match: /HIDROGEL/i },
  { original: "ariel", match: /PREMIUM/i, categorias: ["JABONES ENVASADOS", "JABONES LIQUIDOS SUELTOS"] },
  { original: "skip", match: /ESQUIPY/i },
  { original: "skip", match: /VIOLETA PLUS/i },
  { original: "querubin", match: /KERU/i },
  { original: "downy", match: /DAUNIE/i },
  // Negative lookahead: excluye "MAGICA"/"MAGICO" (adjetivo genérico),
  // solo matchea "MAGIC" como palabra/segmento suelto.
  { original: "magistral", match: /MAGIC(?![A-Za-z])/i },
  { original: "procenex", match: /PROCE/i },
  { original: "odex", match: /PROCE/i },
  // Mismo criterio que MAGIC: excluye "AROMATICO"/"AUTOMATICO".
  { original: "ala", match: /MATIC(?![A-Za-z])/i },
];

/** Devuelve las marcas originales que este producto imita, si alguna. */
export function terminosImitacion(nombre: string, categoria: string): string[] {
  const encontrados = new Set<string>();
  for (const regla of REGLAS) {
    if (!regla.match.test(nombre)) continue;
    if (regla.categorias && !regla.categorias.includes(categoria)) continue;
    encontrados.add(regla.original);
  }
  return [...encontrados];
}
