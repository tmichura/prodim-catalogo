/**
 * Filtro de catálogo 100% cliente: combina categoría seleccionada + texto
 * de búsqueda para mostrar/ocultar las cards ya renderizadas en el servidor.
 * No hay fetch ni re-render: es solo togglear la clase "hidden".
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
  // Todas arrancan visibles (así las renderiza el servidor, sin "hidden")
  visible: true,
}));

function aplicarFiltros(): void {
  const query = normalizar(searchInput?.value.trim() || "");
  const buscando = query !== "";
  let visibles = 0;

  for (const info of cardInfos) {
    // Al buscar, se busca en TODO el catálogo sin importar la categoría
    // elegida en la barra lateral (no tiene sentido limitar la búsqueda
    // a la categoría en la que el usuario está parado).
    const coincideCategoria = buscando || categoriaActiva === "todas" || info.categoria === categoriaActiva;
    const coincideBusqueda = query === "" || info.nombreNormalizado.includes(query) || info.codigo.includes(query);

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
