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
//  1. Aplica de inmediato lo último guardado en localStorage
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

// ── 1. Aplicar de inmediato lo que haya en caché ──
aplicarTema(localStorage.getItem("temaSistema") || "claro");

function aplicarCacheMarca() {
  const nombreEmpresa = localStorage.getItem("nombreEmpresa");
  const logoUrl = localStorage.getItem("logoEmpresa");
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

    localStorage.setItem("temaSistema", config.tema || "claro");
    if (config.nombreEmpresa) localStorage.setItem("nombreEmpresa", config.nombreEmpresa);
    if (config.logoUrl) {
      localStorage.setItem("logoEmpresa", config.logoUrl);
    } else {
      localStorage.removeItem("logoEmpresa");
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
