/* ══════════════════════════════════════════════════════════
   GUARDIÁN DE ACCESO — pegar justo después de <body> (o al
   inicio del <script> principal) en TODAS las páginas del
   dashboard que no deben ser vistas por cualquier rol:
   inicio.html, productos-venta.html, registrar-producto.html, ver-inventario.html,
   gestion-usuario.html, configuracion.html, gestion-administradores.html,
   licencia.html, etc.

   Qué hace:
   - Si nadie inició sesión, manda a login.
   - Si el rol es "Empleado", lo regresa al escáner de inmediato,
     sin dejarlo ver ni un parpadeo del dashboard.
   - Si el rol es "Desarrollador", solo lo deja ver SUS páginas
     (gestion-administradores, licencia) y Configuración; para
     cualquier otra página del panel lo manda a su página de inicio.
   - Si el rol NO es "Desarrollador" y la página es una de las suyas
     (gestion-administradores, licencia), lo saca de ahí — esas
     pantallas son exclusivas del Desarrollador.
   - Si el rol NO es "Administrador" y la página actual es la de
     Gestión de Usuarios, lo saca de ahí — esa pantalla es
     exclusiva del Administrador.

   Nota: ocultar opciones del menú según el rol ya no se hace aquí —
   se hace en sidebar.js (propiedad "requiereRol" de cada item y el
   menú separado MENU_ITEMS_DESARROLLADOR), porque ese script arma
   el menú DESPUÉS de que este se ejecuta, y hacerlo aquí no
   alcanzaba a ocultar nada.
   ══════════════════════════════════════════════════════════ */
(function guardianAcceso() {
  const rol = sessionStorage.getItem('rol');

  if (!rol) {
    window.location.href = "/frontend/paginas/login/login.html";
    return;
  }

  if (rol === 'Empleado') {
    window.location.href = "/frontend/paginas/escanear-codigo-barras/escanear-codigo-barras.html";
    return;
  }

  const ruta = window.location.pathname.toLowerCase();
  const esPaginaDesarrollador = ruta.includes('gestion-administradores') || ruta.includes('licencia');

  if (rol === 'Desarrollador') {
    // El Desarrollador solo puede ver sus propias páginas y Configuración
    // (que comparte con el resto del panel: apariencia, su perfil, marca).
    const puedeVerEstaPagina = esPaginaDesarrollador || ruta.includes('configuracion');
    if (!puedeVerEstaPagina) {
      window.location.href = "/frontend/paginas/gestion-administradores/gestion-administradores.html";
    }
    return;
  }

  // A partir de aquí el rol es Administrador (o cualquier rol futuro del
  // panel "normal" de una empresa cliente): no puede entrar a las
  // páginas exclusivas del Desarrollador.
  if (esPaginaDesarrollador) {
    window.location.href = "/frontend/paginas/inicio/inicio.html";
    return;
  }

  const esPaginaUsuarios = ruta.includes('gestion-usuario');
  if (esPaginaUsuarios && rol !== 'Administrador') {
    window.location.href = "/frontend/paginas/inicio/inicio.html";
    return;
  }
})();
