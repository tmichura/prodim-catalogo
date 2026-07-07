import productosRaw from "../data/productos.json";
import superCategoriasRaw from "../data/super-categorias.json";
import { parseEscala, type EscalaPrecio } from "./pricing";

export interface ProductoRaw {
  codigo: number;
  nombre: string;
  categoria: string;
  precio1: string;
  precio2: string;
  precio3: string;
}

// El sistema de facturación a veces exporta las claves en MAYÚSCULAS
// (CODIGO, NOMBRE, CATEGORIA...) y a veces en minúsculas. Normalizamos
// acá para que un cambio de formato en el export no rompa el build.
function normalizarRaw(raw: Record<string, unknown>): ProductoRaw {
  const lower: Record<string, unknown> = {};
  for (const key in raw) {
    lower[key.toLowerCase()] = raw[key];
  }
  return {
    codigo: Number(lower.codigo),
    nombre: String(lower.nombre ?? ""),
    categoria: String(lower.categoria ?? "SIN CATEGORIA"),
    precio1: String(lower.precio1 ?? ""),
    precio2: String(lower.precio2 ?? ""),
    precio3: String(lower.precio3 ?? ""),
  };
}

export interface Producto {
  codigo: number;
  nombre: string;
  categoria: string;
  /** slug de la categoría, usado como filtro y para data-attributes */
  categoriaSlug: string;
  /** Escalas de precio ya parseadas y filtradas (solo las que existen) */
  escalas: EscalaPrecio[];
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // saca acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildProducto(rawInput: Record<string, unknown>): Producto {
  const raw = normalizarRaw(rawInput);
  const escalas = [raw.precio1, raw.precio2, raw.precio3]
    .map(parseEscala)
    .filter((e): e is EscalaPrecio => e !== null);

  return {
    codigo: raw.codigo,
    nombre: raw.nombre,
    categoria: raw.categoria,
    categoriaSlug: slugify(raw.categoria),
    escalas,
  };
}

export function getProductos(): Producto[] {
  return (productosRaw as Record<string, unknown>[]).map(buildProducto);
}

export interface Categoria {
  nombre: string;
  slug: string;
  /** Número de orden extraído del prefijo "02* ..." si existe, si no, al final */
  orden: number;
  cantidad: number;
}

export function getCategorias(productos: Producto[]): Categoria[] {
  const mapa = new Map<string, Categoria>();

  for (const p of productos) {
    const existente = mapa.get(p.categoriaSlug);
    if (existente) {
      existente.cantidad += 1;
      continue;
    }
    const match = p.categoria.match(/^(\d+)\*/);
    mapa.set(p.categoriaSlug, {
      nombre: p.categoria.replace(/^\d+\*\s*/, ""),
      slug: p.categoriaSlug,
      orden: match ? parseInt(match[1], 10) : 999,
      cantidad: 1,
    });
  }

  return [...mapa.values()].sort((a, b) => a.orden - b.orden);
}

export interface SuperCategoria {
  nombre: string;
  categorias: Categoria[];
}

interface SuperCategoriaRaw {
  nombre: string;
  categorias: string[];
}

/**
 * Agrupa las categorías reales en "súper categorías" (ej. Sueltos, Envasados)
 * según src/data/super-categorias.json. Las categorías que no estén
 * clasificadas ahí caen en un grupo "Otras categorías" al final, para que
 * nunca desaparezcan del dropdown aunque el mapeo quede desactualizado.
 */
export function getSuperCategorias(categorias: Categoria[]): SuperCategoria[] {
  const definiciones = superCategoriasRaw as SuperCategoriaRaw[];
  const usadas = new Set<string>();
  const porSlug = new Map(categorias.map((c) => [c.slug, c]));

  const grupos: SuperCategoria[] = definiciones.map((def) => {
    const resueltas = def.categorias
      .map((slug) => porSlug.get(slug))
      .filter((c): c is Categoria => {
        if (!c) return false;
        usadas.add(c.slug);
        return true;
      })
      .sort((a, b) => a.orden - b.orden);

    return { nombre: def.nombre, categorias: resueltas };
  });

  const sinClasificar = categorias
    .filter((c) => !usadas.has(c.slug))
    .sort((a, b) => a.orden - b.orden);

  if (sinClasificar.length > 0) {
    grupos.push({ nombre: "OTRAS CATEGORÍAS", categorias: sinClasificar });
  }

  return grupos.filter((g) => g.categorias.length > 0);
}
