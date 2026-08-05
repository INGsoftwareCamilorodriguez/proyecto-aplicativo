/* ══════════════════════════════════════════════════════════
   GUARDIÁN DE ACCESO — pegar justo después de <body> (o al
   inicio del <script> principal) en TODAS las páginas del
   dashboard que el Empleado NO debe poder ver:
   inicio.html, productos-venta.html, registro-venta.html,
   registrar-producto.html, ver-inventario.html, ver-reportes.html,
   gestion-usuario.html, CONFIGURACION.html, etc.

   Qué hace:
   - Si nadie inició sesión, manda a login.
   - Si el rol es "Empleado", lo regresa al escáner de inmediato,
     sin dejarlo ver ni un parpadeo del dashboard.
   - Si el rol NO es "Administrador" y la página actual es la de
     Gestión de Usuarios, lo saca de ahí — esa pantalla es
     exclusiva del Administrador.
   - Para cualquier rol que no sea Empleado, oculta el link
     "Escanear código de barras" del sidebar.
   - Para cualquier rol que no sea Administrador, oculta el link
     "Usuario" del sidebar.
   ══════════════════════════════════════════════════════════ */
(function guardianAcceso() {
  const rol = localStorage.getItem('rol');

  if (!rol) {
    window.location.href = "/frontend/paginas/login/login.html";
    return;
  }

  if (rol === 'Empleado') {
    window.location.href = "/frontend/paginas/escanear-codigo-barras/escanear-codigo-barras.html";
    return;
  }

  const esPaginaUsuarios = window.location.pathname.toLowerCase().includes('gestion-usuario');
  if (esPaginaUsuarios && rol !== 'Administrador') {
    window.location.href = "/frontend/paginas/inicio/inicio.html";
    return;
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item').forEach(item => {
      const href = (item.getAttribute('href') || '').toLowerCase();
      if (href.includes('escanear')) {
        item.style.display = 'none';
      }
      if (href.includes('gestion-usuario') && rol !== 'Administrador') {
        item.style.display = 'none';
      }
    });
  });
})();