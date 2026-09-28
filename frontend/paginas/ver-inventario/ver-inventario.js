// ══════════════════════════════════════════════════════════════
// VER INVENTARIO — CAPCOB
// Conectado al backend real: /api/paquetes y /api/productos
// Buscador, filtros (paquete, estado, tipo, precio), tarjetas
// resumen y paginación funcionan en el navegador sobre los datos
// que devuelve el backend.
// ══════════════════════════════════════════════════════════════

// ── Configuración ────────────────────────────────────────────
const POR_PAGINA = 8;            // filas por página de la tabla
const UMBRAL_BAJO_FIJO = 10;     // menos de 10 und  → "Bajo stock"
const UMBRAL_BAJO_PESO = 2;      // menos de 2 kg    → "Bajo stock"
const COLORES_PAQUETE = 6;       // cantidad de colores pk-0 … pk-5 en el CSS

// ── Estado de la pantalla ────────────────────────────────────
let productos = [];
let paquetes = [];
let paginaActual = 1;

const filtros = { texto: '', paquete: '', estado: '', tipo: '', precio: '' };

// ── Elementos ────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const inventarioBody = $('inventarioBody');
const inventarioTable = $('inventarioTable');
const inventarioVacio = $('inventarioVacio');
const conteoTexto = $('conteoTexto');
const paginacion = $('paginacion');

const modalCodigo = $('modalCodigo');
const modalCodigoNombre = $('modalCodigoNombre');
const modalCodigoTipo = $('modalCodigoTipo');
const modalCodigoValor = $('modalCodigoValor');
const modalCodigoDetalle = $('modalCodigoDetalle');

// ── Utilidades ───────────────────────────────────────────────
async function apiFetch(path, options) {
  const res = await fetch(API_BASE_URL + path, Object.assign({
    headers: { 'Content-Type': 'application/json' }
  }, options));
  let data = null;
  try { data = await res.json(); } catch (e) { /* respuesta vacía */ }
  if (!res.ok) {
    const mensaje = (data && data.mensaje) ? data.mensaje : 'Ocurrió un error inesperado.';
    throw new Error(mensaje);
  }
  return data;
}

function escapar(texto) {
  return String(texto == null ? '' : texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Minúsculas y sin tildes, para que "papá" encuentre "papa"
function normalizar(texto) {
  return String(texto == null ? '' : texto)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function formatearPrecio(valor) {
  return '$' + Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

function formatearCantidad(prod) {
  const n = Number(prod.cantidad).toLocaleString('es-CO', { maximumFractionDigits: 3 });
  return prod.tipoPrecio === 'PESO' ? n + ' kg' : n + ' und';
}

// 'disponible' | 'bajo' | 'agotado'
function estadoDe(prod) {
  const cantidad = Number(prod.cantidad);
  if (cantidad <= 0) return 'agotado';
  const umbral = prod.tipoPrecio === 'PESO' ? UMBRAL_BAJO_PESO : UMBRAL_BAJO_FIJO;
  return cantidad < umbral ? 'bajo' : 'disponible';
}

const ETIQUETA_ESTADO = { disponible: 'Disponible', bajo: 'Bajo stock', agotado: 'Agotado' };

function mostrarAviso(mensaje) {
  const t = $('invToast');
  t.textContent = mensaje;
  t.classList.add('show');
  clearTimeout(mostrarAviso._t);
  mostrarAviso._t = setTimeout(() => t.classList.remove('show'), 2600);
}

// ── Carga de datos ───────────────────────────────────────────
async function cargarDatos() {
  try {
    const [listaPaquetes, listaProductos] = await Promise.all([
      apiFetch('/paquetes'),
      apiFetch('/productos')
    ]);
    paquetes = listaPaquetes || [];
    productos = listaProductos || [];
    llenarFiltroPaquetes();
    renderTodo();
  } catch (e) {
    inventarioTable.style.display = 'none';
    inventarioVacio.style.display = 'block';
    inventarioVacio.textContent = 'No se pudo cargar el inventario: ' + e.message;
    conteoTexto.textContent = '';
    paginacion.innerHTML = '';
  }
}

function llenarFiltroPaquetes() {
  const select = $('filtroPaquete');
  select.innerHTML = '<option value="">Todos</option>';
  paquetes.forEach(p => {
    const opt = document.createElement('option');
    opt.value = String(p.id);
    opt.textContent = p.nombre;
    select.appendChild(opt);
  });
}

// Cada paquete conserva siempre el mismo color de etiqueta
function claseColorPaquete(paqueteId) {
  let idx = paquetes.findIndex(p => p.id === paqueteId);
  if (idx < 0) idx = 0;
  return 'pk-' + (idx % COLORES_PAQUETE);
}

// ── Filtrado ─────────────────────────────────────────────────
function cumplePrecio(precio, rango) {
  if (!rango) return true;
  const partes = rango.split('-');
  const min = partes[0] === '' ? 0 : Number(partes[0]);
  const max = partes[1] === '' ? Infinity : Number(partes[1]);
  const p = Number(precio);
  return p >= min && p <= max;
}

function productosFiltrados() {
  const texto = normalizar(filtros.texto.trim());
  return productos.filter(prod => {
    if (texto) {
      const enNombre = normalizar(prod.nombre).includes(texto);
      const enCodigo = normalizar(prod.codigoBarras).includes(texto);
      if (!enNombre && !enCodigo) return false;
    }
    if (filtros.paquete && String(prod.paqueteId) !== filtros.paquete) return false;
    if (filtros.estado && estadoDe(prod) !== filtros.estado) return false;
    if (filtros.tipo && prod.tipoPrecio !== filtros.tipo) return false;
    if (!cumplePrecio(prod.precio, filtros.precio)) return false;
    return true;
  });
}

// ── Render ───────────────────────────────────────────────────
function renderTodo() {
  renderResumen();
  renderTabla();
}

function renderResumen() {
  let disponibles = 0, bajo = 0, agotados = 0;
  productos.forEach(p => {
    const e = estadoDe(p);
    if (e === 'disponible') disponibles++;
    else if (e === 'bajo') bajo++;
    else agotados++;
  });
  $('statTotal').textContent = productos.length;
  $('statDisponibles').textContent = disponibles;
  $('statBajo').textContent = bajo;
  $('statAgotados').textContent = agotados;

  document.querySelectorAll('.inv-stat').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.estado === filtros.estado && filtros.estado !== '');
  });
}

function renderTabla() {
  const lista = productosFiltrados();
  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  if (paginaActual > totalPaginas) paginaActual = totalPaginas;

  const inicio = (paginaActual - 1) * POR_PAGINA;
  const pagina = lista.slice(inicio, inicio + POR_PAGINA);

  inventarioBody.innerHTML = '';

  if (lista.length === 0) {
    inventarioTable.style.display = 'none';
    inventarioVacio.style.display = 'block';
    inventarioVacio.textContent = productos.length === 0
      ? 'Todavía no hay productos. Ve a "Registrar producto" para crear el primero.'
      : 'Ningún producto coincide con la búsqueda o los filtros.';
    conteoTexto.textContent = '';
    paginacion.innerHTML = '';
    return;
  }

  inventarioTable.style.display = 'table';
  inventarioVacio.style.display = 'none';

  pagina.forEach(prod => {
    const esPeso = prod.tipoPrecio === 'PESO';
    const estado = estadoDe(prod);
    const precioTexto = esPeso ? formatearPrecio(prod.precio) + ' / kg' : formatearPrecio(prod.precio);

    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="td-nombre">' + escapar(prod.nombre) + '</td>' +
      '<td><span class="tag ' + claseColorPaquete(prod.paqueteId) + '">' + escapar(prod.paqueteNombre || 'Sin paquete') + '</span></td>' +
      '<td><span class="tag ' + (esPeso ? 'tag-peso' : 'tag-fijo') + '">' + (esPeso ? 'Por peso' : 'Fijo') + '</span></td>' +
      '<td>' + escapar(formatearCantidad(prod)) + '</td>' +
      '<td>' + escapar(precioTexto) + '</td>' +
      '<td><span class="estado estado-' + estado + '"><i></i>' + ETIQUETA_ESTADO[estado] + '</span></td>' +
      '<td></td>';

    const btnVer = document.createElement('button');
    btnVer.type = 'button';
    btnVer.className = 'ver-btn';
    btnVer.title = 'Ver detalle y código de barras';
    btnVer.innerHTML = '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    btnVer.addEventListener('click', () => mostrarDetalle(prod));
    tr.lastElementChild.appendChild(btnVer);

    inventarioBody.appendChild(tr);
  });

  const hasta = inicio + pagina.length;
  conteoTexto.textContent = 'Mostrando ' + (inicio + 1) + '–' + hasta + ' de ' + lista.length +
    ' producto' + (lista.length === 1 ? '' : 's') +
    (lista.length !== productos.length ? ' (filtrado de ' + productos.length + ')' : '');

  renderPaginacion(totalPaginas);
}

function renderPaginacion(totalPaginas) {
  paginacion.innerHTML = '';
  if (totalPaginas <= 1) return;

  const crear = (texto, pagina, opts) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pg-btn' + (opts && opts.activo ? ' active' : '');
    b.textContent = texto;
    if (opts && opts.deshabilitado) b.disabled = true;
    if (pagina != null) b.addEventListener('click', () => irAPagina(pagina));
    return b;
  };

  paginacion.appendChild(crear('‹', paginaActual - 1, { deshabilitado: paginaActual === 1 }));

  // Muestra: 1 … (actual-1) actual (actual+1) … última
  const visibles = new Set([1, totalPaginas, paginaActual - 1, paginaActual, paginaActual + 1]);
  let previo = 0;
  for (let i = 1; i <= totalPaginas; i++) {
    if (!visibles.has(i)) continue;
    if (i - previo > 1) {
      const puntos = document.createElement('span');
      puntos.className = 'pg-dots';
      puntos.textContent = '…';
      paginacion.appendChild(puntos);
    }
    paginacion.appendChild(crear(String(i), i, { activo: i === paginaActual }));
    previo = i;
  }

  paginacion.appendChild(crear('›', paginaActual + 1, { deshabilitado: paginaActual === totalPaginas }));
}

function irAPagina(n) {
  paginaActual = n;
  renderTabla();
}

// ── Modal: detalle + código de barras ────────────────────────
function mostrarDetalle(prod) {
  const esPeso = prod.tipoPrecio === 'PESO';
  modalCodigoNombre.textContent = prod.nombre;
  modalCodigoTipo.textContent = esPeso ? 'PLU por peso' : 'EAN-13 fijo';
  modalCodigoValor.textContent = prod.codigoBarras || '—';

  const filas = [
    ['Paquete', prod.paqueteNombre || 'Sin paquete'],
    ['Cantidad', formatearCantidad(prod)],
    [esPeso ? 'Precio por kg' : 'Precio', formatearPrecio(prod.precio)],
    ['Estado', ETIQUETA_ESTADO[estadoDe(prod)]]
  ];
  if (!esPeso && prod.ventaPorPaquete && prod.precioPaquete != null) {
    filas.push(['Precio del paquete', formatearPrecio(prod.precioPaquete) +
      (prod.unidadesPorPaquete ? ' (' + prod.unidadesPorPaquete + ' und)' : '')]);
  }

  modalCodigoDetalle.innerHTML = filas
    .map(f => '<div><dt>' + escapar(f[0]) + '</dt><dd>' + escapar(f[1]) + '</dd></div>')
    .join('');

  if (esPeso) {
    const nota = document.createElement('div');
    nota.className = 'modal-nota';
    nota.textContent = 'El valor final se calcula al pesar el producto en el punto de venta.';
    modalCodigoDetalle.appendChild(nota);
  }

  modalCodigo.classList.remove('hidden');
}

function cerrarModal() { modalCodigo.classList.add('hidden'); }
$('btnCerrarModalCodigo').addEventListener('click', cerrarModal);
modalCodigo.addEventListener('click', (e) => { if (e.target === modalCodigo) cerrarModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModal(); });

// ── Buscador y filtros ───────────────────────────────────────
function cambioFiltro() {
  paginaActual = 1;
  renderResumen();
  renderTabla();
}

$('buscador').addEventListener('input', (e) => { filtros.texto = e.target.value; cambioFiltro(); });
$('filtroPaquete').addEventListener('change', (e) => { filtros.paquete = e.target.value; cambioFiltro(); });
$('filtroEstado').addEventListener('change', (e) => { filtros.estado = e.target.value; cambioFiltro(); });
$('filtroTipo').addEventListener('change', (e) => { filtros.tipo = e.target.value; cambioFiltro(); });
$('filtroPrecio').addEventListener('change', (e) => { filtros.precio = e.target.value; cambioFiltro(); });

// Las tarjetas resumen también filtran por estado al hacer clic
document.querySelectorAll('.inv-stat').forEach(btn => {
  btn.addEventListener('click', () => {
    const estado = btn.dataset.estado;
    filtros.estado = (filtros.estado === estado) ? '' : estado;
    $('filtroEstado').value = filtros.estado;
    $('filtroEstado')._sync();
    cambioFiltro();
  });
});

// ══════════════════════════════════════════════════════════════
// DESPLEGABLES CON DISEÑO (reemplazan la lista nativa del <select>)
// El <select> original sigue existiendo (oculto), así que el resto
// del código lo lee igual: sel.value y el evento "change".
// ══════════════════════════════════════════════════════════════
let cerrarMenuAbierto = null;

function mejorarSelect(sel) {
  const caja = sel.closest('.inv-filter');
  const txt = sel.parentElement;
  sel.style.display = 'none';

  const valor = document.createElement('span');
  valor.className = 'inv-fv';
  txt.appendChild(valor);

  const menu = document.createElement('ul');
  menu.className = 'inv-menu';
  menu.hidden = true;
  caja.appendChild(menu);
  caja.tabIndex = 0;

  const sync = () => {
    const o = sel.options[sel.selectedIndex];
    valor.textContent = o ? o.textContent : 'Sin opciones';
  };
  sel._sync = sync;

  const cerrar = () => { menu.hidden = true; caja.classList.remove('open'); };
  const abrir = () => {
    if (cerrarMenuAbierto) cerrarMenuAbierto();
    menu.innerHTML = '';
    Array.from(sel.options).forEach(o => {
      const li = document.createElement('li');
      li.className = 'inv-opt' + (o.value === sel.value ? ' sel' : '') + (o.disabled ? ' off' : '');
      li.textContent = o.textContent;
      if (!o.disabled) {
        li.addEventListener('click', (e) => {
          e.stopPropagation();
          sel.value = o.value;
          sync();
          cerrar();
          sel.dispatchEvent(new Event('change'));
        });
      }
      menu.appendChild(li);
    });
    menu.hidden = false;
    caja.classList.add('open');
    cerrarMenuAbierto = cerrar;
  };

  caja.addEventListener('click', () => { menu.hidden ? abrir() : cerrar(); });
  caja.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); menu.hidden ? abrir() : cerrar(); }
    else if (e.key === 'Escape') cerrar();
  });
  document.addEventListener('click', (e) => { if (!caja.contains(e.target)) cerrar(); });
  sync();
}

document.querySelectorAll('.inv-filter select').forEach(mejorarSelect);

// ══════════════════════════════════════════════════════════════
// COMPARAR — solo dos elementos, siempre "parejos":
//   · Productos: dos productos del MISMO paquete
//   · Paquetes:  un paquete contra otro
// ══════════════════════════════════════════════════════════════
const cmp = { activo: false, modo: 'productos', paqueteId: '', a: null, b: null, abierto: null, busq: { a: '', b: '' } };

const REGLAS = {
  productos: 'Elige un paquete y compara dos de sus productos. Así el precio y la cantidad siempre son comparables.',
  paquetes: 'Compara un paquete contra otro: cantidad de productos, stock y valor total del inventario.'
};

function reiniciarSeleccion() {
  cmp.a = null; cmp.b = null; cmp.abierto = null; cmp.busq = { a: '', b: '' };
}

function abrirComparar() {
  cmp.activo = true;
  reiniciarSeleccion();
  $('vistaInventario').hidden = true;
  $('vistaComparar').hidden = false;
  $('tituloPagina').textContent = 'Comparar';
  $('subPagina').textContent = 'Pon dos elementos lado a lado y mira en qué se diferencian.';
  const btn = $('btnComparar');
  btn.textContent = 'Volver al inventario';
  btn.classList.add('volver');
  llenarPaqueteComparar();
  renderComparar();
}

function cerrarComparar() {
  cmp.activo = false;
  $('vistaComparar').hidden = true;
  $('vistaInventario').hidden = false;
  $('tituloPagina').textContent = 'Ver inventario';
  $('subPagina').textContent = 'Consulta, analiza y compara tus productos por paquete.';
  const btn = $('btnComparar');
  btn.textContent = 'Comparar';
  btn.classList.remove('volver');
}

$('btnComparar').addEventListener('click', () => { cmp.activo ? cerrarComparar() : abrirComparar(); });

// Paquetes con al menos 2 productos (necesarios para comparar productos entre sí)
function productosDe(paqueteId) { return productos.filter(x => x.paqueteId === Number(paqueteId)); }

function llenarPaqueteComparar() {
  const sel = $('cmpPaquete');
  sel.innerHTML = '';
  const elegibles = paquetes.filter(p => productosDe(p.id).length >= 2);
  const base = document.createElement('option');
  base.value = '';
  base.textContent = elegibles.length ? 'Elige un paquete' : 'Ningún paquete tiene 2 productos';
  base.disabled = elegibles.length === 0;
  sel.appendChild(base);
  elegibles.forEach(p => {
    const o = document.createElement('option');
    o.value = String(p.id);
    o.textContent = p.nombre + ' (' + productosDe(p.id).length + ')';
    sel.appendChild(o);
  });
  sel.value = cmp.paqueteId;
  sel._sync();
}

$('cmpPaquete').addEventListener('change', (e) => {
  cmp.paqueteId = e.target.value;
  reiniciarSeleccion();
  renderComparar();
});

document.querySelectorAll('.cmp-modo').forEach(btn => {
  btn.addEventListener('click', () => {
    if (cmp.modo === btn.dataset.modo) return;
    cmp.modo = btn.dataset.modo;
    cmp.paqueteId = '';
    reiniciarSeleccion();
    llenarPaqueteComparar();
    renderComparar();
  });
});

// ── Datos de cada modo ───────────────────────────────────────
function resumenPaquete(paq) {
  const lista = productosDe(paq.id);
  const r = { nombre: paq.nombre, total: lista.length, disp: 0, bajo: 0, ago: 0, und: 0, kg: 0, valor: 0, promedio: null };
  let sumaFijos = 0, nFijos = 0;
  lista.forEach(x => {
    const e = estadoDe(x), c = Number(x.cantidad), pr = Number(x.precio);
    if (e === 'disponible') r.disp++; else if (e === 'bajo') r.bajo++; else r.ago++;
    r.valor += pr * c;
    if (x.tipoPrecio === 'PESO') r.kg += c; else { r.und += c; sumaFijos += pr; nFijos++; }
  });
  if (nFijos) r.promedio = sumaFijos / nFijos;
  return r;
}

function elementosComparables() {
  if (cmp.modo === 'paquetes') return paquetes.map(p => ({ id: p.id, nombre: p.nombre, sub: productosDe(p.id).length + ' producto(s)' }));
  if (!cmp.paqueteId) return [];
  return productosDe(cmp.paqueteId).map(x => ({
    id: x.id, nombre: x.nombre,
    sub: (x.tipoPrecio === 'PESO' ? 'Por peso' : 'Fijo') + ' · ' + formatearCantidad(x)
  }));
}

function buscarElemento(id) {
  if (id == null) return null;
  return cmp.modo === 'paquetes' ? paquetes.find(p => p.id === id) : productos.find(x => x.id === id);
}

// ── Render de las dos tarjetas (selector tipo botón) ─────────
const SVG_LUPA = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
const SVG_CAJA = '<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
const SVG_FLECHA = '<svg class="cmp-chev" viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"/></svg>';

function renderComparar() {
  document.querySelectorAll('.cmp-modo').forEach(b => b.classList.toggle('active', b.dataset.modo === cmp.modo));
  $('cmpRegla').textContent = REGLAS[cmp.modo];
  $('cmpPaqueteWrap').style.display = cmp.modo === 'productos' ? '' : 'none';
  renderTarjeta('a');
  renderTarjeta('b');
  renderResultado();
}

function textoPaquete(el) {
  if (cmp.modo === 'paquetes') return el ? 'Productos: <b>' + productosDe(el.id).length + '</b>' : '';
  const p = paquetes.find(x => x.id === Number(cmp.paqueteId));
  return 'Paquete: <b>' + escapar(p ? p.nombre : '—') + '</b>';
}

function renderTarjeta(lado) {
  const card = $(lado === 'a' ? 'cmpCardA' : 'cmpCardB');
  const esProd = cmp.modo === 'productos';
  const bloqueado = esProd && !cmp.paqueteId;
  const abierto = cmp.abierto === lado && !bloqueado;
  const el = buscarElemento(cmp[lado]);
  const titulo = (esProd ? 'Producto ' : 'Paquete ') + lado.toUpperCase();
  const etiqueta = el ? escapar(el.nombre) : (bloqueado ? 'Elige un paquete primero' : (esProd ? 'Seleccionar producto' : 'Seleccionar paquete'));
  const chip = textoPaquete(el);

  card.innerHTML =
    '<div class="cmp-card-head"><span class="cmp-letra">' + lado.toUpperCase() + '</span>' + titulo + '</div>' +
    '<div class="cmp-picker">' +
      '<button type="button" class="cmp-select' + (abierto ? ' open' : '') + (el ? ' tiene' : '') + '"' + (bloqueado ? ' disabled' : '') + '>' +
        SVG_LUPA + '<span class="cmp-select-txt">' + etiqueta + '</span>' + SVG_FLECHA +
      '</button>' +
      (abierto
        ? '<div class="cmp-panel"><label class="cmp-buscar">' + SVG_LUPA +
          '<input type="text" placeholder="Buscar por nombre..." autocomplete="off"/></label><div class="cmp-lista"></div></div>'
        : '') +
    '</div>' +
    (chip ? '<div class="cmp-paq">' + SVG_CAJA + '<span>' + chip + '</span></div>' : '');

  card.querySelector('.cmp-select').addEventListener('click', () => {
    cmp.abierto = cmp.abierto === lado ? null : lado;
    renderComparar();
    const inp = card.querySelector('.cmp-buscar input');
    if (inp) inp.focus();
  });

  if (abierto) {
    const input = card.querySelector('.cmp-buscar input');
    input.value = cmp.busq[lado];
    input.addEventListener('input', () => { cmp.busq[lado] = input.value; renderLista(lado); });
    renderLista(lado);
  }
}

function renderLista(lado) {
  const card = $(lado === 'a' ? 'cmpCardA' : 'cmpCardB');
  const cont = card.querySelector('.cmp-lista');
  if (!cont) return;
  const otro = lado === 'a' ? cmp.b : cmp.a;
  const texto = normalizar(cmp.busq[lado].trim());
  cont.innerHTML = '';

  const items = elementosComparables().filter(it => !texto || normalizar(it.nombre).includes(texto));
  if (items.length === 0) {
    cont.innerHTML = '<p class="cmp-vacio">No hay resultados.</p>';
    return;
  }
  items.forEach(it => {
    const fila = document.createElement('button');
    fila.type = 'button';
    const propio = cmp[lado] === it.id, ocupado = otro === it.id;
    fila.className = 'cmp-item' + (propio ? ' sel' : '') + (ocupado ? ' off' : '');
    fila.disabled = ocupado;
    fila.title = ocupado ? 'Ya está elegido en el otro lado' : '';
    fila.innerHTML = '<span class="cmp-item-n">' + escapar(it.nombre) + '</span><span class="cmp-item-s">' + escapar(it.sub) + '</span>';
    fila.addEventListener('click', () => {
      cmp[lado] = propio ? null : it.id;
      cmp.abierto = null;
      cmp.busq[lado] = '';
      renderComparar();
    });
    cont.appendChild(fila);
  });
}

// Cerrar el selector al hacer clic fuera o con Escape
document.addEventListener('click', (e) => {
  if (cmp.abierto && !e.target.closest('.cmp-picker')) { cmp.abierto = null; renderComparar(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && cmp.abierto) { cmp.abierto = null; renderComparar(); }
});

// ── Resultado de la comparación ──────────────────────────────
const num = (n) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 3 });
const dinero = (n) => formatearPrecio(n);

// mejor: 'mayor' | 'menor' | null (si no aplica resaltar a un ganador)
function filaCmp(etiqueta, va, vb, f, mejor) {
  const r = { etiqueta, ta: va == null ? '—' : f(va), tb: vb == null ? '—' : f(vb), dif: '—', ganaA: false, ganaB: false };
  if (va == null || vb == null) return r;
  if (va === vb) { r.dif = 'Igual'; return r; }
  r.dif = f(Math.abs(va - vb));
  if (mejor) {
    const aMejor = mejor === 'mayor' ? va > vb : va < vb;
    r.ganaA = aMejor; r.ganaB = !aMejor;
  }
  return r;
}

function chipEstado(e) { return '<span class="estado estado-' + e + '"><i></i>' + ETIQUETA_ESTADO[e] + '</span>'; }

function construirComparacion(A, B) {
  if (cmp.modo === 'paquetes') {
    const a = resumenPaquete(A), b = resumenPaquete(B);
    const rows = [
      filaCmp('Productos', a.total, b.total, num, 'mayor'),
      filaCmp('Disponibles', a.disp, b.disp, num, 'mayor'),
      filaCmp('Bajo stock', a.bajo, b.bajo, num, 'menor'),
      filaCmp('Agotados', a.ago, b.ago, num, 'menor'),
      filaCmp('Unidades en stock (fijos)', a.und, b.und, (n) => num(n) + ' und', 'mayor'),
      filaCmp('Kilos en stock (por peso)', a.kg, b.kg, (n) => num(n) + ' kg', 'mayor'),
      filaCmp('Valor del inventario', a.valor, b.valor, dinero, 'mayor'),
      filaCmp('Precio promedio por unidad', a.promedio, b.promedio, dinero, null)
    ];
    let resumen;
    if (a.valor === b.valor) resumen = 'Los dos paquetes tienen el mismo valor de inventario.';
    else {
      const [mayor, menor] = a.valor > b.valor ? [a, b] : [b, a];
      resumen = '<b>' + escapar(mayor.nombre) + '</b> tiene un inventario con ' + dinero(mayor.valor - menor.valor) +
        ' más de valor que <b>' + escapar(menor.nombre) + '</b>.';
    }
    return { nombreA: a.nombre, nombreB: b.nombre, rows, resumen, nota: '' };
  }

  // Productos (mismo paquete)
  const pa = A.tipoPrecio === 'PESO', pb = B.tipoPrecio === 'PESO';
  const mismoTipo = pa === pb;
  const sufA = pa ? ' / kg' : '', sufB = pb ? ' / kg' : '';
  const valA = Number(A.precio) * Number(A.cantidad), valB = Number(B.precio) * Number(B.cantidad);
  const rows = [
    { etiqueta: 'Tipo', ta: '<span class="tag ' + (pa ? 'tag-peso' : 'tag-fijo') + '">' + (pa ? 'Por peso' : 'Fijo') + '</span>',
      tb: '<span class="tag ' + (pb ? 'tag-peso' : 'tag-fijo') + '">' + (pb ? 'Por peso' : 'Fijo') + '</span>', dif: mismoTipo ? 'Igual' : 'Distinto', ganaA: false, ganaB: false, html: true }
  ];
  if (mismoTipo) {
    rows.push(filaCmp('Precio', Number(A.precio), Number(B.precio), (n) => dinero(n) + sufA, 'menor'));
    rows.push(filaCmp('Cantidad en stock', Number(A.cantidad), Number(B.cantidad), (n) => num(n) + (pa ? ' kg' : ' und'), 'mayor'));
  } else {
    rows.push({ etiqueta: 'Precio', ta: dinero(A.precio) + sufA, tb: dinero(B.precio) + sufB, dif: 'No comparable', ganaA: false, ganaB: false });
    rows.push({ etiqueta: 'Cantidad en stock', ta: formatearCantidad(A), tb: formatearCantidad(B), dif: 'No comparable', ganaA: false, ganaB: false });
  }
  rows.push(filaCmp('Valor en inventario', valA, valB, dinero, 'mayor'));
  rows.push({ etiqueta: 'Código', ta: A.codigoBarras || '—', tb: B.codigoBarras || '—', dif: '—', ganaA: false, ganaB: false, info: true });
  rows.push({ etiqueta: 'Estado', ta: chipEstado(estadoDe(A)), tb: chipEstado(estadoDe(B)),
    dif: estadoDe(A) === estadoDe(B) ? 'Igual' : 'Distinto', ganaA: false, ganaB: false, html: true });

  let resumen = '', nota = '';
  if (mismoTipo) {
    const x = Number(A.precio), y = Number(B.precio);
    if (x === y) resumen = 'Los dos productos tienen el mismo precio.';
    else {
      const [barato, caro] = x < y ? [A, B] : [B, A];
      const pct = Math.round((Math.abs(x - y) / Math.max(x, y)) * 100);
      resumen = '<b>' + escapar(barato.nombre) + '</b> es ' + dinero(Math.abs(x - y)) + sufA +
        ' más barato que <b>' + escapar(caro.nombre) + '</b> (' + pct + '% menos).';
    }
  } else {
    nota = 'Uno se vende por unidad y el otro por peso, así que su precio y su cantidad no se pueden comparar directamente.';
  }
  return { nombreA: A.nombre, nombreB: B.nombre, rows, resumen, nota };
}

const plano = (t) => String(t).replace(/<[^>]+>/g, '');

function renderResultado() {
  const cont = $('cmpResultado');
  const A = buscarElemento(cmp.a), B = buscarElemento(cmp.b);
  if (!A || !B) {
    cont.innerHTML = '<div class="cmp-espera">Elige ' + (cmp.modo === 'productos' ? 'dos productos' : 'dos paquetes') + ' para ver la comparación.</div>';
    return;
  }
  const c = construirComparacion(A, B);
  const esProd = cmp.modo === 'productos';
  const tagDe = (el) => esProd
    ? '<span class="tag ' + (el.tipoPrecio === 'PESO' ? 'tag-peso' : 'tag-fijo') + '">' + (el.tipoPrecio === 'PESO' ? 'Por peso' : 'Fijo') + '</span>'
    : '<span class="tag tag-fijo">' + productosDe(el.id).length + ' producto(s)</span>';
  const cab = (lado, el) => '<div class="cmp-h cmp-h-' + lado + '"><span class="cmp-h-ico">' + SVG_CAJA + '</span><div><div class="cmp-h-n">' + escapar(el.nombre) + '</div>' + tagDe(el) + '</div></div>';
  const celda = (lado, etiqueta, t, gana, html) =>
    '<div class="cmp-c cmp-c-' + lado + (gana ? ' gana' : '') + '"><small>' + escapar(etiqueta) + '</small><span>' + (html ? t : escapar(t)) + (gana ? '<span class="mejor">Mejor</span>' : '') + '</span></div>';

  // Filas de la tabla (tipo/estado ya salen como etiqueta en el encabezado o en la fila)
  const filas = c.rows.filter(r => !(esProd && r.etiqueta === 'Tipo'));

  // Diferencias reales (se ignora el código: siempre es distinto)
  const difs = c.rows.filter(r => !r.info && r.dif !== 'Igual' && r.dif !== '—');
  const textoDif = (d) => (d === 'Distinto' || d === 'No comparable') ? d : 'Diferencia: ' + d;

  const lista = (lado) => '<ul class="cmp-res-lista">' + c.rows.map(r => '<li>' + escapar(plano(lado === 'a' ? r.ta : r.tb)) + '</li>').join('') + '</ul>';

  cont.innerHTML =
    (c.nota ? '<div class="cmp-resumen cmp-nota" style="margin-bottom:16px">' + escapar(c.nota) + '</div>' : '') +
    '<div class="cmp-res-card">' + cab('a', A) + cab('b', B) +
      filas.map(r => celda('a', r.etiqueta, r.ta, r.ganaA, r.html) + celda('b', r.etiqueta, r.tb, r.ganaB, r.html)).join('') +
    '</div>' +
    '<div class="cmp-abajo" style="margin-top:20px">' +
      '<div class="cmp-box"><div class="cmp-box-t">Diferencias encontradas</div><div class="cmp-dif-lista">' +
        (difs.length
          ? difs.map(r => '<div class="cmp-dif-item"><span class="cmp-dif-n">' + escapar(r.etiqueta) + '<small>' + escapar(plano(r.ta)) + '  vs  ' + escapar(plano(r.tb)) + '</small></span><span class="cmp-dif-pill">' + escapar(textoDif(r.dif)) + '</span></div>').join('')
          : '<p class="cmp-vacio">No hay diferencias: son iguales en todo.</p>') +
      '</div></div>' +
      '<div class="cmp-box"><div class="cmp-box-t">Resumen</div><div class="cmp-res-cols">' +
        '<div class="cmp-res-col"><div class="cmp-res-nom"><span class="cmp-chip cmp-chip-a">A</span>' + escapar(c.nombreA) + '</div>' + lista('a') + '</div>' +
        '<div class="cmp-res-col"><div class="cmp-res-nom"><span class="cmp-chip cmp-chip-b">B</span>' + escapar(c.nombreB) + '</div>' + lista('b') + '</div>' +
      '</div><div class="cmp-total">' + difs.length + ' característica' + (difs.length === 1 ? '' : 's') + ' diferente' + (difs.length === 1 ? '' : 's') + '</div></div>' +
    '</div>';
}

// ── Inicio ───────────────────────────────────────────────────
cargarDatos();