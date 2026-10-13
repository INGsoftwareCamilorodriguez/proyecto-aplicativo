// ══════════════════════════════════════════════════════════════
// TEMA Y MARCA — CAPCOB
// ══════════════════════════════════════════════════════════════
// Aplica en TODO el panel el tema (blanco/negro) y la marca
// (logo + nombre) que se configuran en Configuración.
//
// Incluir en cada página del panel, DESPUÉS de api-config.js:
//   <script src="/frontend/assets/js/api-config.js"></script>
//   <script src="/frontend/assets/js/tema-marca.js"></script>
//
// Cómo funciona:
//  1. Aplica de inmediato lo último guardado en la caché de ESTA pestaña
//     (para no parpadear al navegar entre páginas).
//  2. En segundo plano consulta GET /api/configuracion y, si algo
//     cambió, lo vuelve a aplicar y actualiza la caché local.
// ══════════════════════════════════════════════════════════════

const TEMA_VARS = {
  claro: {
    "--main-bg": "#F5F3FF",
    "--bg": "#F5F3FF",
    "--sidebar-bg": "#ffffff",
    "--white": "#ffffff",
    "--card": "#ffffff",
    "--text": "#1F2937",
    "--muted": "#6b7280",
    "--border": "#e5e7eb",
    "--gray-light": "#f3f4f6"
  },
  oscuro: {
    "--main-bg": "#000000",
    "--bg": "#000000",
    "--sidebar-bg": "#0d0d0d",
    "--white": "#161616",
    "--card": "#141414",
    "--text": "#f3f4f6",
    "--muted": "#9ca3af",
    "--border": "#2a2a2a",
    "--gray-light": "#1f1f1f"
  }
};

function aplicarTema(tema) {
  const vars = TEMA_VARS[tema] || TEMA_VARS.claro;
  const rootStyle = document.documentElement.style;
  Object.keys(vars).forEach(prop => rootStyle.setProperty(prop, vars[prop]));
  document.documentElement.setAttribute("data-tema", tema);
}

function aplicarMarca(nombreEmpresa, logoUrl) {
  document.querySelectorAll(".logo-badge").forEach(el => {
    if (logoUrl) {
      const img = el.querySelector("img");
      if (img) img.src = logoUrl;
    }
    if (nombreEmpresa) {
      // El nombre queda como texto suelto dentro del contenedor del logo
      el.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "") {
          node.textContent = nombreEmpresa;
        }
      });
    }
  });
  if (nombreEmpresa && document.title) {
    document.title = document.title.replace(/^CAPCOB/i, nombreEmpresa);
  }
}

// ── Caché POR PESTAÑA ──
// Antes se guardaba en localStorage, que comparten TODAS las pestañas del navegador:
// si entrabas con dos cuentas a la vez, el tema/logo de una se pintaba en la otra
// durante unos segundos, hasta que llegaba la configuración real desde el servidor.
// sessionStorage es privado de cada pestaña, así cada cuenta solo ve lo suyo.
function cacheGet(clave) {
  try { return sessionStorage.getItem(clave); } catch (e) { return null; }
}
function cacheSet(clave, valor) {
  try { sessionStorage.setItem(clave, valor); } catch (e) { /* sin espacio: se ignora */ }
}
function cacheDel(clave) {
  try { sessionStorage.removeItem(clave); } catch (e) { /* nada */ }
}
// Limpieza de las claves viejas que quedaron en localStorage (compartidas entre cuentas)
try {
  localStorage.removeItem("temaSistema");
  localStorage.removeItem("nombreEmpresa");
  localStorage.removeItem("logoEmpresa");
} catch (e) { /* nada */ }

// ── 1. Aplicar de inmediato lo que haya en caché ──
aplicarTema(cacheGet("temaSistema") || "claro");

function aplicarCacheMarca() {
  const nombreEmpresa = cacheGet("nombreEmpresa");
  const logoUrl = cacheGet("logoEmpresa");
  if (nombreEmpresa || logoUrl) aplicarMarca(nombreEmpresa, logoUrl);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", aplicarCacheMarca);
} else {
  aplicarCacheMarca();
}

// ── 2. Traer la configuración real del backend y refrescar ──
(async function sincronizarConfiguracion() {
  try {
    const res = await fetch(API_BASE_URL + "/configuracion");
    if (!res.ok) return;
    const config = await res.json();

    cacheSet("temaSistema", config.tema || "claro");
    if (config.nombreEmpresa) cacheSet("nombreEmpresa", config.nombreEmpresa);
    if (config.logoUrl) {
      cacheSet("logoEmpresa", config.logoUrl);
    } else {
      cacheDel("logoEmpresa");
    }

    aplicarTema(config.tema || "claro");
    const aplicar = () => aplicarMarca(config.nombreEmpresa, config.logoUrl);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", aplicar);
    } else {
      aplicar();
    }
  } catch (e) {
    // Sin conexión: la página se queda con lo que ya había en caché
  }
})();
