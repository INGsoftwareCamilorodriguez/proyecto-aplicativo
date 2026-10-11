// ══════════════════════════════════════════════════════════════
// PANTALLA DE CARGA — CAPCOB
// ══════════════════════════════════════════════════════════════
// Cómo se usa: se agrega en el <head> de cada página, DESPUÉS de los CSS:
//   <link rel="stylesheet" href="/frontend/assets/css/loader.css">
//   <script src="/frontend/assets/js/loader.js"></script>
//
// Qué hace:
//  1. Muestra la imagen de carga (logo) apenas empieza a abrirse la página.
//  2. La oculta cuando la página terminó de cargar Y las peticiones al
//     backend que se hicieron al abrir la página ya respondieron
//     (así no se ve el tablero vacío con "0" ni la gráfica en blanco).
//  3. Al hacer clic en un enlace del menú, la vuelve a mostrar mientras
//     abre la siguiente página.
//  4. Si algo falla, se oculta sola a los 10 segundos.
//
// También se puede usar a mano:  CapcobLoader.show()  /  CapcobLoader.hide()
// ══════════════════════════════════════════════════════════════
(function () {
  "use strict";

  var TIEMPO_MINIMO_MS = 600;     // que no parpadee si carga muy rápido
  var TIEMPO_MAXIMO_MS = 10000;   // seguridad: nunca se queda pegada
  var ESPERA_FINAL_MS  = 150;     // margen para peticiones encadenadas
  var IGNORAR_PETICIONES = /heartbeat|\/auth\/logout|mensajes|asistente|anuncios\/en-vivo/i;

  var PAGINAS_PANEL = /\/(inicio|licencia|ver-inventario|configuracion|registrar-producto|productos-venta|gestion-administradores|gestion-usuario|anuncios)\//i;
  var esPanel = PAGINAS_PANEL.test(location.pathname);

  var inicio = Date.now();
  var cargaTerminada = false;
  var faseInicial = true;
  var pendientes = 0;
  var overlay = null;
  var temporizadorFinal = null;

  // ── Crear el overlay lo antes posible ──
  function crear() {
    overlay = document.createElement("div");
    overlay.id = "capcob-loader";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.setAttribute("aria-label", "Cargando");
    if (!esPanel) overlay.className = "capcob-loader--full";
    overlay.innerHTML =
      '<div class="capcob-loader__caja">' +
        '<img class="capcob-loader__logo" src="/frontend/assets/imagenes/logo-capcob.png" alt="CAPCOB">' +
        '<div class="capcob-loader__barra"></div>' +
        '<div class="capcob-loader__texto">Cargando…</div>' +
      "</div>";
    document.documentElement.appendChild(overlay);
    ajustarPosicion();
  }

  // En el panel, el overlay empieza donde termina el menú lateral
  function ajustarPosicion() {
    if (!overlay) return;
    if (!esPanel) { overlay.style.removeProperty("--capcob-loader-left"); return; }
    var ancho = 260;
    var menu = document.querySelector(".sidebar");
    if (menu) {
      ancho = menu.getBoundingClientRect().width;
    } else {
      var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sidebar-w"));
      if (!isNaN(v)) ancho = v;
    }
    overlay.style.setProperty("--capcob-loader-left", ancho + "px");
  }

  function mostrar() {
    if (!overlay) crear();
    ajustarPosicion();
    overlay.classList.remove("capcob-loader--oculto");
  }

  function ocultar() {
    if (!overlay) return;
    overlay.classList.add("capcob-loader--oculto");
  }

  // ── Contar las peticiones fetch de la carga inicial ──
  var fetchOriginal = window.fetch;
  if (typeof fetchOriginal === "function") {
    window.fetch = function (entrada) {
      var url = typeof entrada === "string" ? entrada : (entrada && entrada.url) || "";
      var contar = faseInicial && !IGNORAR_PETICIONES.test(url);
      if (contar) pendientes++;
      var p = fetchOriginal.apply(this, arguments);
      if (contar) {
        var listo = function () { pendientes = Math.max(0, pendientes - 1); intentarOcultar(); };
        p.then(listo, listo);
      }
      return p;
    };
  }

  function intentarOcultar() {
    if (!faseInicial || !cargaTerminada || pendientes > 0) return;
    clearTimeout(temporizadorFinal);
    var falta = Math.max(0, TIEMPO_MINIMO_MS - (Date.now() - inicio)) + ESPERA_FINAL_MS;
    temporizadorFinal = setTimeout(function () {
      if (pendientes > 0) return;           // apareció otra petición: seguir esperando
      faseInicial = false;
      ocultar();
    }, falta);
  }

  // ── Arranque ──
  crear();

  document.addEventListener("DOMContentLoaded", ajustarPosicion);
  window.addEventListener("resize", ajustarPosicion);
  window.addEventListener("load", function () {
    ajustarPosicion();
    cargaTerminada = true;
    intentarOcultar();
  });

  // Seguridad: nunca dejar la pantalla de carga pegada
  setTimeout(function () { faseInicial = false; pendientes = 0; ocultar(); }, TIEMPO_MAXIMO_MS);

  // Volver con el botón "atrás" (el navegador restaura la página ya cargada)
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) { faseInicial = false; ocultar(); }
  });

  // Clic en un enlace interno: mostrar la carga mientras abre la otra página
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var destino = a.getAttribute("href");
    if (!destino || destino.charAt(0) === "#" || /^(javascript|mailto|tel):/i.test(destino)) return;
    if (a.target && a.target !== "_self") return;
    if (a.hasAttribute("download")) return;
    if (a.origin !== location.origin) return;
    if (a.pathname === location.pathname && a.search === location.search) return;
    mostrar();
    // si el clic dispara un cierre de sesión u otra acción que no navega, no dejarla pegada
    setTimeout(ocultar, 8000);
  }, true);

  window.CapcobLoader = { show: mostrar, hide: ocultar };
})();
