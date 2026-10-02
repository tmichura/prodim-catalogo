/**
 * Filtro de catálogo 100% cliente: combina categoría seleccionada + texto
 * de búsqueda para mostrar/ocultar las cards ya renderizadas en el servidor.
 * No hay fetch ni re-render: es solo togglear la clase "hidden".
 *
 * La búsqueda de texto matchea por substring exacto sobre nombre, categoría
 * y "términos de imitación" (ver src/lib/imitaciones.ts, que a nivel de
 * build le agrega a cada card data-terminos-extra con marcas como
 * "ariel"/"skip" cuando el producto es nuestro equivalente), más una capa
 * de tolerancia a errores de tipeo por distancia de edición (ver
 * distanciaEdicion más abajo) sobre las palabras sueltas del nombre.
 */

const cards = Array.from(document.querySelectorAll<HTMLElement>(".product-card"));
const chips = Array.from(document.querySelectorAll<HTMLButtonElement>(".category-chip"));
const searchInput = document.getElementById("search-input") as HTMLInputElement | null;
const emptyMessage = document.getElementById("no-results");
const resultsCount = document.getElementById("results-count");
const sortSelect = document.getElementById("sort-select") as HTMLSelectElement | null;
const grid = document.getElementById("product-grid");
const categoriaActualEl = document.getElementById("categoria-actual");

// Orden original (tal como vino del servidor), para volver a "Relevancia"
const ordenOriginal = [...cards];

// Si llegamos desde la Home con ?categoria=X o ?q=texto, arrancamos ya filtrados
const params = new URLSearchParams(window.location.search);
const categoriaInicial = params.get("categoria") || "todas";
const queryInicial = params.get("q") || "";

let categoriaActiva = categoriaInicial;

if (searchInput && queryInicial) searchInput.value = queryInicial;
chips.forEach((c) => c.classList.toggle("active", (c.dataset.categoria || "todas") === categoriaActiva));

// Si la categoría activa vive dentro de una súper categoría (Sueltos, Envasados...)
// de la barra lateral, abrimos ese grupo del acordeón para que se vea resaltada.
const chipActivo = chips.find((c) => (c.dataset.categoria || "todas") === categoriaActiva);
const panelPadre = chipActivo?.closest(".super-categoria-panel");
if (panelPadre) {
  panelPadre.classList.remove("hidden");
  panelPadre.previousElementSibling?.classList.add("open");
}

function mostrarCategoriaActual(): void {
  if (!categoriaActualEl) return;

  if (categoriaActiva === "todas") {
    categoriaActualEl.textContent = "Tienda";
    return;
  }

  const chip = chips.find((c) => (c.dataset.categoria || "todas") === categoriaActiva);
  categoriaActualEl.textContent = chip?.textContent?.trim() || "Tienda";
}

mostrarCategoriaActual();

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, ""); // saca acentos (marcas diacríticas tras la normalización NFD)
}

// El nombre normalizado y la categoría/código no cambian nunca para una
// card ya renderizada: se calculan una sola vez acá en vez de en cada
// tecla que se tipea, que es lo que hacía lenta la búsqueda con ~650
// productos (normalizar involucra un regex sobre todo el string).
const cardInfos = cards.map((card) => ({
  card,
  categoria: card.dataset.categoria || "",
  codigo: card.dataset.codigo || "",
  nombreNormalizado: normalizar(card.dataset.nombre || ""),
  categoriaNombreNormalizado: normalizar(card.dataset.categoriaNombre || ""),
  terminosExtraNormalizado: normalizar(card.dataset.terminosExtra || ""),
  // Palabras sueltas del nombre, para que el fuzzy compare "contra una
  // palabra" (como cuando alguien tipea mal UNA palabra) y no contra la
  // frase completa, que es lo que generaba falsos positivos (ver abajo).
  palabras: normalizar(card.dataset.nombre || "").split(/\s+/).filter((p) => p.length >= 3),
  // Todas arrancan visibles (así las renderiza el servidor, sin "hidden")
  visible: true,
}));

type CardInfo = (typeof cardInfos)[number];

/**
 * Distancia de edición (Damerau-Levenshtein restringida): cuenta inserciones,
 * borrados, sustituciones y transposiciones de dos letras adyacentes como
 * un solo cambio cada una (esto último cubre el típo más común: "clroo"
 * en vez de "cloro"). Se calcula una sola vez por par palabra/query.
 */
function distanciaEdicion(a: string, b: string): number {
  const fila: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) fila[i][0] = i;
  for (let j = 0; j <= b.length; j++) fila[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      fila[i][j] = Math.min(
        fila[i - 1][j] + 1, // borrado
        fila[i][j - 1] + 1, // inserción
        fila[i - 1][j - 1] + costo // sustitución
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        fila[i][j] = Math.min(fila[i][j], fila[i - 2][j - 2] + 1); // transposición
      }
    }
  }
  return fila[a.length][b.length];
}

/** Cuántos errores de tipeo se toleran según el largo de la palabra
 *  buscada (mismo criterio que usan buscadores tipo Algolia/Elasticsearch:
 *  ninguno para palabras muy cortas, donde cualquier letra de más "pesa"
 *  demasiado y generaría ruido). */
function tolerancia(largo: number): number {
  if (largo <= 4) return 0;
  if (largo <= 7) return 1;
  return 2;
}

function matchFuzzy(query: string, palabra: string): boolean {
  const maxErrores = tolerancia(query.length);
  if (maxErrores === 0) return false;
  // Corte rápido: si la diferencia de largo ya supera lo tolerado, ni
  // vale la pena calcular la distancia completa.
  if (Math.abs(query.length - palabra.length) > maxErrores) return false;
  return distanciaEdicion(query, palabra) <= maxErrores;
}

function buscarCoincidencias(query: string): Set<CardInfo> {
  const coincidencias = new Set<CardInfo>();

  for (const info of cardInfos) {
    // Match exacto por substring: nombre, categoría, término de imitación
    // (ver src/lib/imitaciones.ts) o código de producto. Es el caso de uso
    // principal — preciso, sin sorpresas.
    const matchExacto =
      info.nombreNormalizado.includes(query) ||
      info.categoriaNombreNormalizado.includes(query) ||
      info.terminosExtraNormalizado.includes(query) ||
      info.codigo.includes(query);

    // Tolerancia a errores de tipeo: compara la query contra cada palabra
    // suelta del nombre (no la frase completa, para no generar falsos
    // positivos por coincidencias sueltas de letras entre palabras).
    const matchFuzzyEnNombre = !matchExacto && info.palabras.some((palabra) => matchFuzzy(query, palabra));

    if (matchExacto || matchFuzzyEnNombre) coincidencias.add(info);
  }

  return coincidencias;
}

function aplicarFiltros(): void {
  const query = normalizar(searchInput?.value.trim() || "");
  const buscando = query !== "";
  let visibles = 0;

  const coincidenBusqueda = buscando ? buscarCoincidencias(query) : null;

  for (const info of cardInfos) {
    // Al buscar, se busca en TODO el catálogo sin importar la categoría
    // elegida en la barra lateral (no tiene sentido limitar la búsqueda
    // a la categoría en la que el usuario está parado).
    const coincideCategoria = buscando || categoriaActiva === "todas" || info.categoria === categoriaActiva;
    const coincideBusqueda = !coincidenBusqueda || coincidenBusqueda.has(info);

    const visible = coincideCategoria && coincideBusqueda;
    // Tocar el DOM (classList) es lo caro acá: fuerza que el navegador
    // recalcule el layout de la grilla. Solo lo hacemos si el estado de
    // la card realmente cambió, en vez de re-togglear las ~650 cada vez.
    if (info.visible !== visible) {
      info.card.classList.toggle("hidden", !visible);
      info.visible = visible;
    }
    if (visible) visibles += 1;
  }

  emptyMessage?.classList.toggle("hidden", visibles !== 0);
  if (resultsCount) resultsCount.textContent = String(visibles);
}

/** Espera una pausa breve en el tipeo antes de filtrar, para no recalcular
 *  y repintar la grilla en cada tecla mientras se está escribiendo. */
function debounce<T extends (...args: never[]) => void>(fn: T, esperaMs: number): T {
  let timeoutId: number | undefined;
  return ((...args: Parameters<T>) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), esperaMs);
  }) as T;
}

const aplicarFiltrosDebounced = debounce(aplicarFiltros, 120);

function aplicarOrden(): void {
  if (!grid) return;

  const orden = sortSelect?.value || "relevancia";
  let ordenadas: HTMLElement[];

  if (orden === "relevancia") {
    ordenadas = ordenOriginal;
  } else {
    ordenadas = [...cards].sort((a, b) => {
      if (orden === "precio-asc" || orden === "precio-desc") {
        const precioA = parseFloat(a.dataset.precio || "0");
        const precioB = parseFloat(b.dataset.precio || "0");
        return orden === "precio-asc" ? precioA - precioB : precioB - precioA;
      }
      // nombre-asc / nombre-desc
      const nombreA = a.dataset.nombre || "";
      const nombreB = b.dataset.nombre || "";
      return orden === "nombre-asc" ? nombreA.localeCompare(nombreB) : nombreB.localeCompare(nombreA);
    });
  }

  for (const card of ordenadas) grid.appendChild(card);
}

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    categoriaActiva = chip.dataset.categoria || "todas";
    chips.forEach((c) => c.classList.toggle("active", c === chip));
    mostrarCategoriaActual();
    aplicarFiltros();
    // Al cambiar de categoría, llevamos el scroll al inicio de la grilla
    document.getElementById("product-grid")?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
});

searchInput?.addEventListener("input", aplicarFiltrosDebounced);
sortSelect?.addEventListener("change", aplicarOrden);

aplicarFiltros();

// ---------- Acordeón de súper categorías en la barra lateral ----------

Array.from(document.querySelectorAll<HTMLButtonElement>(".super-categoria-toggle")).forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const panel = toggle.nextElementSibling as HTMLElement | null;
    const abierto = toggle.classList.toggle("open");
    panel?.classList.toggle("hidden", !abierto);
    toggle.setAttribute("aria-expanded", String(abierto));
  });
});
