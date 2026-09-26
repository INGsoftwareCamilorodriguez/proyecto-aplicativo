// ══════════════════════════════════════════════════════════════
// LATIDO DE SESIÓN + CIERRE POR INACTIVIDAD — CAPCOB
// ══════════════════════════════════════════════════════════════
// 1) LATIDO: mientras esta pestaña siga abierta con una sesión iniciada,
//    avisa cada cierto tiempo al backend para que la sesión no expire
//    (red de seguridad si el navegador no alcanza a avisar; ver
//    SESION_TIMEOUT_SEGUNDOS en AuthController.java).
//    Además, al cerrar/abandonar la pestaña se avisa a /auth/cerrando para
//    liberar la sesión al instante (ver "pagehide" al final del archivo).
// 2) INACTIVIDAD: si nadie mueve el mouse ni toca el teclado durante el
//    tiempo permitido para su rol, se cierra la sesión de una vez (llamando
//    a /auth/logout), para que la persona pueda volver a entrar al momento,
//    sin tener que esperar a que la sesión expire sola.
//
// Se debe incluir en TODAS las páginas que requieren sesión iniciada,
// después de api-config.js.
// ══════════════════════════════════════════════════════════════

(function () {
  // Cada cuánto avisa la pestaña "sigo aquí". Debe ser bastante menor que
  // SESION_TIMEOUT_SEGUNDOS del backend (AuthController.java, 60 s).
  const HEARTBEAT_INTERVALO_MS = 20 * 1000; // 20 segundos

  // Minutos de inactividad permitidos antes de cerrar sesión sola, por rol.
  // El rol 'Desarrollador' NO se agrega aquí a propósito: como no tiene
  // límite configurado, revisarInactividad() no le cierra la sesión sola
  // (más abajo). Sigue aplicando el login único (un solo dispositivo a la
  // vez), controlado por el backend en AuthController, sin importar el rol.
  const INACTIVIDAD_MINUTOS_POR_ROL = {
    'Administrador': 30,
    'Empleado': 15
  };
  const REVISAR_INACTIVIDAD_CADA_MS = 30 * 1000; // revisa cada 30 segundos

  // Cuántos minutos antes de cerrar la sesión se muestra el aviso obligatorio
  // (aplica igual para Administrador y Empleado).
  const MINUTOS_AVISO_ANTES_DE_CERRAR = 5;

  // true mientras el aviso está en pantalla esperando respuesta. Mientras esté
  // en true: (1) ningún evento de "actividad" cuenta (ni siquiera hacer clic
  // en el aviso), y (2) revisarInactividad() no cierra la sesión sola, para
  // darle tiempo a la persona a responder.
  let avisoActivo = false;
  // Evita volver a mostrar el aviso repetidas veces mientras siguen faltando
  // 5 minutos o menos (solo se vuelve a mostrar tras "Continuar conectado"
  // o tras un cierre/reinicio de sesión).
  let avisoYaMostrado = false;

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
  function marcarActividad() {
    ultimaActividad = Date.now();
    avisoYaMostrado = false; // hubo actividad real: el aviso puede volver a salir más adelante
  }

  const rolActual = sessionStorage.getItem('rol');
  const eventosParaEsteRol = EVENTOS_ACTIVIDAD_POR_ROL[rolActual] || EVENTOS_ACTIVIDAD_POR_ROL['Administrador'];
  eventosParaEsteRol.forEach(evento => {
    document.addEventListener(evento, function (e) {
      if (avisoActivo) return; // el aviso está en pantalla: nada cuenta como actividad
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

  // ── Modal obligatorio "se va a cerrar tu sesión" ──────────────────────
  // Se crea una sola vez y se reutiliza. No tiene botón de cerrar ni se
  // puede quitar haciendo clic afuera: hay que elegir una de las dos
  // opciones sí o sí.
  let elementoAviso = null;
  function crearElementoAviso() {
    const overlay = document.createElement('div');
    overlay.id = 'capcob-aviso-inactividad';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:inherit;';

    const caja = document.createElement('div');
    caja.style.cssText = 'background:#fff;border-radius:10px;max-width:380px;width:90%;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,0.3);text-align:center;';
    caja.innerHTML =
      '<h3 style="margin:0 0 12px;color:#1F2937;">Tu sesión está por cerrarse</h3>' +
      '<p style="margin:0 0 20px;color:#4B5563;">Han pasado varios minutos sin actividad. Si no respondes, la sesión se cerrará por inactividad.</p>' +
      '<div style="display:flex;gap:10px;justify-content:center;">' +
      '<button type="button" id="capcob-aviso-extender" style="flex:1;padding:10px;border:none;border-radius:6px;background:#1F8A2B;color:#fff;font-weight:600;cursor:pointer;">Continuar conectado</button>' +
      '<button type="button" id="capcob-aviso-ignorar" style="flex:1;padding:10px;border:none;border-radius:6px;background:#E5E7EB;color:#374151;font-weight:600;cursor:pointer;">Ignorar</button>' +
      '</div>';

    overlay.appendChild(caja);
    // Evita que un clic en el fondo oscuro cierre el aviso o cuente como actividad.
    overlay.addEventListener('click', function (e) { e.stopPropagation(); });

    overlay.querySelector('#capcob-aviso-extender').addEventListener('click', function (e) {
      e.stopPropagation();
      ultimaActividad = Date.now(); // vuelve al tiempo de inicio, como si acabara de haber actividad
      avisoYaMostrado = false;
      ocultarAvisoInactividad();
    });
    overlay.querySelector('#capcob-aviso-ignorar').addEventListener('click', function (e) {
      e.stopPropagation();
      // No se toca ultimaActividad: si la persona sigue sin hacer nada,
      // la próxima revisión cierra la sesión.
      ocultarAvisoInactividad();
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  function mostrarAvisoInactividad() {
    if (avisoActivo) return;
    avisoActivo = true;
    avisoYaMostrado = true;
    if (!elementoAviso) elementoAviso = crearElementoAviso();
    elementoAviso.style.display = 'flex';
  }

  function ocultarAvisoInactividad() {
    avisoActivo = false;
    if (elementoAviso) elementoAviso.style.display = 'none';
  }

  function revisarInactividad() {
    const rol = sessionStorage.getItem('rol');
    const userId = sessionStorage.getItem('userId');
    if (!rol || !userId) return; // no hay sesión iniciada en esta pestaña

    const limiteMinutos = INACTIVIDAD_MINUTOS_POR_ROL[rol];
    if (!limiteMinutos) return; // rol sin límite configurado

    const minutosInactivo = (Date.now() - ultimaActividad) / 60000;
    const minutosRestantes = limiteMinutos - minutosInactivo;

    if (minutosRestantes <= 0) {
      if (avisoActivo) ocultarAvisoInactividad();
      cerrarSesionPorInactividad();
      return;
    }

    if (avisoActivo) return; // esperando respuesta: no cerrar todavía

    if (minutosRestantes <= MINUTOS_AVISO_ANTES_DE_CERRAR && !avisoYaMostrado) {
      mostrarAvisoInactividad();
    }
  }

  // Al cerrar la pestaña (o navegar a otra página) avisa al backend. El backend
  // marca la sesión como vencida pero conserva el token: si era solo un cambio de
  // pantalla, el latido inmediato de la página nueva la renueva; si era un cierre
  // real, la persona puede volver a entrar de inmediato.
  // Si se cerró con "Cerrar Sesión" o por inactividad, sessionStorage ya está
  // vacío y no se envía nada.
  function avisarCierreDePagina() {
    const userId = sessionStorage.getItem('userId');
    const token = sessionStorage.getItem('token');
    if (!userId || !token) return;

    // Se manda como formulario (no JSON) para que sea una petición "simple" y el
    // navegador no necesite la consulta previa de CORS, que se pierde al cerrar.
    const url = API_BASE_URL + '/auth/cerrando';
    const datos = new URLSearchParams({ id: String(Number(userId)), token });

    try {
      // sendBeacon está hecho justo para esto: el navegador lo termina de enviar
      // aunque la pestaña ya se haya cerrado.
      const enviado = navigator.sendBeacon && navigator.sendBeacon(url, datos);
      if (!enviado) {
        fetch(url, { method: 'POST', body: datos, keepalive: true });
      }
    } catch (e) {
      // Si no alcanza a salir, el vencimiento por falta de latidos lo cubre.
    }
  }
  window.addEventListener('pagehide', avisarCierreDePagina);

  // Responde a la pantalla de login de este mismo navegador cuando pregunta si esta
  // pestaña sigue viva con la sesión de un usuario. Así el login sabe distinguir una
  // sesión realmente abierta en otra pestaña de una abandonada (pestaña cerrada de
  // golpe, se fue la luz, se apagó el PC...) y, en ese caso, deja entrar de inmediato.
  if ('BroadcastChannel' in window) {
    const canalSesion = new BroadcastChannel('capcob-sesion');
    canalSesion.onmessage = function (e) {
      if (!e.data || e.data.tipo !== 'preguntar') return;
      const miId = sessionStorage.getItem('userId');
      if (miId && String(e.data.usuarioId) === String(miId)) {
        canalSesion.postMessage({ tipo: 'presente', usuarioId: Number(miId) });
      }
    };
  }

  // Si el navegador restaura la página desde caché (botón "atrás"), la sesión
  // pudo quedar marcada como vencida por el pagehide: se renueva enseguida.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) enviarLatido();
  });

  enviarLatido();
  setInterval(enviarLatido, HEARTBEAT_INTERVALO_MS);
  setInterval(revisarInactividad, REVISAR_INACTIVIDAD_CADA_MS);
})();