/**
 * Filtro de catálogo 100% cliente: combina categoría (o grupo de
 * categorías) + texto de búsqueda para mostrar/ocultar las cards ya
 * renderizadas en el servidor, y pagina el resultado ("Ver más") para no
 * pintar ni descargar las fotos de los ~650 productos de una.
 *
 * La búsqueda de texto matchea por substring exacto sobre nombre, categoría
 * y "términos de imitación" (ver src/lib/imitaciones.ts, que a nivel de
 * build le agrega a cada card data-terminos-extra con marcas como
 * "ariel"/"skip" cuando el producto es nuestro equivalente), más una capa
 * de tolerancia a errores de tipeo por distancia de edición (ver
 * distanciaEdicion más abajo) sobre las palabras sueltas del nombre.
 */

const PAGINA = 24;

const chips = Array.from(document.querySelectorAll<HTMLButtonElement>(".category-chip"));
const searchInput = document.getElementById("search-input") as HTMLInputElement | null;
const emptyMessage = document.getElementById("no-results");
const resultsCount = document.getElementById("results-count");
const resultsTotal = document.getElementById("results-total");
const sortSelect = document.getElementById("sort-select") as HTMLSelectElement | null;
const grid = document.getElementById("product-grid");
const categoriaActualEl = document.getElementById("categoria-actual");
const resultadosInicio = document.getElementById("resultados-inicio");
const chipsMobile = document.getElementById("chips-mobile");
const loadMoreWrap = document.getElementById("load-more-wrap");
const loadMoreBtn = document.getElementById("load-more");
const panelesSubgrupo = Array.from(document.querySelectorAll<HTMLElement>(".chips-subgrupo"));

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, ""); // saca acentos (marcas diacríticas tras la normalización NFD)
}

// Datos fijos de cada card, calculados una sola vez (no en cada tecla).
const cardInfos = Array.from(document.querySelectorAll<HTMLElement>(".product-card")).map((card) => ({
  card,
  categoria: card.dataset.categoria || "",
  codigo: card.dataset.codigo || "",
  precio: parseFloat(card.dataset.precio || "0"),
  nombre: card.dataset.nombre || "",
  nombreNormalizado: normalizar(card.dataset.nombre || ""),
  categoriaNombreNormalizado: normalizar(card.dataset.categoriaNombre || ""),
  terminosExtraNormalizado: normalizar(card.dataset.terminosExtra || ""),
  // Palabras sueltas del nombre, para que la tolerancia a tipeos compare
  // contra una palabra y no contra la frase completa (ver matchFuzzy).
  palabras: normalizar(card.dataset.nombre || "").split(/\s+/).filter((p) => p.length >= 3),
  // Todas arrancan visibles (así las renderiza el servidor, sin "hidden")
  visible: true,
}));

type CardInfo = (typeof cardInfos)[number];

const ordenOriginal = [...cardInfos];
let ordenActual = [...cardInfos];

// ---------- Acordeón lateral: un solo grupo abierto a la vez ----------

const sidebarToggles = Array.from(document.querySelectorAll<HTMLElement>("aside .super-categoria-toggle"));

function cerrarGrupo(toggle: HTMLElement): void {
  toggle.classList.remove("open");
  toggle.setAttribute("aria-expanded", "false");
  toggle.nextElementSibling?.classList.add("hidden");
}

function abrirSoloGrupo(toggle: HTMLElement): void {
  sidebarToggles.forEach((t) => { if (t !== toggle) cerrarGrupo(t); });
  toggle.classList.add("open");
  toggle.setAttribute("aria-expanded", "true");
  toggle.nextElementSibling?.classList.remove("hidden");
}

// ---------- Estado del filtro ----------

/** Clave del filtro activo: "todas", "cat:<slug>" o "grupo:<slug>" */
let claveActiva = "todas";
/** Slugs de categoría que pasan el filtro (null = todas) */
let categoriasActivas: Set<string> | null = null;
let limite = PAGINA;

function claveDeChip(chip: HTMLElement): string {
  if (chip.dataset.categorias) return `grupo:${chip.dataset.grupo}`;
  const cat = chip.dataset.categoria || "todas";
  return cat === "todas" ? "todas" : `cat:${cat}`;
}

function activarChip(chip: HTMLElement | undefined): void {
  claveActiva = chip ? claveDeChip(chip) : "todas";
  if (!chip || claveActiva === "todas") {
    categoriasActivas = null;
  } else if (chip.dataset.categorias) {
    categoriasActivas = new Set(chip.dataset.categorias.split(","));
  } else {
    categoriasActivas = new Set([chip.dataset.categoria || ""]);
  }

  // Marca como activos todos los chips equivalentes (sidebar desktop,
  // chips mobile y dropdown del header comparten el mismo filtro).
  chips.forEach((c) => c.classList.toggle("active", claveDeChip(c) === claveActiva));

  // En mobile/tablet, muestra la fila de sub-categorías del grupo elegido.
  // (el chip del dropdown del header no trae data-grupo: se toma de su equivalente)
  const grupo =
    chip?.dataset.grupo || chips.find((c) => claveDeChip(c) === claveActiva && c.dataset.grupo)?.dataset.grupo;
  panelesSubgrupo.forEach((p) => p.classList.toggle("abierto", !!grupo && p.dataset.grupoPanel === grupo));

  // En desktop, abre el grupo del acordeón lateral que contiene la
  // selección (y cierra los demás). Se busca solo en la barra lateral:
  // el dropdown del header tiene los mismos chips y aparece antes en la página.
  const toggleDelActivo = chips
    .find((c) => claveDeChip(c) === claveActiva && c.closest("aside .super-categoria-panel"))
    ?.closest(".super-categoria-panel")?.previousElementSibling as HTMLElement | null | undefined;
  if (toggleDelActivo) abrirSoloGrupo(toggleDelActivo);

  if (categoriaActualEl) {
    categoriaActualEl.textContent =
      claveActiva === "todas" ? "Tienda" : chip?.dataset.titulo || chip?.textContent?.trim() || "Tienda";
  }
}

// ---------- Búsqueda con tolerancia a errores de tipeo ----------

/**
 * Distancia de edición (Damerau-Levenshtein restringida): cuenta inserciones,
 * borrados, sustituciones y transposiciones de dos letras adyacentes como
 * un solo cambio cada una (esto último cubre el tipeo más común: "clroo"
 * en vez de "cloro").
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

/** Errores de tipeo tolerados según el largo de la palabra buscada
 *  (ninguno para palabras muy cortas, donde generaría ruido). */
function tolerancia(largo: number): number {
  if (largo <= 4) return 0;
  if (largo <= 7) return 1;
  return 2;
}

function matchFuzzy(query: string, palabra: string): boolean {
  const maxErrores = tolerancia(query.length);
  if (maxErrores === 0) return false;
  if (Math.abs(query.length - palabra.length) > maxErrores) return false;
  return distanciaEdicion(query, palabra) <= maxErrores;
}

function coincideBusqueda(info: CardInfo, query: string): boolean {
  if (
    info.nombreNormalizado.includes(query) ||
    info.categoriaNombreNormalizado.includes(query) ||
    info.terminosExtraNormalizado.includes(query) ||
    info.codigo.includes(query)
  ) {
    return true;
  }
  return info.palabras.some((palabra) => matchFuzzy(query, palabra));
}

// ---------- Aplicar filtros + paginación ----------

function aplicarFiltros(): void {
  const query = normalizar(searchInput?.value.trim() || "");
  const buscando = query !== "";
  let coincidencias = 0;
  let mostradas = 0;

  for (const info of ordenActual) {
    // Búsqueda y categoría nunca quedan activas a la vez: tipear vuelve la
    // categoría a "Todos" y elegir una categoría vacía el buscador (ver Eventos).
    const pasaCategoria = !categoriasActivas || categoriasActivas.has(info.categoria);
    const pasa = pasaCategoria && (!buscando || coincideBusqueda(info, query));

    let visible = false;
    if (pasa) {
      coincidencias += 1;
      visible = coincidencias <= limite;
    }

    // Tocar el DOM es lo caro: solo si el estado de la card cambió.
    if (info.visible !== visible) {
      info.card.classList.toggle("hidden", !visible);
      info.visible = visible;
    }
    if (visible) mostradas += 1;
  }

  emptyMessage?.classList.toggle("hidden", coincidencias !== 0);
  if (resultsCount) resultsCount.textContent = String(mostradas);
  if (resultsTotal) resultsTotal.textContent = String(coincidencias);

  const quedan = coincidencias - mostradas;
  loadMoreWrap?.classList.toggle("hidden", quedan <= 0);
  if (loadMoreBtn) loadMoreBtn.textContent = `Ver más productos (${quedan})`;
}

function reiniciarYFiltrar(): void {
  limite = PAGINA;
  aplicarFiltros();
}

/** Espera una pausa breve en el tipeo antes de filtrar. */
function debounce<T extends (...args: never[]) => void>(fn: T, esperaMs: number): T {
  let timeoutId: number | undefined;
  return ((...args: Parameters<T>) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), esperaMs);
  }) as T;
}

function aplicarOrden(): void {
  if (!grid) return;
  const orden = sortSelect?.value || "relevancia";

  if (orden === "relevancia") {
    ordenActual = [...ordenOriginal];
  } else {
    ordenActual = [...cardInfos].sort((a, b) => {
      if (orden === "precio-asc") return a.precio - b.precio;
      if (orden === "precio-desc") return b.precio - a.precio;
      return orden === "nombre-asc" ? a.nombre.localeCompare(b.nombre) : b.nombre.localeCompare(a.nombre);
    });
  }

  for (const info of ordenActual) grid.appendChild(info.card);
  reiniciarYFiltrar();
}

// ---------- Eventos ----------

const searchClearBtn = document.getElementById("search-clear");

/** Elegir una categoría es empezar a navegar de nuevo: se vacía el buscador. */
function vaciarBuscador(): void {
  if (!searchInput || searchInput.value === "") return;
  searchInput.value = "";
  searchClearBtn?.classList.add("hidden");
}

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    vaciarBuscador();
    activarChip(chip);
    reiniciarYFiltrar();
    // Lleva el scroll al inicio de los resultados (html tiene
    // scroll-padding-top con la altura del header + barra fija). En mobile
    // frena en los chips, así queda a la vista la fila de sub-categorías.
    const destino = chipsMobile && chipsMobile.offsetParent !== null ? chipsMobile : resultadosInicio;
    destino?.scrollIntoView({ block: "start", behavior: "smooth" });
    // En mobile, deja visible el chip elegido dentro de su fila
    chip.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  });
});

// Escribir en el buscador busca en todo el catálogo: la categoría vuelve a
// "Todos" en el momento (sin esperar el debounce, así se ve enseguida).
searchInput?.addEventListener("input", () => {
  const texto = searchInput.value.trim();
  if (texto && claveActiva !== "todas") activarChip(undefined);
  if (categoriaActualEl && claveActiva === "todas") {
    categoriaActualEl.textContent = texto ? `Resultados para "${texto}"` : "Tienda";
  }
});
searchInput?.addEventListener("input", debounce(reiniciarYFiltrar, 120));
sortSelect?.addEventListener("change", aplicarOrden);

function verMas(): void {
  limite += PAGINA;
  aplicarFiltros();
}
loadMoreBtn?.addEventListener("click", verMas);

// Carga automática al acercarse al final (el botón queda como respaldo)
if (loadMoreWrap && "IntersectionObserver" in window) {
  new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting) && !loadMoreWrap.classList.contains("hidden")) verMas();
    },
    { rootMargin: "600px 0px" }
  ).observe(loadMoreWrap);
}

// ---------- Estado inicial (desde la URL) ----------

// ?categoria=<slug>, ?grupo=<slug> (desde la Home) o ?q=texto
const params = new URLSearchParams(window.location.search);
const grupoInicial = params.get("grupo");
const categoriaInicial = params.get("categoria");
const queryInicial = params.get("q") || "";

if (searchInput && queryInicial) searchInput.value = queryInicial;

const chipInicial = grupoInicial
  ? chips.find((c) => c.dataset.categorias && c.dataset.grupo === grupoInicial)
  : categoriaInicial
    ? chips.find((c) => c.dataset.categoria === categoriaInicial)
    : undefined;
activarChip(chipInicial);
if (queryInicial && !chipInicial && categoriaActualEl) {
  categoriaActualEl.textContent = `Resultados para "${queryInicial}"`;
}
aplicarFiltros();

// ---------- Acordeón de súper categorías en la barra lateral ----------
// (solo los de la barra lateral: los del dropdown del header los maneja
// header-dropdown.ts; si se enganchan acá también, cada clic los abre y
// los vuelve a cerrar)

sidebarToggles.forEach((toggle) => {
  toggle.addEventListener("click", () => {
    if (toggle.classList.contains("open")) cerrarGrupo(toggle);
    else abrirSoloGrupo(toggle);
  });
});
