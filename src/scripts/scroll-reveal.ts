/**
 * Anima con un fade + slide sutil los elementos marcados con [data-reveal]
 * a medida que entran en pantalla al scrollear. Ver estilos en global.css.
 */
const elementos = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

const prefiereMenosMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (elementos.length > 0) {
  if (prefiereMenosMovimiento) {
    // Sin animación: los mostramos directamente
    elementos.forEach((el) => el.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );

    elementos.forEach((el) => observer.observe(el));
  }
}
