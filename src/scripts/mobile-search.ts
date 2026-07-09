// Buscador expandible en mobile: el ícono de lupa estira el buscador dentro
// de la topbar con una animación simple (comparte #search-input con
// catalog-filter.ts, no hay lógica de filtrado duplicada acá).
const toggleBtn = document.getElementById("search-toggle");
const wrapper = document.getElementById("search-wrapper");
const backBtn = document.getElementById("search-back");
const clearBtn = document.getElementById("search-clear");
const input = document.getElementById("search-input") as HTMLInputElement | null;

function abrirBusqueda(): void {
  wrapper?.classList.remove("hidden");
  wrapper?.classList.add("search-overlay-active");
  // Un frame después, para que el navegador registre el estado inicial
  // antes de animar hacia el estado abierto.
  requestAnimationFrame(() => {
    wrapper?.classList.add("search-overlay-open");
  });
  input?.focus();
}

function cerrarBusqueda(): void {
  wrapper?.classList.remove("search-overlay-open");
  window.setTimeout(() => {
    wrapper?.classList.add("hidden");
    wrapper?.classList.remove("search-overlay-active");
  }, 200);
}

function actualizarBotonBorrar(): void {
  if (!input || !clearBtn) return;
  clearBtn.classList.toggle("hidden", input.value.length === 0);
}

toggleBtn?.addEventListener("click", abrirBusqueda);
backBtn?.addEventListener("click", cerrarBusqueda);

clearBtn?.addEventListener("click", () => {
  if (!input) return;
  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.focus();
  actualizarBotonBorrar();
});

input?.addEventListener("input", actualizarBotonBorrar);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && wrapper?.classList.contains("search-overlay-open")) {
    cerrarBusqueda();
  }
});
