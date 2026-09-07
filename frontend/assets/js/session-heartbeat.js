// ══════════════════════════════════════════════════════════════
// LATIDO DE SESIÓN + CIERRE POR INACTIVIDAD — CAPCOB
// ══════════════════════════════════════════════════════════════
// 1) LATIDO: mientras esta pestaña siga abierta con una sesión iniciada,
//    avisa cada cierto tiempo al backend para que la sesión no expire
//    (protege contra cierres de pestaña abruptos, ver SESION_TIMEOUT_MINUTOS
//    en AuthController.java).
// 2) INACTIVIDAD: si nadie mueve el mouse ni toca el teclado durante el
//    tiempo permitido para su rol, se cierra la sesión de una vez (llamando
//    a /auth/logout), para que la persona pueda volver a entrar al momento,
//    sin tener que esperar a que la sesión expire sola.
//
// Se debe incluir en TODAS las páginas que requieren sesión iniciada,
// después de api-config.js.
// ══════════════════════════════════════════════════════════════

(function () {
  const HEARTBEAT_INTERVALO_MS = 5 * 60 * 1000; // 5 minutos

  // Minutos de inactividad permitidos antes de cerrar sesión sola, por rol.
  const INACTIVIDAD_MINUTOS_POR_ROL = {
    'Administrador': 15,
    'Empleado': 5
  };
  const REVISAR_INACTIVIDAD_CADA_MS = 30 * 1000; // revisa cada 30 segundos

  // Qué cuenta como "actividad" según el rol. Al Empleado (caja de escaneo)
  // solo le cuentan clics y teclas — mover el mouse o hacer scroll NO reinicia
  // su contador de inactividad. Al Administrador sí le cuenta todo.
  const EVENTOS_ACTIVIDAD_POR_ROL = {
    'Administrador': ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'],
    'Empleado': ['keydown', 'click']
  };

  // Para el Empleado, un clic o una tecla solo cuenta si de verdad interactúa
  // con algo del programa (botón, campo de texto, un producto de la lista,
  // etc.) — un clic en un espacio vacío de la pantalla, o una tecla presionada
  // sin estar escribiendo en ningún campo, NO cuenta como actividad.
  const SELECTOR_ELEMENTOS_INTERACTIVOS = 'button, input, select, textarea, a, [role="button"], [onclick]';
  function esInteraccionRealDeEmpleado(evento) {
    if (evento.type === 'keydown') {
      const el = document.activeElement;
      return !!(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable));
    }
    if (evento.type === 'click') {
      return !!evento.target.closest(SELECTOR_ELEMENTOS_INTERACTIVOS);
    }
    return false;
  }

  let ultimaActividad = Date.now();
  function marcarActividad() { ultimaActividad = Date.now(); }

  const rolActual = sessionStorage.getItem('rol');
  const eventosParaEsteRol = EVENTOS_ACTIVIDAD_POR_ROL[rolActual] || EVENTOS_ACTIVIDAD_POR_ROL['Administrador'];
  eventosParaEsteRol.forEach(evento => {
    document.addEventListener(evento, function (e) {
      if (rolActual === 'Empleado' && !esInteraccionRealDeEmpleado(e)) return;
      marcarActividad();
    }, { passive: true });
  });

  async function enviarLatido() {
    const userId = sessionStorage.getItem('userId');
    const token = sessionStorage.getItem('token');
    if (!userId || !token) return; // no hay sesión iniciada en esta pestaña

    try {
      const res = await fetch(API_BASE_URL + '/auth/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(userId), token })
      });

      if (res.status === 409) {
        sessionStorage.clear();
        window.location.href = '/frontend/paginas/login/login.html';
      }
    } catch (e) {
      // Sin conexión momentánea: no pasa nada, se reintenta en el próximo latido.
    }
  }

  async function cerrarSesionPorInactividad() {
    const userId = sessionStorage.getItem('userId');
    const token = sessionStorage.getItem('token');

    try {
      if (userId) {
        await fetch(API_BASE_URL + '/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Number(userId), token })
        });
      }
    } catch (e) {
      // Si falla la llamada, igual sacamos a la persona localmente.
    } finally {
      sessionStorage.clear();
      window.location.href = '/frontend/paginas/login/login.html';
    }
  }

  function revisarInactividad() {
    const rol = sessionStorage.getItem('rol');
    const userId = sessionStorage.getItem('userId');
    if (!rol || !userId) return; // no hay sesión iniciada en esta pestaña

    const limiteMinutos = INACTIVIDAD_MINUTOS_POR_ROL[rol];
    if (!limiteMinutos) return; // rol sin límite configurado

    const minutosInactivo = (Date.now() - ultimaActividad) / 60000;
    if (minutosInactivo >= limiteMinutos) {
      cerrarSesionPorInactividad();
    }
  }

  enviarLatido();
  setInterval(enviarLatido, HEARTBEAT_INTERVALO_MS);
  setInterval(revisarInactividad, REVISAR_INACTIVIDAD_CADA_MS);
})();

