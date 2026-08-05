// ══════════════════════════════════════════════════════════════
// SIDEBAR COMPARTIDO — CAPCOB
// ══════════════════════════════════════════════════════════════
// Este archivo es el ÚNICO lugar donde se define el menú lateral.
// Para agregar, quitar o renombrar una opción del dashboard,
// modifica el arreglo MENU_ITEMS de abajo — el cambio se refleja
// automáticamente en TODAS las páginas que usan este script.
//
// Cómo se usa en cada página HTML:
//   1. Deja un <div id="sidebar-root"></div> donde antes estaba
//      el <aside class="sidebar">...</aside>
//   2. Agrega <script src="/frontend/assets/js/sidebar.js"></script>
//      antes de cerrar </body>
// ══════════════════════════════════════════════════════════════

const MENU_ITEMS = [
  {
    href: "/frontend/paginas/inicio/inicio.html",
    label: "Puchaina",
    icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'
  },
  {
    href: "/frontend/paginas/productos-venta/productos-venta.html",
    label: "Producto de ventas (graficos)",
    icon: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'
  },
  {
    href: "/frontend/paginas/registro-venta/registro-venta.html",
    label: "Registro de ventas Anuales",
    icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'
  },
  {
    href: "/frontend/paginas/registrar-producto/registrar-producto.html",
    label: "Registrar producto",
    icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>'
  },
  {
    href: "/frontend/paginas/ver-inventario/ver-inventario.html",
    label: "Ver inventario",
    icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'
  },
  {
    href: "/frontend/paginas/ver-reportes/ver-reportes.html",
    label: "Ver reportes",
    icon: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'
  },
  {
    href: "/frontend/paginas/gestion-usuario/gestion-usuario.html",
    label: "Usuario",
    icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
  }
];

function renderSidebar() {
  const root = document.getElementById("sidebar-root");
  if (!root) return; // esta página no usa el sidebar compartido

  const currentPath = window.location.pathname;

  const navHtml = MENU_ITEMS.map(item => {
    const isActive = currentPath === item.href;
    return `
      <a class="nav-item${isActive ? " active" : ""}" href="${item.href}">
        <svg viewBox="0 0 24 24">${item.icon}</svg>
        ${item.label}
      </a>`;
  }).join("");

  root.outerHTML = `
    <aside class="sidebar">
      <!-- User -->
      <div class="user-block">
        <div class="avatar">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          <div class="notif-dot"></div>
        </div>
        <div class="user-info">
          <div class="user-name">Usuario 1</div>
          <div class="user-handle">@usuarioprueba</div>
        </div>
        <svg class="chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </div>

      <!-- Nav -->
      <nav class="nav">${navHtml}</nav>

      <!-- Bottom links -->
      <div class="nav-bottom">
        <a href="CONFIGURACION.html">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Configuracion
        </a>
        <a href="/frontend/paginas/login/login.html" onclick="localStorage.clear()">
          <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Cerrar Sesion
        </a>
      </div>
    </aside>`;
}

document.addEventListener("DOMContentLoaded", renderSidebar);
