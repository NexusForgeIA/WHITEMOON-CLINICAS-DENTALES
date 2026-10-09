/* Capa holográfica: solo activa las animaciones cuando el bloque está en pantalla. */
(function () {
  var els = document.querySelectorAll(".hl, .proc-grid, .hl-d, .framed, .hl-map, .foot");
  if (!els.length) return;
  if (!("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("hl-on"); }); return; }
  var io = new IntersectionObserver(function (list) {
    list.forEach(function (x) { x.target.classList.toggle("hl-on", x.isIntersecting); });
  }, { threshold: 0.15 });
  els.forEach(function (e) { io.observe(e); });
})();
