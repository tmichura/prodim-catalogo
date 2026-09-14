/**
 * Carrito de pedidos Prodim — 100% cliente.
 * Persiste en localStorage y arma el mensaje final para WhatsApp.
 * No hay llamadas a ningún backend: todo el estado vive en el navegador.
 */
import type { EscalaPrecio } from "../lib/pricing";
import { formatARS } from "../lib/pricing";

const STORAGE_KEY = "prodim:cart:v1";
const WHATSAPP_NUMBER = import.meta.env.PUBLIC_WHATSAPP_NUMBER || "";
const EMPRESA_NOMBRE = import.meta.env.PUBLIC_EMPRESA_NOMBRE || "Prodim";

interface ProductoPayload {
  codigo: number;
  nombre: string;
  categoria: string;
  escalas: EscalaPrecio[];
}

interface CartItem {
  /** codigo + etiqueta de escala, identifica una línea única del pedido */
  key: string;
  codigo: number;
  nombre: string;
  categoria: string;
  etiqueta: string;
  unidad: string;
  precioUnitario: number;
  cantidad: number;
}

type Cart = CartItem[];

// ---------- Persistencia ----------

function loadCart(): Cart {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Cart) : [];
  } catch {
    // localStorage corrupto o bloqueado: arrancamos con carrito vacío
    return [];
  }
}

function saveCart(cart: Cart): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Si el storage está lleno o deshabilitado, degradamos sin romper la UI
    console.warn("No se pudo guardar el carrito en localStorage.");
  }
}

// ---------- Operaciones sobre el carrito ----------

function addItem(cart: Cart, producto: ProductoPayload, escala: EscalaPrecio, cantidad: number): Cart {
  const key = `${producto.codigo}__${escala.etiqueta}`;
  const existente = cart.find((item) => item.key === key);

  if (existente) {
    existente.cantidad += cantidad;
    return [...cart];
  }

  return [
    ...cart,
    {
      key,
      codigo: producto.codigo,
      nombre: producto.nombre,
      categoria: producto.categoria,
      etiqueta: escala.etiqueta,
      unidad: escala.unidad,
      precioUnitario: escala.precioUnitario,
      cantidad,
    },
  ];
}

function updateQty(cart: Cart, key: string, delta: number): Cart {
  return cart
    .map((item) => (item.key === key ? { ...item, cantidad: item.cantidad + delta } : item))
    .filter((item) => item.cantidad > 0);
}

function removeItem(cart: Cart, key: string): Cart {
  return cart.filter((item) => item.key !== key);
}

function getTotal(cart: Cart): number {
  return cart.reduce((acc, item) => acc + item.precioUnitario * item.cantidad, 0);
}

// ---------- Selección automática de escala según cantidad ----------

/** Elige la escala con la mayor cantidadMinima que no supere la cantidad cargada. */
function pickEscala(escalas: EscalaPrecio[], cantidad: number): EscalaPrecio {
  return escalas.reduce((elegida, escala) =>
    escala.cantidadMinima <= cantidad && escala.cantidadMinima >= elegida.cantidadMinima
      ? escala
      : elegida
  , escalas[0]);
}

function highlightEscala(card: HTMLElement, escalas: EscalaPrecio[], cantidad: number): void {
  const elegida = pickEscala(escalas, cantidad);
  const elegidaIndex = escalas.indexOf(elegida);
  card.querySelectorAll<HTMLElement>(".escala-row").forEach((row) => {
    row.classList.toggle("escala-row--active", row.dataset.escalaIndex === String(elegidaIndex));
  });
}

function refreshCardHighlight(card: HTMLElement): void {
  const productoJson = card.dataset.product;
  const qtyInput = card.querySelector<HTMLInputElement>(".qty-input");
  if (!productoJson || !qtyInput) return;

  const producto = JSON.parse(productoJson) as ProductoPayload;

  // Si el campo está vacío, limpia el resaltado; de lo contrario, resalta la escala
  if (!qtyInput.value || qtyInput.value === "") {
    card.querySelectorAll<HTMLElement>(".escala-row").forEach((row) => {
      row.classList.remove("escala-row--active");
    });
    return;
  }

  const cantidad = Math.max(1, parseInt(qtyInput.value, 10) || 1);
  highlightEscala(card, producto.escalas, cantidad);
}

// ---------- Mensaje de WhatsApp ----------

function buildWhatsAppMessage(cart: Cart, clienteNombre: string): string {
  const fecha = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const lineas = cart.map((item, i) => {
    const subtotal = item.precioUnitario * item.cantidad;
    return [
      `${i + 1}. *${item.nombre}* (Cód. ${item.codigo})`,
      `   Cantidad: ${item.cantidad} ${item.unidad}  →  Precio unitario: ${formatARS(item.precioUnitario)}/${item.unidad}  →  Subtotal: ${formatARS(subtotal)}`,
    ].join("\n");
  });

  const total = getTotal(cart);

  const partes = [
    `Hola ${EMPRESA_NOMBRE}! Quiero hacer el siguiente pedido (${fecha}):`,
    "",
    ...(clienteNombre ? [`Cliente: ${clienteNombre}`, ""] : []),
    ...lineas,
    "",
    `TOTAL ESTIMADO: ${formatARS(total)}`,
    "",
    "Quedo atento/a para confirmar disponibilidad y forma de pago. Gracias!",
  ];

  return partes.join("\n");
}

function buildWhatsAppUrl(cart: Cart, clienteNombre: string): string {
  const mensaje = buildWhatsAppMessage(cart, clienteNombre);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;
}

// ---------- UI: referencias al DOM ----------

const els = {
  backdrop: document.getElementById("cart-backdrop"),
  drawer: document.getElementById("cart-drawer"),
  openBtn: document.getElementById("open-cart"),
  closeBtn: document.getElementById("close-cart"),
  itemsContainer: document.getElementById("cart-items"),
  emptyState: document.getElementById("cart-empty"),
  totalEl: document.getElementById("cart-total"),
  countEl: document.getElementById("cart-count"),
  checkoutBtn: document.getElementById("checkout-whatsapp") as HTMLButtonElement | null,
  clearBtn: document.getElementById("clear-cart"),
  clienteInput: document.getElementById("cliente-nombre") as HTMLInputElement | null,
  template: document.getElementById("cart-item-template") as HTMLTemplateElement | null,
  toast: document.getElementById("cart-toast"),
};

const ES_MOBILE = () => window.matchMedia("(max-width: 639px)").matches;

let toastTimeoutId: number | undefined;

function mostrarToast(mensaje: string): void {
  if (!els.toast) return;

  els.toast.textContent = mensaje;
  window.clearTimeout(toastTimeoutId);

  els.toast.classList.remove("opacity-0", "-translate-y-4");
  els.toast.classList.add("opacity-100", "translate-y-0");

  toastTimeoutId = window.setTimeout(() => {
    els.toast?.classList.add("opacity-0", "-translate-y-4");
    els.toast?.classList.remove("opacity-100", "translate-y-0");
  }, 2000);
}

let cart: Cart = loadCart();

// ---------- Render ----------

function render(): void {
  if (!els.itemsContainer || !els.template) return;

  els.itemsContainer.innerHTML = "";

  const hayItems = cart.length > 0;
  els.emptyState?.classList.toggle("hidden", hayItems);
  els.itemsContainer.classList.toggle("hidden", !hayItems);
  if (els.checkoutBtn) els.checkoutBtn.disabled = !hayItems;

  for (const item of cart) {
    const node = els.template.content.cloneNode(true) as DocumentFragment;
    const root = node.querySelector(".cart-item") as HTMLElement;
    root.dataset.itemKey = item.key;

    (root.querySelector(".item-codigo") as HTMLElement).textContent = String(item.codigo);
    (root.querySelector(".item-nombre") as HTMLElement).textContent = item.nombre;
    (root.querySelector(".item-escala") as HTMLElement).textContent =
      `${item.etiqueta} · ${formatARS(item.precioUnitario)}/${item.unidad}`;
    (root.querySelector(".item-cantidad") as HTMLElement).textContent = String(item.cantidad);
    (root.querySelector(".item-subtotal") as HTMLElement).textContent = formatARS(
      item.precioUnitario * item.cantidad
    );

    els.itemsContainer.appendChild(node);
  }

  if (els.totalEl) els.totalEl.textContent = formatARS(getTotal(cart));
  if (els.countEl) {
    // Cantidad de ítems distintos en el pedido, no la suma de unidades
    // (muchos productos se venden por litro/kg y esa suma no dice nada útil).
    els.countEl.textContent = String(cart.length);
  }
}

function persistAndRender(): void {
  saveCart(cart);
  render();
}

// ---------- Apertura / cierre del drawer ----------

function openDrawer(): void {
  els.drawer?.classList.remove("translate-x-full");
  els.backdrop?.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
}

function closeDrawer(): void {
  els.drawer?.classList.add("translate-x-full");
  els.backdrop?.classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
}

els.openBtn?.addEventListener("click", openDrawer);
els.closeBtn?.addEventListener("click", closeDrawer);
els.backdrop?.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});

// ---------- Agregar producto desde una card ----------

document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("[data-add-to-cart]");
  if (!btn) return;

  const card = btn.closest(".product-card") as HTMLElement | null;
  if (!card) return;

  const productoJson = card.dataset.product;
  if (!productoJson) return;

  const producto = JSON.parse(productoJson) as ProductoPayload;

  const qtyInput = card.querySelector<HTMLInputElement>(".qty-input");
  if (!qtyInput?.value) {
    qtyInput?.focus();
    return;
  }

  const cantidad = parseInt(qtyInput.value, 10);
  if (!cantidad || cantidad < 1) {
    qtyInput.focus();
    return;
  }

  const escala = pickEscala(producto.escalas, cantidad);
  if (!escala) return;

  cart = addItem(cart, producto, escala, cantidad);
  persistAndRender();

  // Micro-feedback: destello breve en el botón, sin animaciones invasivas
  btn.classList.add("!bg-batch-500", "!text-ink-900");
  window.setTimeout(() => btn.classList.remove("!bg-batch-500", "!text-ink-900"), 350);

  // En mobile no abrimos el carrito (tapa toda la pantalla); mostramos
  // una leyenda breve en su lugar para no interrumpir la navegación.
  if (ES_MOBILE()) {
    mostrarToast(`Se agregó ${producto.nombre}`);
  } else {
    openDrawer();
  }
});

// ---------- Controles dentro del carrito (qty, quitar) ----------

els.itemsContainer?.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const row = target.closest(".cart-item") as HTMLElement | null;
  if (!row) return;
  const key = row.dataset.itemKey || "";

  if (target.closest(".qty-increase")) {
    cart = updateQty(cart, key, 1);
    persistAndRender();
  } else if (target.closest(".qty-decrease")) {
    cart = updateQty(cart, key, -1);
    persistAndRender();
  } else if (target.closest(".item-remove")) {
    cart = removeItem(cart, key);
    persistAndRender();
  }
});

els.clearBtn?.addEventListener("click", () => {
  if (cart.length === 0) return;
  if (confirm("¿Vaciar todo el pedido actual?")) {
    cart = [];
    persistAndRender();
  }
});

// ---------- Checkout por WhatsApp ----------

els.checkoutBtn?.addEventListener("click", () => {
  if (cart.length === 0) return;

  if (!WHATSAPP_NUMBER) {
    alert(
      "Falta configurar el número de WhatsApp del negocio (PUBLIC_WHATSAPP_NUMBER en el archivo .env)."
    );
    return;
  }

  const clienteNombre = els.clienteInput?.value.trim() || "";
  const url = buildWhatsAppUrl(cart, clienteNombre);
  window.open(url, "_blank", "noopener,noreferrer");
});

// ---------- Escala automática según cantidad cargada ----------

document.addEventListener("input", (e) => {
  const input = e.target as HTMLElement;
  if (!input.classList.contains("qty-input")) return;

  const card = input.closest(".product-card") as HTMLElement | null;
  if (!card) return;

  refreshCardHighlight(card);
});

// ---------- Tocar una escala suma esa cantidad al pedido ----------

document.addEventListener("click", (e) => {
  const row = (e.target as HTMLElement).closest(".escala-row") as HTMLElement | null;
  if (!row) return;

  const card = row.closest(".product-card") as HTMLElement | null;
  const qtyInput = card?.querySelector<HTMLInputElement>(".qty-input");
  if (!qtyInput) return;

  const incremento = parseInt(row.dataset.cantidadMinima || "0", 10);
  const actual = parseInt(qtyInput.value, 10) || 0;
  qtyInput.value = String(actual + incremento);
  qtyInput.dispatchEvent(new Event("input", { bubbles: true }));
});

// ---------- Primer render ----------

render();
