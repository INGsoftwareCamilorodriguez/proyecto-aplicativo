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

   Nota: ocultar la opción "Usuario" del menú para quien no sea
   Administrador ya no se hace aquí — se hace en sidebar.js
   (propiedad "requiereRol" de cada item), porque ese script arma
   el menú DESPUÉS de que este se ejecuta, y hacerlo aquí no
   alcanzaba a ocultar nada.
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
})();