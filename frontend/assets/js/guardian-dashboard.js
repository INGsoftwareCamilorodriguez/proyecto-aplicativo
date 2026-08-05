/* ══════════════════════════════════════════════════════════
   GUARDIÁN DE ACCESO — pegar justo después de <body> (o al
   inicio del <script> principal) en TODAS las páginas del
   dashboard que el Empleado NO debe poder ver:
   inicio.html, productos_venta.html, registro_ventas.html,
   registrar_producto.html, ver_inventario.html, ver_reportes.html,
   getion_usuario.html, CONFIGURACION.html, etc.

   Qué hace:
   - Si nadie inició sesión, manda a login.
   - Si el rol es "Empleado", lo regresa al escáner de inmediato,
     sin dejarlo ver ni un parpadeo del dashboard.
   ══════════════════════════════════════════════════════════ */
(function guardianAcceso() {
  const rol = localStorage.getItem('rol');

  if (!rol) {
    window.location.href = "/frontend/paginas/login/login.html";
    return;
  }

  if (rol === 'Empleado') {
    window.location.href = "/frontend/paginas/escanear-codigo-barras/escanear-codigo-barras.html";
  }
})();