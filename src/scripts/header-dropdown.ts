// Dropdown de categorías del header + navegación desde la Home hacia /productos
const btn = document.getElementById("category-dropdown-btn");
const dropdown = document.getElementById("category-dropdown");
const searchInput = document.getElementById("search-input") as HTMLInputElement | null;

// Si no existe la grilla de productos, estamos en la Home: categoría/búsqueda
// deben redirigir a /productos en vez de filtrar in-place.
const enPaginaCatalogo = !!document.getElementById("product-grid");

if (btn && dropdown) {
  btn.addEventListener("click", () => {
    dropdown.classList.toggle("hidden");
    btn.setAttribute("aria-expanded", dropdown.classList.contains("hidden") ? "false" : "true");
  });

  dropdown.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const chip = target.closest<HTMLButtonElement>(".category-chip");
    if (!chip) return;

    dropdown.classList.add("hidden");
    btn.setAttribute("aria-expanded", "false");

    if (!enPaginaCatalogo) {
      const categoria = chip.dataset.categoria || "todas";
      const destino = categoria === "todas" ? "/productos" : `/productos?categoria=${categoria}`;
      window.location.href = destino;
    }
    // Si ya estamos en /productos, catalog-filter.ts se encarga de filtrar.
  });

  document.addEventListener("click", (e) => {
    if (!btn.contains(e.target as Node) && !dropdown.contains(e.target as Node)) {
      dropdown.classList.add("hidden");
      btn.setAttribute("aria-expanded", "false");
    }
  });

  // Acordeón de súper categorías (Sueltos, Envasados, etc.)
  const toggles = Array.from(dropdown.querySelectorAll<HTMLButtonElement>(".super-categoria-toggle"));
  toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const panel = toggle.nextElementSibling as HTMLElement | null;
      const abierto = toggle.classList.toggle("open");
      panel?.classList.toggle("hidden", !abierto);
      toggle.setAttribute("aria-expanded", String(abierto));
    });
  });
}

if (!enPaginaCatalogo && searchInput) {
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const query = searchInput.value.trim();
      window.location.href = query ? `/productos?q=${encodeURIComponent(query)}` : "/productos";
    }
  });
}
