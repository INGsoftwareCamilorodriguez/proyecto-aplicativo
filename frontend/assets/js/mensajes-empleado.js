// ══════════════════════════════════════════════════════════════
// MENSAJES DEL ADMINISTRADOR (lado del EMPLEADO) — CAPCOB
// ──────────────────────────────────────────────────────────────
// Cada pocos segundos le pregunta al backend si el Administrador le
// mandó algún mensaje (POST /api/anuncios/pendientes). Si llegan, los
// muestra arriba de la caja con un botón "Entendido".
//
// Solo se activa para el rol Empleado. Se incluye en la pantalla de
// caja (escanear-codigo-barras.html), DESPUÉS de api-config.js y
// session-heartbeat.js.
//
// El clic en "Entendido" cuenta como interacción del empleado (es un
// botón real), así que también reinicia su contador de inactividad.
// ══════════════════════════════════════════════════════════════
(function () {
  if (sessionStorage.getItem('rol') !== 'Empleado') return;

  const CONSULTAR_CADA_MS = 5000;

  const cola = [];          // mensajes recibidos que aún no se han mostrado
  let tarjeta = null;       // tarjeta que está en pantalla ahora mismo
  let parpadeo = null;      // intervalo que alterna el título de la pestaña
  const tituloOriginal = document.title;

  // Pitido corto para llamar la atención (si el navegador no lo permite, no pasa nada).
  function sonar() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      vol.gain.value = 0.08;
      osc.connect(vol);
      vol.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
      osc.onended = function () { ctx.close(); };
    } catch (e) { /* sin sonido */ }
  }

  function empezarParpadeoTitulo() {
    if (parpadeo) return;
    let alterno = false;
    parpadeo = setInterval(function () {
      alterno = !alterno;
      document.title = alterno ? '🔔 Mensaje nuevo' : tituloOriginal;
    }, 1000);
  }

  function pararParpadeoTitulo() {
    if (!parpadeo) return;
    clearInterval(parpadeo);
    parpadeo = null;
    document.title = tituloOriginal;
  }

  function mostrarSiguiente() {
    if (tarjeta || cola.length === 0) return;
    const m = cola.shift();

    const caja = document.createElement('div');
    caja.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:1000000;' +
      'width:440px;max-width:92vw;background:#fff;border-radius:12px;padding:18px 20px;' +
      'border-left:6px solid #F59E0B;box-shadow:0 12px 36px rgba(0,0,0,.28);font-family:inherit;';

    const cabecera = document.createElement('div');
    cabecera.style.cssText = 'display:flex;align-items:center;gap:8px;font-weight:800;color:#1F2937;margin-bottom:8px;';
    cabecera.textContent = '🔔 Mensaje de ' + (m.remitente || 'Administrador');

    const texto = document.createElement('div');
    texto.style.cssText = 'color:#374151;font-size:.95rem;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere;margin-bottom:14px;';
    texto.textContent = m.texto; // textContent: nunca se interpreta como HTML

    const pie = document.createElement('div');
    pie.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;';

    const pendientes = document.createElement('span');
    pendientes.style.cssText = 'font-size:.75rem;color:#6B7280;';
    pendientes.textContent = cola.length ? '+' + cola.length + ' mensaje(s) más' : '';

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = 'Entendido';
    boton.style.cssText = 'padding:9px 22px;border:none;border-radius:8px;background:#1F8A2B;color:#fff;font-weight:600;cursor:pointer;';
    boton.addEventListener('click', function () {
      caja.remove();
      tarjeta = null;
      if (cola.length) {
        mostrarSiguiente();
      } else {
        pararParpadeoTitulo();
      }
    });

    pie.append(pendientes, boton);
    caja.append(cabecera, texto, pie);
    document.body.appendChild(caja);
    tarjeta = caja;

    empezarParpadeoTitulo();
    sonar();
  }

  async function consultar() {
    const userId = sessionStorage.getItem('userId');
    const token = sessionStorage.getItem('token');
    if (!userId || !token) return;

    try {
      const res = await fetch(API_BASE_URL + '/anuncios/pendientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(userId), token: token })
      });
      // Si la sesión ya no es válida, session-heartbeat.js se encarga de sacar al usuario.
      if (!res.ok) return;
      const nuevos = await res.json();
      if (Array.isArray(nuevos) && nuevos.length) {
        nuevos.forEach(function (m) { cola.push(m); });
        mostrarSiguiente();
      }
    } catch (e) {
      // Sin conexión un momento: se reintenta en la siguiente vuelta.
    }
  }

  consultar();
  setInterval(consultar, CONSULTAR_CADA_MS);
})();
