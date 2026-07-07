# Catálogo Prodim

Catálogo de productos 100% frontend (Astro + Tailwind), sin backend, sin base
de datos y sin pasarela de pago. El pedido se arma en el navegador
(localStorage) y se cierra por WhatsApp.

## Puesta en marcha

```bash
npm install
cp .env.example .env   # y completá tu número de WhatsApp real
npm run dev             # http://localhost:4321
```

## Configuración obligatoria antes de publicar

Editá el archivo `.env` (creado a partir de `.env.example`):

```bash
PUBLIC_WHATSAPP_NUMBER=5491122334455   # tu número real, sin "+" ni espacios
PUBLIC_EMPRESA_NOMBRE=Prodim
```

`PUBLIC_WHATSAPP_NUMBER` es el número que recibe los pedidos por
`https://wa.me/<numero>?text=...`. Sin este dato configurado, el botón de
checkout avisa al usuario que falta configuración en vez de fallar en silencio.

## Actualizar el catálogo

Los productos viven en `src/data/productos.json`, con este shape (uno por
producto):

```json
{
  "codigo": 101,
  "nombre": "LAVANDINA EN GEL",
  "categoria": "02* CLORO Y LAVANDINAS",
  "precio1": "LT x $990 c/lt",
  "precio2": "20LT x $891 c/lt",
  "precio3": "60LT x $743 c/lt"
}
```

- `precio1/2/3` pueden quedar vacíos (`""`) si esa escala no existe para el
  producto (hay productos con 1, 2 o 3 escalas).
- El prefijo numérico de `categoria` (ej. `"02*"`) define el orden en que se
  muestran las categorías en la barra de filtros.
- Para reemplazar el catálogo completo, generá un JSON con este mismo shape
  (podés exportarlo desde tu Excel/sistema actual) y sobrescribí el archivo.
  No hace falta tocar ningún componente.

## Arquitectura (por qué está dividido así)

```
src/
  data/productos.json        <- única fuente de verdad de datos
  lib/
    pricing.ts                <- parsea "20LT x $891 c/lt" -> {etiqueta, precioUnitario, unidad}
    products.ts                <- arma Producto[] y Categoria[] en build time
  components/
    Header.astro                <- barra superior + botón carrito
    CategoryNav.astro            <- buscador + chips de categoría
    ProductCard.astro             <- card individual (escalas + selector + qty)
    ProductGrid.astro              <- grilla de cards (server-rendered)
    CartDrawer.astro                <- panel lateral del carrito (UI, sin lógica)
  scripts/
    catalog-filter.ts                <- filtra cards visibles por categoría/búsqueda
    cart.ts                           <- estado del carrito, localStorage, mensaje WhatsApp
  pages/index.astro                    <- ensambla todo
```

El parseo de precios y el armado de categorías se hacen **en build time**
(dentro del frontmatter de Astro), así el HTML que llega al navegador ya
trae los 641 productos listos, sin esperar ningún `fetch`. La interactividad
(filtros, carrito, WhatsApp) se resuelve después con los dos scripts de
`src/scripts`, que son JS plano sin ningún framework de UI.

## Cómo funciona el carrito

- Cada línea del carrito se identifica por `codigo + escala elegida`
  (ej. producto 101 en escala "20LT" es una línea distinta a producto 101 en
  escala "LT"). Si agregás el mismo producto+escala de nuevo, se suma la
  cantidad en vez de duplicar la línea.
- Todo el estado vive en `localStorage` bajo la clave `prodim:cart:v1`. Si el
  usuario recarga la página o cierra el navegador, el pedido sigue ahí.
- "Finalizar pedido por WhatsApp" arma un mensaje de texto plano (producto,
  código, escala, cantidad, subtotal y total) y abre
  `https://wa.me/<numero>?text=<mensaje codificado>` en una pestaña nueva.
- El total mostrado es informativo: la propia UI aclara que precio final,
  stock y forma de pago se confirman por WhatsApp.

## Build para producción

```bash
npm run build     # genera ./dist, 100% archivos estáticos
npm run preview   # sirve ./dist localmente para verificar
```

`dist/` se puede publicar en cualquier hosting estático (Netlify, Vercel,
GitHub Pages, S3+CloudFront, Cloudflare Pages, etc.) sin ningún servidor ni
runtime de Node detrás.

## Personalización rápida de marca

- Colores: `tailwind.config.mjs` (`colors.ink` = paleta principal,
  `colors.batch` = acento tipo "verde concentrado" usado en el CTA de
  WhatsApp y en los indicadores activos).
- Tipografías: `src/styles/global.css` (import de Google Fonts) +
  `fontFamily` en `tailwind.config.mjs`.
- Logo/wordmark: `src/components/Header.astro`.
