/* =========================================================================
   WhiteMoon Dental — interacciones
   Sin librerías externas. Respeta prefers-reduced-motion.
   ========================================================================= */
(() => {
  "use strict";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- Nav: fondo al hacer scroll ---------- */
  const nav = $("#nav");
  const onScroll = () => nav && nav.classList.toggle("scrolled", window.scrollY > 20);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Menú móvil ---------- */
  const burger = $("#burger");
  const menu = $("#mobileMenu");
  if (burger && menu) {
    const setMenu = (open) => {
      menu.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      document.body.style.overflow = open ? "hidden" : "";
    };
    burger.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
    $$("a, .btn", menu).forEach((el) => el.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("open")) setMenu(false);
    });
  }

  /* ---------- Scroll-spy del nav ---------- */
  const spy = $$("#navLinks a");
  const sections = $$("main section[id]");
  if (spy.length && sections.length) {
    const sync = () => {
      let current = "top";
      sections.forEach((s) => {
        if (window.scrollY >= s.offsetTop - 160) current = s.id;
      });
      spy.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + current));
    };
    sync();
    window.addEventListener("scroll", sync, { passive: true });
  }

  /* ---------- Marquee: duplicar para bucle continuo ---------- */
  const marquee = $("#marquee");
  if (marquee && !reduced) marquee.innerHTML += marquee.innerHTML;

  /* ---------- Palabra rotativa del hero ---------- */
  const rot = $("#rotWord");
  if (rot && !reduced) {
    const words = ["implantes", "ortodoncia", "estética dental", "endodoncia", "odontopediatría"];
    let i = 0;
    setInterval(() => {
      rot.classList.add("out");
      setTimeout(() => {
        i = (i + 1) % words.length;
        rot.textContent = words[i];
        rot.classList.remove("out");
      }, 420);
    }, 2600);
  }

  /* ---------- Reveal al hacer scroll ---------- */
  const reveals = $$(".reveal");
  if (reveals.length && "IntersectionObserver" in window && !reduced) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e, n) => {
          if (!e.isIntersecting) return;
          e.target.style.transitionDelay = Math.min(n * 70, 280) + "ms";
          e.target.classList.add("in");
          io.unobserve(e.target);
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
    );
    reveals.forEach((el) => io.observe(el));

    /* Si se entra por un enlace profundo (#precios, #faq…), se restaura la
       posición de scroll o se salta de golpe, todo lo que queda por encima
       nunca llega a intersecar y se quedaría invisible para siempre.
       Revelamos de golpe lo que ya está en pantalla o por encima. */
    const revealPasados = () => {
      const limite = window.innerHeight * 0.94;
      reveals.forEach((el) => {
        if (el.classList.contains("in")) return;
        if (el.getBoundingClientRect().top < limite) {
          el.style.transitionDelay = "0ms";
          el.classList.add("in");
          io.unobserve(el);
        }
      });
    };
    revealPasados();
    window.addEventListener("load", revealPasados);
    window.addEventListener("hashchange", () => setTimeout(revealPasados, 420));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  /* ---------- Año del footer ---------- */
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Vídeo del hero: no cargarlo si no se va a ver ----------
     El CSS ya lo oculta en móvil y con movimiento reducido; aquí evitamos
     además la descarga del archivo en esos casos. */
  const video = $(".hero-video");
  if (video) {
    const skip = reduced || window.matchMedia("(max-width: 768px)").matches
      || (navigator.connection && navigator.connection.saveData);
    if (skip) {
      video.removeAttribute("autoplay");
      $$("source", video).forEach((s) => s.remove());
      video.load();
    }
  }

  /* ---------- Guardia anti-overflow horizontal (desarrollo) ---------- */
  window.addEventListener("load", () => {
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth) {
      console.warn("[layout] overflow horizontal:", de.scrollWidth, ">", de.clientWidth);
    }
  });
})();
