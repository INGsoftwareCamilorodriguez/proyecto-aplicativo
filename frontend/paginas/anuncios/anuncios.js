// ══════════════════════════════════════════════════════════════
// ANUNCIOS — CAPCOB (solo Administrador)
// ──────────────────────────────────────────────────────────────
// - Cada REFRESCO_MS pregunta al backend quién está conectado
//   (POST /api/anuncios/conectados) y cuántos segundos lleva cada
//   empleado sin interactuar.
// - Entre una consulta y otra, el contador de cada empleado sigue
//   avanzando solo (cada segundo), sin tocar el servidor.
// - Cuando un empleado llega a UMBRAL_INACTIVIDAD_MIN minutos sin
//   interacciones sale un aviso y su fila se resalta.
// - Desde cada fila se le puede enviar un mensaje
//   (POST /api/anuncios/enviar) que le llega a su caja.
// ══════════════════════════════════════════════════════════════

// ► Minutos sin interacciones para marcar a un empleado como inactivo.
//   Ojo: la caja cierra sola la sesión del empleado a los 15 min
//   (session-heartbeat.js), así que este valor debe ser menor que eso.
const UMBRAL_INACTIVIDAD_MIN = 8;

// ► Cada cuánto se consulta al servidor.
const REFRESCO_MS = 5000;

const listaBody = document.getElementById('listaBody');
const emptyState = document.getElementById('emptyState');
const liveDot = document.getElementById('liveDot');
const liveText = document.getElementById('liveText');
const statConectados = document.getElementById('statConectados');
const statInactivos = document.getElementById('statInactivos');
const statInactivosCard = document.getElementById('statInactivosCard');
const statInactivosLabel = document.getElementById('statInactivosLabel');
const toasts = document.getElementById('toasts');

const modalMsg = document.getElementById('modalMsg');
const msgPara = document.getElementById('msgPara');
const msgTexto = document.getElementById('msgTexto');
const msgContador = document.getElementById('msgContador');
const msgError = document.getElementById('msgError');
const msgEnviar = document.getElementById('msgEnviar');

statInactivosLabel.textContent = 'Sin interacciones por ' + UMBRAL_INACTIVIDAD_MIN + ' min o más';

// id -> { id, nombre, base, capturadoEn, sinEntregar, fila: { tr, badge, hace, chip } }
const empleados = new Map();
// Empleados por los que ya salió el aviso emergente (para no repetirlo cada segundo).
const yaAvisados = new Set();
let destinatarioId = null;
let enviando = false;

function credenciales() {
  return { id: Number(sessionStorage.getItem('userId')), token: sessionStorage.getItem('token') };
}

// ── Utilidades de texto ──────────────────────────────────────
function iniciales(nombre) {
  const partes = String(nombre || '?').trim().split(/\s+/);
  return ((partes[0] || '?')[0] + (partes.length > 1 ? partes[1][0] : '')).toUpperCase();
}

function textoHace(seg) {
  seg = Math.floor(seg);
  if (seg < 10) return 'Ahora mismo';
  if (seg < 60) return 'Hace ' + seg + ' s';
  const min = Math.floor(seg / 60);
  if (min < 60) return 'Hace ' + min + ' min';
  return 'Hace ' + Math.floor(min / 60) + ' h ' + (min % 60) + ' min';
}

function textoMinutos(min) {
  return min + (min === 1 ? ' minuto' : ' minutos');
}

// Segundos sin interactuar "ahora": lo que dijo el servidor + lo que ha pasado desde entonces.
function segundosDe(emp) {
  return emp.base + (Date.now() - emp.capturadoEn) / 1000;
}

// ── Filas de la tabla ────────────────────────────────────────
// Cada fila se crea UNA vez y luego solo se actualizan sus textos; así el botón
// "Enviar mensaje" nunca se "mueve" justo cuando le haces clic.
function crearFila(emp) {
  const tr = document.createElement('tr');
  tr.dataset.id = emp.id;

  // Empleado
  const tdEmp = document.createElement('td');
  const cell = document.createElement('div');
  cell.className = 'user-cell';
  const avatar = document.createElement('div');
  avatar.className = 'user-avatar';
  avatar.textContent = iniciales(emp.nombre);
  const info = document.createElement('div');
  info.className = 'user-cell-info';
  const nombre = document.createElement('span');
  nombre.className = 'user-cell-name';
  nombre.textContent = emp.nombre;
  const rol = document.createElement('span');
  rol.className = 'user-cell-role';
  rol.textContent = 'Empleado';
  info.append(nombre, rol);
  cell.append(avatar, info);
  tdEmp.appendChild(cell);

  // Estado
  const tdEstado = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = 'status-badge status-active';
  tdEstado.appendChild(badge);

  // Última interacción
  const tdHace = document.createElement('td');

  // Acciones
  const tdAcc = document.createElement('td');
  const btn = document.createElement('button');
  btn.className = 'btn-msg';
  btn.type = 'button';
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Enviar mensaje';
  btn.addEventListener('click', function () { abrirModal(emp.id); });
  const chip = document.createElement('span');
  chip.className = 'chip-pend';
  chip.style.display = 'none';
  tdAcc.append(btn, chip);

  tr.append(tdEmp, tdEstado, tdHace, tdAcc);
  return { tr: tr, badge: badge, hace: tdHace, chip: chip };
}

function pintarFila(emp) {
  const seg = segundosDe(emp);
  const inactivo = seg >= UMBRAL_INACTIVIDAD_MIN * 60;

  emp.fila.tr.classList.toggle('fila-alerta', inactivo);
  emp.fila.badge.className = 'status-badge ' + (inactivo ? 'status-warn' : 'status-active');
  emp.fila.badge.textContent = inactivo
    ? 'Sin interacciones por ' + textoMinutos(Math.floor(seg / 60))
    : 'Activo';
  emp.fila.hace.textContent = textoHace(seg);

  if (emp.sinEntregar > 0) {
    emp.fila.chip.textContent = '✉ ' + emp.sinEntregar + ' sin entregar';
    emp.fila.chip.style.display = '';
  } else {
    emp.fila.chip.style.display = 'none';
  }
  return inactivo;
}

// Repinta todo lo que cambia con el paso del tiempo (se llama cada segundo).
function actualizarPantalla() {
  let inactivos = 0;

  empleados.forEach(function (emp) {
    const inactivo = pintarFila(emp);
    if (inactivo) {
      inactivos++;
      if (!yaAvisados.has(emp.id)) {
        yaAvisados.add(emp.id);
        avisarInactividad(emp);
      }
    } else {
      yaAvisados.delete(emp.id); // volvió a interactuar: si se duerme otra vez, avisará de nuevo
    }
  });

  statConectados.textContent = empleados.size;
  statInactivos.textContent = inactivos;
  statInactivosCard.classList.toggle('hay', inactivos > 0);
  emptyState.style.display = empleados.size ? 'none' : 'block';
}

// ── Consulta al servidor ─────────────────────────────────────
function sincronizar(datos) {
  const ahora = Date.now();
  const idsActuales = new Set(datos.map(function (d) { return d.id; }));

  // Quitar a los que ya no están conectados.
  empleados.forEach(function (emp, id) {
    if (!idsActuales.has(id)) {
      emp.fila.tr.remove();
      empleados.delete(id);
      yaAvisados.delete(id);
    }
  });

  // Agregar nuevos y actualizar los que siguen.
  datos.forEach(function (d) {
    let emp = empleados.get(d.id);
    if (!emp) {
      emp = { id: d.id, nombre: d.nombre };
      emp.fila = crearFila(emp);
      empleados.set(d.id, emp);
      listaBody.appendChild(emp.fila.tr);
    }
    emp.nombre = d.nombre;
    emp.base = d.segundosInactivo;
    emp.capturadoEn = ahora;
    emp.sinEntregar = d.mensajesSinEntregar;
  });

  // Mantener el orden que manda el servidor (alfabético), sin mover filas si ya está bien.
  const ordenActual = Array.from(listaBody.children).map(function (tr) { return Number(tr.dataset.id); });
  const ordenNuevo = datos.map(function (d) { return d.id; });
  if (ordenActual.join(',') !== ordenNuevo.join(',')) {
    ordenNuevo.forEach(function (id) { listaBody.appendChild(empleados.get(id).fila.tr); });
  }
}

function marcarEnVivo(ok, mensajeError) {
  liveDot.className = 'live-dot ' + (ok ? 'ok' : 'off');
  liveText.textContent = ok
    ? 'En vivo · se actualiza cada ' + (REFRESCO_MS / 1000) + ' segundos'
    : (mensajeError || 'Sin conexión con el servidor. Reintentando…');
}

async function cargar() {
  try {
    const res = await fetch(API_BASE_URL + '/anuncios/conectados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credenciales())
    });
    if (res.status === 401) {
      marcarEnVivo(false, 'Tu sesión no es válida. Vuelve a iniciar sesión.');
      return;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    sincronizar(await res.json());
    actualizarPantalla();
    marcarEnVivo(true);
  } catch (e) {
    marcarEnVivo(false);
  }
}

// ── Avisos emergentes ────────────────────────────────────────
function mostrarToast(opciones) {
  const el = document.createElement('div');
  el.className = 'toast-item' + (opciones.tipo ? ' ' + opciones.tipo : '');

  const icono = document.createElement('div');
  icono.className = 'toast-icono';
  icono.textContent = opciones.icono || '✓';

  const cuerpo = document.createElement('div');
  cuerpo.className = 'toast-cuerpo';
  const titulo = document.createElement('div');
  titulo.className = 'toast-titulo';
  titulo.textContent = opciones.titulo;
  cuerpo.appendChild(titulo);
  if (opciones.texto) {
    const texto = document.createElement('div');
    texto.className = 'toast-texto';
    texto.textContent = opciones.texto;
    cuerpo.appendChild(texto);
  }
  if (opciones.accion) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast-accion';
    b.textContent = opciones.accion.texto;
    b.addEventListener('click', function () { el.remove(); opciones.accion.alHacerClic(); });
    cuerpo.appendChild(b);
  }

  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'toast-x';
  x.textContent = '✕';
  x.addEventListener('click', function () { el.remove(); });

  el.append(icono, cuerpo, x);
  toasts.appendChild(el);
  setTimeout(function () { el.remove(); }, opciones.duracionMs || 5000);
}

function avisarInactividad(emp) {
  const min = Math.floor(segundosDe(emp) / 60);
  mostrarToast({
    tipo: 'alerta',
    icono: '⚠',
    titulo: emp.nombre,
    texto: 'Sin interacciones por ' + textoMinutos(min),
    accion: { texto: 'Enviar mensaje', alHacerClic: function () { abrirModal(emp.id); } },
    duracionMs: 20000
  });
}

// ── Modal: enviar mensaje ────────────────────────────────────
function abrirModal(id) {
  const emp = empleados.get(id);
  if (!emp) return;
  destinatarioId = id;
  msgPara.textContent = 'Para: ' + emp.nombre;
  msgTexto.value = '';
  msgError.textContent = '';
  actualizarContador();
  modalMsg.classList.add('show');
  msgTexto.focus();
}

function cerrarModal() {
  modalMsg.classList.remove('show');
  destinatarioId = null;
}

function actualizarContador() {
  msgContador.textContent = msgTexto.value.length + ' / 500';
}

async function enviarMensaje() {
  if (enviando || destinatarioId === null) return;
  const texto = msgTexto.value.trim();
  if (!texto) {
    msgError.textContent = 'Escribe un mensaje antes de enviar.';
    return;
  }

  enviando = true;
  msgEnviar.disabled = true;
  msgEnviar.textContent = 'Enviando…';
  msgError.textContent = '';

  try {
    const cred = credenciales();
    const res = await fetch(API_BASE_URL + '/anuncios/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cred.id, token: cred.token, destinatarioId: destinatarioId, texto: texto })
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* sin cuerpo */ }

    if (!res.ok) {
      msgError.textContent = (data && data.mensaje) || 'No se pudo enviar el mensaje.';
      return;
    }

    cerrarModal();
    mostrarToast({ icono: '✓', titulo: (data && data.mensaje) || 'Mensaje enviado' });
    cargar(); // refresca ya para que salga el "✉ sin entregar"
  } catch (e) {
    msgError.textContent = 'No hay conexión con el servidor.';
  } finally {
    enviando = false;
    msgEnviar.disabled = false;
    msgEnviar.textContent = 'Enviar';
  }
}

document.getElementById('msgCerrar').addEventListener('click', cerrarModal);
document.getElementById('msgCancelar').addEventListener('click', cerrarModal);
msgEnviar.addEventListener('click', enviarMensaje);
msgTexto.addEventListener('input', actualizarContador);
document.getElementById('msgFrases').addEventListener('click', function (e) {
  if (!e.target.classList.contains('frase')) return;
  msgTexto.value = e.target.textContent;
  actualizarContador();
  msgTexto.focus();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && modalMsg.classList.contains('show')) cerrarModal();
});

// ── Arranque ─────────────────────────────────────────────────
cargar();
setInterval(cargar, REFRESCO_MS);
setInterval(actualizarPantalla, 1000);
