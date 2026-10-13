// ══════════════════════════════════════════════════════════════
// ANUNCIOS — CAPCOB (solo Administrador)
// ──────────────────────────────────────────────────────────────
// - Muestra TODOS los empleados (conectados y sin conexión):
//     · GET  /api/usuarios              -> lista de todos los empleados
//     · POST /api/anuncios/conectados   -> quiénes tienen sesión abierta y
//                                          cuántos segundos llevan sin interactuar
//   Se consultan cada REFRESCO_MS.
// - Entre una consulta y otra, el contador de cada empleado conectado sigue
//   avanzando solo (cada segundo), sin tocar el servidor.
// - Cuando un empleado llega a UMBRAL_INACTIVIDAD_MIN minutos sin
//   interacciones sale un aviso y su fila se resalta.
// - Solo a los empleados conectados se les puede enviar un mensaje
//   (POST /api/anuncios/enviar) que les llega a su caja.
// - Buscador por nombre/usuario y paginado de 8 en 8.
// ══════════════════════════════════════════════════════════════

// ► Minutos sin interacciones para marcar a un empleado como inactivo.
//   Ojo: la caja cierra sola la sesión del empleado a los 15 min
//   (session-heartbeat.js), así que este valor debe ser menor que eso.
const UMBRAL_INACTIVIDAD_MIN = 8;

// ► Cada cuánto se consulta al servidor.
const REFRESCO_MS = 5000;

// ► Cuántos empleados se ven por página.
const POR_PAGINA = 8;

const listaBody = document.getElementById('listaBody');
const emptyState = document.getElementById('emptyState');
const emptyTitulo = document.getElementById('emptyTitulo');
const emptyTexto = document.getElementById('emptyTexto');
const liveDot = document.getElementById('liveDot');
const liveText = document.getElementById('liveText');
const statConectados = document.getElementById('statConectados');
const statInactivos = document.getElementById('statInactivos');
const statInactivosCard = document.getElementById('statInactivosCard');
const statInactivosLabel = document.getElementById('statInactivosLabel');
const statDesconectados = document.getElementById('statDesconectados');
const buscador = document.getElementById('buscador');
const pager = document.getElementById('pager');
const pagerInfo = document.getElementById('pagerInfo');
const pagerBtns = document.getElementById('pagerBtns');
const toasts = document.getElementById('toasts');

const modalMsg = document.getElementById('modalMsg');
const msgPara = document.getElementById('msgPara');
const msgTexto = document.getElementById('msgTexto');
const msgContador = document.getElementById('msgContador');
const msgError = document.getElementById('msgError');
const msgEnviar = document.getElementById('msgEnviar');

statInactivosLabel.textContent = 'Sin interacciones por ' + UMBRAL_INACTIVIDAD_MIN + ' min o más';

// id -> { id, nombre, usuario, cuentaActiva, conectado, base, capturadoEn, sinEntregar,
//         fila: { tr, avatar, badge, hace, btn, chip } }
const empleados = new Map();
// Empleados por los que ya salió el aviso emergente (para no repetirlo cada segundo).
const yaAvisados = new Set();
let destinatarioId = null;
let enviando = false;
let paginaActual = 1;
let textoBusqueda = '';
let primeraCargaLista = false;   // ya llegó la lista al menos una vez (para no mostrar "vacío" antes)

function credenciales() {
  return { id: Number(sessionStorage.getItem('userId')), token: sessionStorage.getItem('token') };
}

// ── Utilidades de texto ──────────────────────────────────────
function iniciales(nombre) {
  const partes = String(nombre || '?').trim().split(/\s+/);
  return ((partes[0] || '?')[0] + (partes.length > 1 ? partes[1][0] : '')).toUpperCase();
}

// Para buscar sin importar mayúsculas ni tildes ("jose" encuentra "José").
function normalizar(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function textoHace(seg) {
  seg = Math.floor(seg);
  if (seg < 10) return 'Ahora mismo';
  if (seg < 60) return 'Hace ' + seg + ' s';
  const min = Math.floor(seg / 60);
  if (min < 60) return 'Hace ' + min + ' min';
  return 'Hace ' + Math.floor(min / 60) + ' h ' + (min % 60) + ' min';
}

// Primer inicio de sesión del día: "Hoy, 7:42 a. m." o, si es de otro día, "10 oct, 7:42 a. m.".
function textoInicio(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const hora = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return 'Hoy, ' + hora;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ', ' + hora;
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

  // Inicio de sesión (primero del día)
  const tdInicio = document.createElement('td');

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

  tr.append(tdEmp, tdEstado, tdInicio, tdHace, tdAcc);
  return { tr: tr, nombre: nombre, avatar: avatar, badge: badge, inicio: tdInicio, hace: tdHace, btn: btn, chip: chip };
}

// Pinta una fila según su estado. Devuelve true si está conectado pero sin interactuar.
function pintarFila(emp) {
  const f = emp.fila;
  f.nombre.textContent = emp.nombre;
  f.avatar.textContent = iniciales(emp.nombre);

  // ── Sin conexión ──
  if (!emp.conectado) {
    f.tr.classList.remove('fila-alerta');
    f.tr.classList.add('fila-off');
    f.badge.className = 'status-badge status-off';
    f.badge.textContent = emp.cuentaActiva ? 'Inactivo' : 'Cuenta desactivada';
    f.inicio.textContent = '—';
    f.hace.textContent = 'Sin conexión';
    f.btn.disabled = true;
    f.btn.title = 'Solo puedes enviar mensajes a empleados conectados';
    f.chip.style.display = 'none';
    return false;
  }

  // ── Conectado ──
  const seg = segundosDe(emp);
  const inactivo = seg >= UMBRAL_INACTIVIDAD_MIN * 60;

  f.tr.classList.remove('fila-off');
  f.tr.classList.toggle('fila-alerta', inactivo);
  f.badge.className = 'status-badge ' + (inactivo ? 'status-warn' : 'status-active');
  f.badge.textContent = inactivo
    ? 'Sin interacciones por ' + textoMinutos(Math.floor(seg / 60))
    : 'Activo';
  f.inicio.textContent = textoInicio(emp.primerInicio);
  f.hace.textContent = textoHace(seg);
  f.btn.disabled = false;
  f.btn.title = '';

  if (emp.sinEntregar > 0) {
    f.chip.textContent = '✉ ' + emp.sinEntregar + ' sin entregar';
    f.chip.style.display = '';
  } else {
    f.chip.style.display = 'none';
  }
  return inactivo;
}

// ── Lista: orden, búsqueda y paginado ────────────────────────
// Primero los conectados (A-Z) y después los que no tienen conexión (A-Z).
function ordenados() {
  return Array.from(empleados.values()).sort(function (a, b) {
    if (a.conectado !== b.conectado) return a.conectado ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
  });
}

function filtrados() {
  const q = normalizar(textoBusqueda.trim());
  const todos = ordenados();
  if (!q) return todos;
  return todos.filter(function (e) {
    return normalizar(e.nombre).indexOf(q) !== -1 || normalizar(e.usuario).indexOf(q) !== -1;
  });
}

// Decide qué filas se ven (la página actual) y las acomoda en el orden correcto.
function renderLista() {
  const todos = ordenados();
  const lista = filtrados();
  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  if (paginaActual > totalPaginas) paginaActual = totalPaginas;
  if (paginaActual < 1) paginaActual = 1;

  const desde = (paginaActual - 1) * POR_PAGINA;
  const visibles = new Set(lista.slice(desde, desde + POR_PAGINA).map(function (e) { return e.id; }));

  // Reordenar el DOM solo si el orden cambió (así no se mueve nada al azar).
  const ordenDom = Array.from(listaBody.children).map(function (tr) { return Number(tr.dataset.id); });
  const ordenNuevo = todos.map(function (e) { return e.id; });
  if (ordenDom.join(',') !== ordenNuevo.join(',')) {
    todos.forEach(function (e) { listaBody.appendChild(e.fila.tr); });
  }
  todos.forEach(function (e) { e.fila.tr.classList.toggle('oculta', !visibles.has(e.id)); });

  // Mensaje cuando no hay nada que mostrar
  const hayAlgo = lista.length > 0;
  emptyState.style.display = hayAlgo || !primeraCargaLista ? 'none' : 'block';
  if (!hayAlgo) {
    if (todos.length === 0) {
      emptyTitulo.textContent = 'No hay empleados registrados';
      emptyTexto.textContent = 'Cuando crees empleados en Personal, aparecerán aquí.';
    } else {
      emptyTitulo.textContent = 'No se encontró ningún empleado';
      emptyTexto.textContent = 'Revisa que el nombre esté bien escrito e intenta de nuevo.';
    }
  }

  renderPaginado(lista.length, desde, totalPaginas);
}

function renderPaginado(total, desde, totalPaginas) {
  if (total === 0) { pager.style.display = 'none'; return; }
  pager.style.display = '';

  const hasta = Math.min(desde + POR_PAGINA, total);
  pagerInfo.textContent = 'Mostrando ' + (desde + 1) + '–' + hasta + ' de ' + total +
    (total === 1 ? ' empleado' : ' empleados');

  pagerBtns.textContent = '';
  const crear = function (texto, pagina, opciones) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pg-btn' + (opciones && opciones.activo ? ' activo' : '');
    b.textContent = texto;
    b.disabled = !!(opciones && opciones.deshabilitado);
    if (opciones && opciones.etiqueta) b.setAttribute('aria-label', opciones.etiqueta);
    if (opciones && opciones.activo) b.setAttribute('aria-current', 'page');
    b.addEventListener('click', function () { irAPagina(pagina); });
    pagerBtns.appendChild(b);
  };

  crear('‹ Anterior', paginaActual - 1, { deshabilitado: paginaActual === 1, etiqueta: 'Página anterior' });
  for (let p = 1; p <= totalPaginas; p++) {
    crear(String(p), p, { activo: p === paginaActual, etiqueta: 'Página ' + p });
  }
  crear('Siguiente ›', paginaActual + 1, { deshabilitado: paginaActual === totalPaginas, etiqueta: 'Página siguiente' });
}

function irAPagina(p) {
  paginaActual = p;
  renderLista();
}

buscador.addEventListener('input', function () {
  textoBusqueda = buscador.value;
  paginaActual = 1;
  renderLista();
});

// Repinta todo lo que cambia con el paso del tiempo (se llama cada segundo).
function actualizarPantalla() {
  let conectados = 0;
  let sinInteraccion = 0;

  empleados.forEach(function (emp) {
    const inactivo = pintarFila(emp);
    if (emp.conectado) conectados++;
    if (inactivo) {
      sinInteraccion++;
      if (!yaAvisados.has(emp.id)) {
        yaAvisados.add(emp.id);
        avisarInactividad(emp);
      }
    } else {
      yaAvisados.delete(emp.id); // volvió a interactuar (o se desconectó): si se duerme otra vez, avisará de nuevo
    }
  });

  statConectados.textContent = conectados;
  statInactivos.textContent = sinInteraccion;
  statInactivosCard.classList.toggle('hay', sinInteraccion > 0);
  statDesconectados.textContent = empleados.size - conectados;
}

// ── Consulta al servidor ─────────────────────────────────────
// conectados: lo que responde /anuncios/conectados.  todos: lo que responde /usuarios
// (o null si esa consulta falló; entonces se conserva lo que ya se tenía).
function sincronizar(conectados, todos) {
  const ahora = Date.now();
  const mapaConectados = new Map(conectados.map(function (d) { return [d.id, d]; }));

  // Quitar a los que ya no existen (solo si llegó la lista completa).
  if (todos) {
    const idsValidos = new Set(todos.map(function (u) { return u.id; }));
    mapaConectados.forEach(function (d, id) { idsValidos.add(id); });
    empleados.forEach(function (emp, id) {
      if (!idsValidos.has(id)) {
        emp.fila.tr.remove();
        empleados.delete(id);
        yaAvisados.delete(id);
      }
    });
  }

  // Crear los nuevos y actualizar datos básicos.
  const asegurar = function (id, nombre, usuario, activo) {
    let emp = empleados.get(id);
    if (!emp) {
      emp = { id: id, nombre: nombre, usuario: usuario || '', cuentaActiva: activo !== false,
              conectado: false, base: 0, capturadoEn: ahora, sinEntregar: 0, primerInicio: '' };
      emp.fila = crearFila(emp);
      empleados.set(id, emp);
      listaBody.appendChild(emp.fila.tr);
    }
    emp.nombre = nombre;
    if (usuario !== undefined) emp.usuario = usuario || '';
    if (activo !== undefined) emp.cuentaActiva = activo !== false;
    return emp;
  };

  if (todos) {
    todos.forEach(function (u) { asegurar(u.id, u.nombre, u.usuario, u.activo); });
  }
  mapaConectados.forEach(function (d, id) { asegurar(id, d.nombre); });

  // Marcar quién está conectado ahora.
  empleados.forEach(function (emp, id) {
    const d = mapaConectados.get(id);
    emp.conectado = !!d;
    if (d) {
      emp.base = d.segundosInactivo;
      emp.capturadoEn = ahora;
      emp.sinEntregar = d.mensajesSinEntregar;
      emp.primerInicio = d.primerInicioDia || '';
    } else {
      emp.sinEntregar = 0;
    }
  });
}

function marcarEnVivo(ok, mensajeError) {
  liveDot.className = 'live-dot ' + (ok ? 'ok' : 'off');
  liveText.textContent = ok
    ? 'En vivo · se actualiza cada ' + (REFRESCO_MS / 1000) + ' segundos'
    : (mensajeError || 'Sin conexión con el servidor. Reintentando…');
}

async function cargar() {
  try {
    // La lista completa es "extra": si falla, igual se muestran los conectados.
    const pedirTodos = fetch(API_BASE_URL + '/usuarios')
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });

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
    const conectados = await res.json();
    const todos = await pedirTodos;

    sincronizar(conectados, Array.isArray(todos) ? todos : null);
    primeraCargaLista = true;
    actualizarPantalla();
    renderLista();
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
  if (!emp || !emp.conectado) return;
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
// El modal NO se cierra al hacer clic afuera (así no se pierde lo escrito): solo con la X o el botón Cancelar.

// ── Arranque ─────────────────────────────────────────────────
cargar();
setInterval(cargar, REFRESCO_MS);
setInterval(actualizarPantalla, 1000);
