// ══════════════════════════════════════════════════════════════
// REGISTRAR PRODUCTO — CAPCOB
// Conectado al backend real: /api/paquetes y /api/productos
// ══════════════════════════════════════════════════════════════

(function () {
  const rol = sessionStorage.getItem('rol');
  const username = sessionStorage.getItem('username');
  if (username) {
    const nameEl = document.querySelector('.user-name');
    if (nameEl) nameEl.textContent = username;
  }
  if (rol !== 'Administrador') {
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('href') && item.getAttribute('href').includes('getion_usuario')) {
        item.style.display = 'none';
      }
    });
  }
})();

// ── Estado ──────────────────────────────────────────────────
let paquetes = [];
let paqueteSeleccionadoId = null;
let productosDelPaquete = [];
let tipoPrecioActual = 'FIJO';
let ventaPorUnidadActual = true;
let ventaPorPaqueteActual = false;
let editandoProductoId = null;

// ── Elementos ───────────────────────────────────────────────
const paquetesRow = document.getElementById('paquetesRow');
const sinPaqueteHint = document.getElementById('sinPaqueteHint');
const productoForm = document.getElementById('productoForm');
const formTitle = document.getElementById('formTitle');
const formMsg = document.getElementById('formMsg');
const productosCard = document.getElementById('productosCard');
const productosTitle = document.getElementById('productosTitle');
const productosBody = document.getElementById('productosBody');
const sinProductosHint = document.getElementById('sinProductosHint');
const btnEliminarPaquete = document.getElementById('btnEliminarPaquete');
const btnCancelarEdicion = document.getElementById('btnCancelarEdicion');

const optFijo = document.getElementById('optFijo');
const optPeso = document.getElementById('optPeso');
const precioLabel = document.getElementById('precioLabel');
const cantidadLabel = document.getElementById('cantidadLabel');

const modalidadVentaWrap = document.getElementById('modalidadVentaWrap');
const optPorUnidad = document.getElementById('optPorUnidad');
const optPorPaquete = document.getElementById('optPorPaquete');
const campoPrecioUnidad = document.getElementById('campoPrecioUnidad');
const filaPaquete = document.getElementById('filaPaquete');
const precioPaqueteInput = document.getElementById('precioPaquete');
const unidadesPorPaqueteInput = document.getElementById('unidadesPorPaquete');

const buscarEditarWrap = document.getElementById('buscarEditarWrap');
const buscarProductoInput = document.getElementById('buscarProductoInput');
const buscarResultados = document.getElementById('buscarResultados');

const modalPaquete = document.getElementById('modalPaquete');
const modalPaqueteMsg = document.getElementById('modalPaqueteMsg');

// ── Utilidades ──────────────────────────────────────────────
function mostrarMsg(el, texto, tipo) {
  el.textContent = texto;
  el.className = 'form-msg ' + (tipo || '');
}

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

function formatearPrecio(valor) {
  return '$' + Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

// Convierte texto escrito por el usuario a número, aceptando AMBOS formatos:
// "12000" -> 12000   |   "12.000" -> 12000   |   "12.000,50" -> 12000.5
// Si permitirDecimales=true y el último grupo después del punto NO tiene
// 3 dígitos (ej: "2.5"), se interpreta ese punto como decimal real.
function parseNumeroCO(valor, permitirDecimales) {
  if (valor === null || valor === undefined) return NaN;
  let s = String(valor).trim().replace(/\$/g, '').replace(/\s/g, '');
  if (s === '') return NaN;

  if (s.includes(',')) {
    // Punto = miles, coma = decimales -> "12.000,50"
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes('.')) {
    const partes = s.split('.');
    const ultimo = partes[partes.length - 1];
    if (!permitirDecimales || ultimo.length === 3) {
      // Punto usado como separador de miles -> se quita
      s = partes.join('');
    }
    // si no, se deja el punto como decimal real (ej: "2.5" kg)
  }
  return Number(s);
}

// ── Cargar paquetes ─────────────────────────────────────────
async function cargarPaquetes() {
  try {
    paquetes = await apiFetch('/paquetes');
    renderPaquetes();
  } catch (e) {
    paquetesRow.innerHTML = '<span class="empty-hint">No se pudieron cargar los paquetes: ' + e.message + '</span>';
  }
}

function renderPaquetes() {
  paquetesRow.innerHTML = '';

  if (paquetes.length === 0) {
    const hint = document.createElement('span');
    hint.className = 'empty-hint';
    hint.textContent = 'Todavía no hay paquetes creados.';
    paquetesRow.appendChild(hint);
  }

  paquetes.forEach(p => {
    const pill = document.createElement('div');
    pill.className = 'paquete-pill' + (p.id === paqueteSeleccionadoId ? ' active' : '');
    pill.innerHTML = '<span>' + p.nombre + '</span><span class="count">' + p.totalProductos + '</span>';
    pill.addEventListener('click', () => seleccionarPaquete(p.id));
    paquetesRow.appendChild(pill);
  });

  const nuevo = document.createElement('div');
  nuevo.className = 'paquete-pill-nueva';
  nuevo.textContent = '+ Nuevo paquete';
  nuevo.addEventListener('click', abrirModalPaquete);
  paquetesRow.appendChild(nuevo);
}

// ── Seleccionar paquete ─────────────────────────────────────
async function seleccionarPaquete(id) {
  paqueteSeleccionadoId = id;
  renderPaquetes();
  cancelarEdicion();

  const paquete = paquetes.find(p => p.id === id);
  sinPaqueteHint.style.display = 'none';
  productoForm.style.display = 'flex';
  formTitle.textContent = 'Nuevo producto en "' + paquete.nombre + '"';
  productosCard.style.display = 'block';
  productosTitle.textContent = 'Productos de "' + paquete.nombre + '"';
  buscarProductoInput.disabled = false;
  buscarProductoInput.placeholder = 'Buscar producto para editar (nombre o código)...';
  buscarProductoInput.value = '';
  ocultarResultadosBusqueda();

  await cargarProductosDelPaquete(id);
}

async function cargarProductosDelPaquete(paqueteId) {
  try {
    productosDelPaquete = await apiFetch('/productos?paqueteId=' + paqueteId);
    renderProductos();
  } catch (e) {
    productosBody.innerHTML = '';
    sinProductosHint.style.display = 'block';
    sinProductosHint.textContent = 'Error cargando productos: ' + e.message;
  }
}

function renderProductos() {
  productosBody.innerHTML = '';

  if (productosDelPaquete.length === 0) {
    sinProductosHint.style.display = 'block';
    sinProductosHint.textContent = 'Este paquete todavía no tiene productos.';
    return;
  }
  sinProductosHint.style.display = 'none';

  productosDelPaquete.forEach(prod => {
    const tr = document.createElement('tr');

    const precioTexto = textoPrecioProducto(prod);
    const cantidadTexto = prod.tipoPrecio === 'PESO'
      ? Number(prod.cantidad).toLocaleString('es-CO') + ' kg'
      : Number(prod.cantidad).toLocaleString('es-CO') + ' und';

    tr.innerHTML =
      '<td>' + prod.nombre + '</td>' +
      '<td><span class="badge ' + (prod.tipoPrecio === 'PESO' ? 'badge-purple' : 'badge-green') + '">' + (prod.tipoPrecio === 'PESO' ? 'Por peso' : 'Fijo') + '</span></td>' +
      '<td>' + precioTexto + '</td>' +
      '<td>' + cantidadTexto + '</td>' +
      '<td style="font-family:monospace;font-size:.75rem;">' + prod.codigoBarras + '</td>' +
      '<td><div class="row-actions"></div></td>';

    const rowActions = tr.querySelector('.row-actions');

    const btnEliminar = document.createElement('div');
    btnEliminar.className = 'icon-btn danger';
    btnEliminar.title = 'Eliminar';
    btnEliminar.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
    btnEliminar.addEventListener('click', () => eliminarProducto(prod.id));
    rowActions.appendChild(btnEliminar);

    productosBody.appendChild(tr);
  });
}

// Arma el texto de precio de la tabla según la modalidad de venta del producto.
function textoPrecioProducto(prod) {
  if (prod.tipoPrecio === 'PESO') {
    return formatearPrecio(prod.precio) + ' / kg';
  }
  const partes = [];
  if (prod.ventaPorUnidad && prod.precio != null) {
    partes.push(formatearPrecio(prod.precio) + ' / und');
  }
  if (prod.ventaPorPaquete && prod.precioPaquete != null) {
    partes.push(formatearPrecio(prod.precioPaquete) + ' / paq (' + prod.unidadesPorPaquete + ' und)');
  }
  return partes.length ? partes.join(' · ') : formatearPrecio(prod.precio);
}

// ── Selector FIJO / PESO ────────────────────────────────────
function seleccionarTipoPrecio(tipo) {
  tipoPrecioActual = tipo;
  optFijo.classList.toggle('active', tipo === 'FIJO');
  optPeso.classList.toggle('active', tipo === 'PESO');

  if (tipo === 'PESO') {
    modalidadVentaWrap.style.display = 'none';
    filaPaquete.style.display = 'none';
    campoPrecioUnidad.style.display = 'block';
    precioLabel.textContent = 'PRECIO POR KILO ($/KG)';
    document.getElementById('precio').placeholder = '$0 por kg';
    cantidadLabel.textContent = 'CANTIDAD DISPONIBLE (KG)';
    document.getElementById('cantidad').placeholder = '0.0 kg';
  } else {
    modalidadVentaWrap.style.display = 'block';
    cantidadLabel.textContent = 'UNIDADES DISPONIBLES';
    document.getElementById('cantidad').placeholder = '0';
    actualizarModalidadVenta();
  }
}
optFijo.addEventListener('click', () => seleccionarTipoPrecio('FIJO'));
optPeso.addEventListener('click', () => seleccionarTipoPrecio('PESO'));

// ── Selector modalidad de venta: por unidad y/o por paquete ──
// Ambas se pueden activar al tiempo (ej: la tienda que vende individual o por paquete);
// solo una está permitida como mínimo (no se puede desactivar la última que queda activa).
function actualizarModalidadVenta() {
  optPorUnidad.classList.toggle('active', ventaPorUnidadActual);
  optPorPaquete.classList.toggle('active', ventaPorPaqueteActual);
  campoPrecioUnidad.style.display = ventaPorUnidadActual ? 'block' : 'none';
  filaPaquete.style.display = ventaPorPaqueteActual ? 'flex' : 'none';
  precioLabel.textContent = 'PRECIO POR UNIDAD ($)';
}

optPorUnidad.addEventListener('click', () => {
  if (ventaPorUnidadActual && !ventaPorPaqueteActual) {
    mostrarMsg(formMsg, 'Debe quedar activa al menos una modalidad de venta.', 'error');
    return;
  }
  ventaPorUnidadActual = !ventaPorUnidadActual;
  mostrarMsg(formMsg, '', '');
  actualizarModalidadVenta();
});

optPorPaquete.addEventListener('click', () => {
  if (ventaPorPaqueteActual && !ventaPorUnidadActual) {
    mostrarMsg(formMsg, 'Debe quedar activa al menos una modalidad de venta.', 'error');
    return;
  }
  ventaPorPaqueteActual = !ventaPorPaqueteActual;
  mostrarMsg(formMsg, '', '');
  actualizarModalidadVenta();
});

// ── Guardar producto (crear o editar) ───────────────────────
document.getElementById('btnGuardar').addEventListener('click', async () => {
  const nombre = document.getElementById('nombre').value.trim();
  const precioTexto = document.getElementById('precio').value;
  const cantidadTexto = document.getElementById('cantidad').value;
  const precioPaqueteTexto = precioPaqueteInput.value;
  const unidadesPorPaqueteTexto = unidadesPorPaqueteInput.value;

  if (!paqueteSeleccionadoId) {
    mostrarMsg(formMsg, 'Selecciona un paquete primero.', 'error');
    return;
  }
  if (!nombre || cantidadTexto === '') {
    mostrarMsg(formMsg, 'Completa el nombre y la cantidad.', 'error');
    return;
  }
  if (tipoPrecioActual === 'FIJO' && !ventaPorUnidadActual && !ventaPorPaqueteActual) {
    mostrarMsg(formMsg, 'Selecciona si se vende por unidad, por paquete, o ambas.', 'error');
    return;
  }
  if (tipoPrecioActual === 'PESO' && !precioTexto) {
    mostrarMsg(formMsg, 'Indica el precio por kilo.', 'error');
    return;
  }
  if (tipoPrecioActual === 'FIJO' && ventaPorUnidadActual && !precioTexto) {
    mostrarMsg(formMsg, 'Indica el precio por unidad.', 'error');
    return;
  }
  if (tipoPrecioActual === 'FIJO' && ventaPorPaqueteActual && (!precioPaqueteTexto || !unidadesPorPaqueteTexto)) {
    mostrarMsg(formMsg, 'Indica el precio del paquete y cuántas unidades trae.', 'error');
    return;
  }

  // La cantidad sí puede llevar decimales si el producto se vende por peso (kg).
  const cantidad = parseNumeroCO(cantidadTexto, tipoPrecioActual === 'PESO');
  if (isNaN(cantidad)) {
    mostrarMsg(formMsg, 'Revisa la cantidad, tiene un formato no válido.', 'error');
    return;
  }

  const body = {
    paqueteId: paqueteSeleccionadoId,
    nombre: nombre,
    tipoPrecio: tipoPrecioActual,
    cantidad: cantidad
  };

  if (tipoPrecioActual === 'PESO') {
    // El precio en pesos colombianos no maneja decimales -> el punto siempre es de miles.
    const precio = parseNumeroCO(precioTexto, false);
    if (isNaN(precio)) {
      mostrarMsg(formMsg, 'Revisa el precio, tiene un formato no válido.', 'error');
      return;
    }
    body.precio = precio;
  } else {
    body.ventaPorUnidad = ventaPorUnidadActual;
    body.ventaPorPaquete = ventaPorPaqueteActual;

    if (ventaPorUnidadActual) {
      const precio = parseNumeroCO(precioTexto, false);
      if (isNaN(precio)) {
        mostrarMsg(formMsg, 'Revisa el precio por unidad, tiene un formato no válido.', 'error');
        return;
      }
      body.precio = precio;
    }

    if (ventaPorPaqueteActual) {
      const precioPaquete = parseNumeroCO(precioPaqueteTexto, false);
      const unidadesPorPaquete = parseInt(unidadesPorPaqueteTexto, 10);
      if (isNaN(precioPaquete) || isNaN(unidadesPorPaquete) || unidadesPorPaquete <= 0) {
        mostrarMsg(formMsg, 'Revisa el precio del paquete y las unidades que trae.', 'error');
        return;
      }
      body.precioPaquete = precioPaquete;
      body.unidadesPorPaquete = unidadesPorPaquete;
    }
  }

  try {
    let resultado;
    if (editandoProductoId) {
      resultado = await apiFetch('/productos/' + editandoProductoId, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
      mostrarMsg(formMsg, 'Producto actualizado. Código de barras: ' + resultado.codigoBarras, 'ok');
      registrarHistorial('EDITADO', resultado);
    } else {
      resultado = await apiFetch('/productos', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      mostrarMsg(formMsg, 'Producto guardado. Código de barras generado: ' + resultado.codigoBarras, 'ok');
      registrarHistorial('CREADO', resultado);
    }

    cancelarEdicion();
    await cargarPaquetes();
    await cargarProductosDelPaquete(paqueteSeleccionadoId);
  } catch (e) {
    mostrarMsg(formMsg, e.message, 'error');
  }
});

function cargarProductoEnFormulario(prod) {
  editandoProductoId = prod.id;
  document.getElementById('nombre').value = prod.nombre;
  document.getElementById('cantidad').value = prod.cantidad;

  if (prod.tipoPrecio === 'PESO') {
    document.getElementById('precio').value = prod.precio != null ? prod.precio : '';
    seleccionarTipoPrecio('PESO');
  } else {
    ventaPorUnidadActual = prod.ventaPorUnidad !== false;
    ventaPorPaqueteActual = !!prod.ventaPorPaquete;
    if (!ventaPorUnidadActual && !ventaPorPaqueteActual) ventaPorUnidadActual = true;
    document.getElementById('precio').value = prod.precio != null ? prod.precio : '';
    precioPaqueteInput.value = prod.precioPaquete != null ? prod.precioPaquete : '';
    unidadesPorPaqueteInput.value = prod.unidadesPorPaquete != null ? prod.unidadesPorPaquete : '';
    seleccionarTipoPrecio('FIJO');
  }

  formTitle.textContent = 'Editando "' + prod.nombre + '"';
  btnCancelarEdicion.style.display = 'inline-flex';
  mostrarMsg(formMsg, '', '');
  buscarProductoInput.value = '';
  ocultarResultadosBusqueda();
  productoForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelarEdicion() {
  editandoProductoId = null;
  document.getElementById('nombre').value = '';
  document.getElementById('precio').value = '';
  document.getElementById('cantidad').value = '';
  precioPaqueteInput.value = '';
  unidadesPorPaqueteInput.value = '';
  ventaPorUnidadActual = true;
  ventaPorPaqueteActual = false;
  seleccionarTipoPrecio('FIJO');
  btnCancelarEdicion.style.display = 'none';
  const paquete = paquetes.find(p => p.id === paqueteSeleccionadoId);
  if (paquete) formTitle.textContent = 'Nuevo producto en "' + paquete.nombre + '"';
  mostrarMsg(formMsg, '', '');
}
btnCancelarEdicion.addEventListener('click', cancelarEdicion);

// ── Buscador de productos para editar ────────────────────────
function ocultarResultadosBusqueda() {
  buscarResultados.classList.remove('visible');
  buscarResultados.innerHTML = '';
}

function renderResultadosBusqueda(texto) {
  const q = texto.trim().toLowerCase();
  if (!q) { ocultarResultadosBusqueda(); return; }

  const coincidencias = productosDelPaquete.filter(p =>
    p.nombre.toLowerCase().includes(q) || (p.codigoBarras || '').toLowerCase().includes(q)
  );

  buscarResultados.innerHTML = '';
  if (coincidencias.length === 0) {
    const vacio = document.createElement('div');
    vacio.className = 'buscar-resultado-vacio';
    vacio.textContent = 'Ningún producto coincide con esa búsqueda.';
    buscarResultados.appendChild(vacio);
  } else {
    coincidencias.forEach(prod => {
      const item = document.createElement('div');
      item.className = 'buscar-resultado-item';
      item.innerHTML =
        '<div class="nombre">' + prod.nombre + '</div>' +
        '<div class="detalle">' + textoPrecioProducto(prod) + ' · ' + prod.codigoBarras + '</div>';
      item.addEventListener('click', () => cargarProductoEnFormulario(prod));
      buscarResultados.appendChild(item);
    });
  }
  buscarResultados.classList.add('visible');
}

buscarProductoInput.addEventListener('input', () => renderResultadosBusqueda(buscarProductoInput.value));
buscarProductoInput.addEventListener('focus', () => {
  if (buscarProductoInput.value.trim()) renderResultadosBusqueda(buscarProductoInput.value);
});
document.addEventListener('click', (e) => {
  if (!buscarEditarWrap.contains(e.target)) ocultarResultadosBusqueda();
});

// ── Eliminar producto ───────────────────────────────────────
async function eliminarProducto(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  const prodEliminado = productosDelPaquete.find(p => p.id === id);
  try {
    await apiFetch('/productos/' + id, { method: 'DELETE' });
    if (prodEliminado) registrarHistorial('ELIMINADO', prodEliminado);
    await cargarPaquetes();
    await cargarProductosDelPaquete(paqueteSeleccionadoId);
  } catch (e) {
    alert('No se pudo eliminar: ' + e.message);
  }
}

// ── Eliminar paquete completo ────────────────────────────────
btnEliminarPaquete.addEventListener('click', async () => {
  if (!paqueteSeleccionadoId) return;
  const paquete = paquetes.find(p => p.id === paqueteSeleccionadoId);
  if (!confirm('¿Eliminar el paquete "' + paquete.nombre + '" y todos sus productos?')) return;

  try {
    await apiFetch('/paquetes/' + paqueteSeleccionadoId, { method: 'DELETE' });
    registrarHistorialPaquete('PAQUETE_ELIMINADO', paquete);
    paqueteSeleccionadoId = null;
    productoForm.style.display = 'none';
    productosCard.style.display = 'none';
    buscarProductoInput.value = '';
    buscarProductoInput.disabled = true;
    buscarProductoInput.placeholder = 'Selecciona un paquete para buscar...';
    ocultarResultadosBusqueda();
    sinPaqueteHint.style.display = 'block';
    await cargarPaquetes();
  } catch (e) {
    alert('No se pudo eliminar el paquete: ' + e.message);
  }
});

// ── Modal nuevo paquete ──────────────────────────────────────
function abrirModalPaquete() {
  document.getElementById('nuevoPaqueteNombre').value = '';
  document.getElementById('nuevoPaqueteDescripcion').value = '';
  mostrarMsg(modalPaqueteMsg, '', '');
  modalPaquete.classList.remove('hidden');
}
document.getElementById('btnCancelarPaquete').addEventListener('click', () => modalPaquete.classList.add('hidden'));

document.getElementById('btnConfirmarPaquete').addEventListener('click', async () => {
  const nombre = document.getElementById('nuevoPaqueteNombre').value.trim();
  const descripcion = document.getElementById('nuevoPaqueteDescripcion').value.trim();

  if (!nombre) {
    mostrarMsg(modalPaqueteMsg, 'El nombre del paquete es obligatorio.', 'error');
    return;
  }

  try {
    const nuevo = await apiFetch('/paquetes', {
      method: 'POST',
      body: JSON.stringify({ nombre: nombre, descripcion: descripcion })
    });
    modalPaquete.classList.add('hidden');
    registrarHistorialPaquete('PAQUETE_CREADO', nuevo);
    await cargarPaquetes();
    await seleccionarPaquete(nuevo.id);
  } catch (e) {
    mostrarMsg(modalPaqueteMsg, e.message, 'error');
  }
});

// ── Historial reciente (guardado en este navegador) ──────────
const HISTORIAL_KEY = 'capcob_historial_productos';
const HISTORIAL_MAX = 30;
const historialLista = document.getElementById('historialLista');

const ETIQUETAS_HISTORIAL = {
  CREADO: { texto: 'registró', clase: 'creado' },
  EDITADO: { texto: 'editó', clase: 'editado' },
  ELIMINADO: { texto: 'eliminó', clase: 'eliminado' },
  PAQUETE_CREADO: { texto: 'creó el paquete', clase: 'creado' },
  PAQUETE_ELIMINADO: { texto: 'eliminó el paquete', clase: 'eliminado' }
};

function leerHistorial() {
  try {
    const datos = JSON.parse(localStorage.getItem(HISTORIAL_KEY) || '[]');
    return Array.isArray(datos) ? datos : [];
  } catch (e) {
    return [];
  }
}

function guardarHistorial(lista) {
  try {
    localStorage.setItem(HISTORIAL_KEY, JSON.stringify(lista.slice(0, HISTORIAL_MAX)));
  } catch (e) { /* si el navegador no deja guardar, el historial simplemente no se conserva */ }
}

function registrarHistorial(accion, prod) {
  const lista = leerHistorial();
  lista.unshift({
    accion: accion,
    nombre: prod.nombre,
    productoId: prod.id,
    paqueteId: prod.paqueteId,
    paquete: prod.paqueteNombre,
    detalle: textoPrecioProducto(prod),
    usuario: sessionStorage.getItem('username') || '',
    fecha: new Date().toISOString()
  });
  guardarHistorial(lista);
  renderHistorial();
}

function registrarHistorialPaquete(accion, paquete) {
  const lista = leerHistorial();
  lista.unshift({
    accion: accion,
    nombre: paquete.nombre,
    productoId: null,
    paqueteId: paquete.id,
    paquete: paquete.nombre,
    detalle: '',
    usuario: sessionStorage.getItem('username') || '',
    fecha: new Date().toISOString()
  });
  guardarHistorial(lista);
  renderHistorial();
}

function formatearFechaHistorial(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function renderHistorial() {
  const lista = leerHistorial();
  historialLista.innerHTML = '';

  if (lista.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'empty-hint';
    vacio.textContent = 'Aún no hay movimientos. Aquí aparecerán los productos que registres, edites o elimines.';
    historialLista.appendChild(vacio);
    return;
  }

  lista.forEach(item => {
    const etiqueta = ETIQUETAS_HISTORIAL[item.accion] || { texto: item.accion, clase: 'editado' };
    // Solo se puede reabrir para editar un producto que no fue eliminado.
    const reabrible = item.productoId && item.accion !== 'ELIMINADO';

    const fila = document.createElement('div');
    fila.className = 'historial-item' + (reabrible ? ' clickable' : '');
    if (reabrible) fila.title = 'Clic para editar este producto';

    const punto = document.createElement('span');
    punto.className = 'historial-punto ' + etiqueta.clase;

    const cuerpo = document.createElement('div');
    cuerpo.className = 'historial-cuerpo';

    const titulo = document.createElement('div');
    titulo.className = 'historial-titulo';
    const quien = item.usuario ? item.usuario + ' ' : '';
    const accion = document.createElement('span');
    accion.className = 'accion';
    accion.textContent = quien + etiqueta.texto + ' ';
    titulo.appendChild(accion);
    titulo.appendChild(document.createTextNode(item.nombre));

    const detalle = document.createElement('div');
    detalle.className = 'historial-detalle';
    detalle.textContent = [item.paquete ? 'Paquete: ' + item.paquete : '', item.detalle].filter(Boolean).join(' · ');

    cuerpo.appendChild(titulo);
    if (detalle.textContent) cuerpo.appendChild(detalle);

    const fecha = document.createElement('div');
    fecha.className = 'historial-fecha';
    fecha.textContent = formatearFechaHistorial(item.fecha);

    fila.appendChild(punto);
    fila.appendChild(cuerpo);
    fila.appendChild(fecha);

    if (reabrible) fila.addEventListener('click', () => abrirDesdeHistorial(item));
    historialLista.appendChild(fila);
  });
}

async function abrirDesdeHistorial(item) {
  try {
    if (item.paqueteId !== paqueteSeleccionadoId) await seleccionarPaquete(item.paqueteId);
    const prod = productosDelPaquete.find(p => p.id === item.productoId);
    if (prod) {
      cargarProductoEnFormulario(prod);
    } else {
      alert('Ese producto ya no existe (pudo haber sido eliminado).');
    }
  } catch (e) {
    alert('No se pudo abrir el producto: ' + e.message);
  }
}

document.getElementById('btnLimpiarHistorial').addEventListener('click', () => {
  if (!confirm('¿Borrar el historial reciente de este navegador?')) return;
  guardarHistorial([]);
  renderHistorial();
});

// ── Inicio ───────────────────────────────────────────────────
renderHistorial();
cargarPaquetes();