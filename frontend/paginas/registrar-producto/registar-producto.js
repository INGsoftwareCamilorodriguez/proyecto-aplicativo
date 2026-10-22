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
let imagenActual = null;          // data URL de la foto del producto (o null)
const PRODUCTOS_POR_PAGINA = 5;
let paginaProductos = 1;
let todosLosProductos = null;     // caché para el buscador (todos los paquetes)

// ── Elementos ───────────────────────────────────────────────
const paquetesRow = document.getElementById('paquetesRow');
const sinPaqueteHint = document.getElementById('sinPaqueteHint');
const productoForm = document.getElementById('productoForm');
const formTitle = document.getElementById('formTitle');
const formMsg = document.getElementById('formMsg');
const productosCard = document.getElementById('productosCard');
const sinProductosCard = document.getElementById('sinProductosCard');
const productosTitle = document.getElementById('productosTitle');
const productosBody = document.getElementById('productosBody');
const sinProductosHint = document.getElementById('sinProductosHint');
const btnEliminarPaquete = document.getElementById('btnEliminarPaquete');
const paginacionEl = document.getElementById('paginacion');
const pagInfo = document.getElementById('pagInfo');
const btnPagAnterior = document.getElementById('btnPagAnterior');
const btnPagSiguiente = document.getElementById('btnPagSiguiente');
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

const imagenPreview = document.getElementById('imagenPreview');
const imagenPreviewImg = document.getElementById('imagenPreviewImg');
const imagenInput = document.getElementById('imagenInput');
const btnSubirImagen = document.getElementById('btnSubirImagen');
const btnQuitarImagen = document.getElementById('btnQuitarImagen');

const buscarEditarWrap = document.getElementById('buscarEditarWrap');
const buscarProductoInput = document.getElementById('buscarProductoInput');
const buscarResultados = document.getElementById('buscarResultados');

const modalPaquete = document.getElementById('modalPaquete');
const modalPaqueteMsg = document.getElementById('modalPaqueteMsg');

// ── Utilidades ──────────────────────────────────────────────
// ── Nombres largos: el texto "recorre" despacio en vez de agrandar el cuadro ──
const MAX_NOMBRE_PRODUCTO = 150; // igual que la columna en la base de datos
const MAX_NOMBRE_CATEGORIA = 100;
const CATEGORIAS_POR_PAGINA = 6;

function marquesina(el, texto) {
  el.classList.add('marquesina');
  el.textContent = '';
  const inner = document.createElement('span');
  inner.className = 'marq-txt';
  inner.textContent = texto;
  el.appendChild(inner);
  el.title = texto;
  requestAnimationFrame(() => medirMarquesina(el));
}

function medirMarquesina(el) {
  const inner = el.firstElementChild;
  if (!inner || el.clientWidth === 0) return;
  el.classList.remove('corre');
  const extra = inner.scrollWidth - el.clientWidth;
  if (extra > 2) {
    const px = extra + 6;
    el.style.setProperty('--marq-dist', '-' + px + 'px');
    el.style.setProperty('--marq-dur', Math.max(5, px / 22 / 0.7).toFixed(1) + 's');
    el.classList.add('corre');
  }
}
window.addEventListener('resize', () => document.querySelectorAll('.marquesina').forEach(medirMarquesina));

// Título con prefijo fijo y nombre entre comillas que se desplaza si no cabe.
function ponerTitulo(el, prefijo, nombre) {
  el.classList.add('titulo-marq');
  el.textContent = '';
  const pre = document.createElement('span');
  pre.className = 'tit-pre';
  pre.textContent = prefijo;
  const nom = document.createElement('span');
  nom.className = 'tit-nombre';
  el.appendChild(pre);
  el.appendChild(nom);
  marquesina(nom, '"' + nombre + '"');
}

function mostrarMsg(el, texto, tipo) {
  el.textContent = texto;
  el.className = 'form-msg ' + (tipo || '');
}

async function apiFetch(path, options) {
  const headers = { 'Content-Type': 'application/json' };
  const usuario = sessionStorage.getItem('username');
  // El backend usa este encabezado para anotar quién hizo cada movimiento en el historial.
  if (usuario) headers['X-Usuario'] = encodeURIComponent(usuario);
  const res = await fetch(API_BASE_URL + path, Object.assign({ headers: headers }, options));
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
    paquetesRow.innerHTML = '<span class="empty-hint">No se pudieron cargar las categorías: ' + e.message + '</span>';
  }
}

let paginaCategorias = 1;
let filtroCategorias = '';

function normalizarTexto(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function renderPaquetes() {
  paquetesRow.innerHTML = '';

  const q = normalizarTexto(filtroCategorias.trim());
  const filtradas = paquetes.filter(p => !q || normalizarTexto(p.nombre).includes(q));
  const total = filtradas.length;
  const totalPaginas = Math.max(1, Math.ceil(total / CATEGORIAS_POR_PAGINA));
  if (paginaCategorias > totalPaginas) paginaCategorias = totalPaginas;
  if (paginaCategorias < 1) paginaCategorias = 1;
  const inicio = (paginaCategorias - 1) * CATEGORIAS_POR_PAGINA;

  if (paquetes.length === 0 || total === 0) {
    const hint = document.createElement('span');
    hint.className = 'empty-hint';
    hint.textContent = paquetes.length === 0 ? 'Todavía no hay categorías creadas.' : 'No hay categorías que coincidan con la búsqueda.';
    paquetesRow.appendChild(hint);
  }

  filtradas.slice(inicio, inicio + CATEGORIAS_POR_PAGINA).forEach(p => {
    const pill = document.createElement('div');
    pill.className = 'paquete-pill' + (p.id === paqueteSeleccionadoId ? ' active' : '');
    const nombre = document.createElement('span');
    nombre.className = 'pill-nombre';
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = p.totalProductos;
    pill.appendChild(nombre);
    pill.appendChild(count);
    marquesina(nombre, p.nombre);
    pill.addEventListener('click', () => seleccionarPaquete(p.id));
    paquetesRow.appendChild(pill);
  });

  // Pie: conteo + flechas (solo si hay más de una página)
  document.getElementById('catFooter').style.display = total > CATEGORIAS_POR_PAGINA ? 'flex' : 'none';
  document.getElementById('catInfo').textContent =
    'Mostrando ' + (total === 0 ? 0 : inicio + 1) + '–' + Math.min(inicio + CATEGORIAS_POR_PAGINA, total) + ' de ' + total + ' categorías';
  document.getElementById('btnCatAnterior').disabled = paginaCategorias <= 1;
  document.getElementById('btnCatSiguiente').disabled = paginaCategorias >= totalPaginas;
}

document.getElementById('buscarCategoriaInput').addEventListener('input', (e) => {
  filtroCategorias = e.target.value;
  paginaCategorias = 1;
  renderPaquetes();
});
document.getElementById('btnNuevaCategoria').addEventListener('click', () => abrirModalPaquete());
document.getElementById('btnCatAnterior').addEventListener('click', () => { paginaCategorias--; renderPaquetes(); });
document.getElementById('btnCatSiguiente').addEventListener('click', () => { paginaCategorias++; renderPaquetes(); });

// ── Seleccionar paquete ─────────────────────────────────────
async function seleccionarPaquete(id) {
  paqueteSeleccionadoId = id;
  paginaProductos = 1;
  renderPaquetes();
  cancelarEdicion();

  const paquete = paquetes.find(p => p.id === id);
  sinPaqueteHint.style.display = 'none';
  productoForm.style.display = 'flex';
  actualizarCampoCodigo();
  ponerTitulo(formTitle, 'Nuevo producto en', paquete.nombre);
  productosCard.style.display = 'block';
  sinProductosCard.style.display = 'none';
  ponerTitulo(productosTitle, 'Productos de', paquete.nombre);
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

  const total = productosDelPaquete.length;
  const totalPaginas = Math.max(1, Math.ceil(total / PRODUCTOS_POR_PAGINA));
  if (paginaProductos > totalPaginas) paginaProductos = totalPaginas;
  if (paginaProductos < 1) paginaProductos = 1;
  renderPaginacion(total, totalPaginas);

  if (productosDelPaquete.length === 0) {
    sinProductosHint.style.display = 'block';
    sinProductosHint.textContent = 'Esta categoría todavía no tiene productos.';
    return;
  }
  sinProductosHint.style.display = 'none';

  const inicio = (paginaProductos - 1) * PRODUCTOS_POR_PAGINA;
  productosDelPaquete.slice(inicio, inicio + PRODUCTOS_POR_PAGINA).forEach(prod => {
    const tr = document.createElement('tr');

    const precioTexto = textoPrecioProducto(prod);
    const cantidadTexto = prod.tipoPrecio === 'PESO'
      ? Number(prod.cantidad).toLocaleString('es-CO') + ' kg'
      : Number(prod.cantidad).toLocaleString('es-CO') + ' und';

    tr.innerHTML =
      '<td class="celda-prod"></td>' +
      '<td class="celda-nombre"></td>' +
      '<td><span class="badge ' + (prod.tipoPrecio === 'PESO' ? 'badge-purple' : 'badge-green') + '">' + (prod.tipoPrecio === 'PESO' ? 'Por peso' : 'Fijo') + '</span></td>' +
      '<td>' + precioTexto + '</td>' +
      '<td>' + cantidadTexto + '</td>' +
      '<td style="font-family:monospace;font-size:.75rem;">' + prod.codigoBarras + '</td>' +
      '<td class="celda-barras"></td>' +
      '<td><div class="row-actions"></div></td>';

    tr.querySelector('.celda-prod').appendChild(crearMiniatura(prod));
    tr.querySelector('.celda-nombre').appendChild(crearCeldaNombre(prod));
    tr.querySelector('.celda-barras').appendChild(crearCeldaBarras(prod));

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

// Miniatura (o inicial si no tiene foto) + nombre del producto.
function crearMiniatura(prod) {
  if (prod.imagen) {
    const img = document.createElement('img');
    img.className = 'prod-thumb';
    img.alt = '';
    img.src = prod.imagen;
    return img;
  }
  const vacio = document.createElement('div');
  vacio.className = 'prod-thumb vacio';
  vacio.textContent = (prod.nombre || '?').trim().charAt(0).toUpperCase();
  return vacio;
}

// Nombre del producto (si es muy largo, el texto recorre despacio en vez de agrandar la celda).
function crearCeldaNombre(prod) {
  const nombre = document.createElement('div');
  nombre.className = 'prod-nombre-txt';
  marquesina(nombre, prod.nombre);
  return nombre;
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
  document.getElementById('pesoHint').style.display = tipo === 'PESO' ? 'block' : 'none';

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
  actualizarCampoCodigo();
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
    mostrarMsg(formMsg, 'Selecciona una categoría primero.', 'error');
    return;
  }
  if (!nombre || cantidadTexto === '') {
    mostrarMsg(formMsg, 'Completa el nombre y la cantidad.', 'error');
    return;
  }
  if (nombre.length > MAX_NOMBRE_PRODUCTO) {
    mostrarMsg(formMsg, 'Nombre de producto extenso (máximo ' + MAX_NOMBRE_PRODUCTO + ' caracteres).', 'error');
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
    cantidad: cantidad,
    imagen: imagenActual
  };

  // Código de barras que ya trae el producto (escaneado o tecleado). Vacío = el sistema genera uno.
  const codigoPropio = tipoPrecioActual === 'FIJO' ? regEl('codigoBarrasInput').value.trim() : '';
  if (codigoPropio) {
    if (!REG_CODIGO_RE.test(codigoPropio) || !/\d/.test(codigoPropio)) {
      mostrarMsg(formMsg, 'El código de barras no es válido (6 a 20 caracteres: números, letras o guiones).', 'error');
      return;
    }
    body.codigoBarras = codigoPropio;
  }

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
    let mensajeOk;
    if (editandoProductoId) {
      resultado = await apiFetch('/productos/' + editandoProductoId, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
      mensajeOk = 'Producto actualizado. Código de barras: ' + resultado.codigoBarras;
    } else {
      resultado = await apiFetch('/productos', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      mensajeOk = codigoPropio
        ? 'Producto guardado con el código de barras ' + resultado.codigoBarras
        : 'Producto guardado. Código de barras generado: ' + resultado.codigoBarras;
    }

    cancelarEdicion();
    mostrarMsg(formMsg, mensajeOk, 'ok');
    todosLosProductos = null;
    await cargarPaquetes();
    await cargarProductosDelPaquete(paqueteSeleccionadoId);
    cargarHistorial();
  } catch (e) {
    mostrarMsg(formMsg, e.message, 'error');
  }
});

function cargarProductoEnFormulario(prod) {
  editandoProductoId = prod.id;
  regCodigoActual = prod.codigoBarras || null;   // se conserva si no se escanea otro
  regEl('codigoBarrasInput').value = '';
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

  imagenActual = prod.imagen || null;
  pintarImagen();

  ponerTitulo(formTitle, 'Editando', prod.nombre);
  btnCancelarEdicion.style.display = 'inline-flex';
  mostrarMsg(formMsg, '', '');
  buscarProductoInput.value = '';
  ocultarResultadosBusqueda();
  productoForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelarEdicion() {
  editandoProductoId = null;
  regCodigoActual = null;
  regEl('codigoBarrasInput').value = '';
  document.getElementById('nombre').value = '';
  document.getElementById('precio').value = '';
  document.getElementById('cantidad').value = '';
  precioPaqueteInput.value = '';
  unidadesPorPaqueteInput.value = '';
  ventaPorUnidadActual = true;
  ventaPorPaqueteActual = false;
  imagenActual = null;
  imagenInput.value = '';
  pintarImagen();
  seleccionarTipoPrecio('FIJO');
  btnCancelarEdicion.style.display = 'none';
  const paquete = paquetes.find(p => p.id === paqueteSeleccionadoId);
  if (paquete) ponerTitulo(formTitle, 'Nuevo producto en', paquete.nombre);
  mostrarMsg(formMsg, '', '');
}
btnCancelarEdicion.addEventListener('click', cancelarEdicion);

// ── Imagen del producto ──────────────────────────────────────
function pintarImagen() {
  if (imagenActual) {
    imagenPreviewImg.src = imagenActual;
    imagenPreview.classList.add('con-imagen');
    btnQuitarImagen.style.display = 'inline-flex';
    btnSubirImagen.textContent = 'Cambiar imagen';
  } else {
    imagenPreviewImg.removeAttribute('src');
    imagenPreview.classList.remove('con-imagen');
    btnQuitarImagen.style.display = 'none';
    btnSubirImagen.textContent = 'Subir imagen';
  }
}

// Reduce la foto a máx. 480px y la convierte a JPG liviano (queda en unos 30-80 KB).
function redimensionarImagen(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('El archivo debe ser una imagen (JPG, PNG o WEBP).'));
    }
    if (file.size > 10 * 1024 * 1024) {
      return reject(new Error('La imagen pesa demasiado (máximo 10 MB).'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo abrir la imagen.'));
      img.onload = () => {
        const max = 480;
        const escala = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * escala));
        canvas.height = Math.max(1, Math.round(img.height * escala));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; // los PNG con fondo transparente quedan sobre blanco
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

imagenPreview.addEventListener('click', () => imagenInput.click());
imagenPreview.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); imagenInput.click(); }
});
btnQuitarImagen.addEventListener('click', (e) => {
  e.stopPropagation(); // que no abra el selector de archivos
  imagenActual = null;
  imagenInput.value = '';
  pintarImagen();
});

async function procesarArchivoImagen(file) {
  if (!file) return;
  try {
    imagenActual = await redimensionarImagen(file);
    mostrarMsg(formMsg, '', '');
    pintarImagen();
  } catch (e) {
    mostrarMsg(formMsg, e.message, 'error');
  }
}
imagenInput.addEventListener('change', async () => {
  await procesarArchivoImagen(imagenInput.files && imagenInput.files[0]);
  imagenInput.value = '';
});

// Arrastrar y soltar una imagen sobre la zona
['dragenter', 'dragover'].forEach(ev => imagenPreview.addEventListener(ev, (e) => {
  e.preventDefault();
  imagenPreview.classList.add('arrastrando');
}));
['dragleave', 'drop'].forEach(ev => imagenPreview.addEventListener(ev, (e) => {
  e.preventDefault();
  imagenPreview.classList.remove('arrastrando');
}));
imagenPreview.addEventListener('drop', (e) => {
  procesarArchivoImagen(e.dataTransfer.files && e.dataTransfer.files[0]);
});

// ── Paginación de la tabla (5 productos por página) ───────────
function renderPaginacion(total, totalPaginas) {
  if (total <= PRODUCTOS_POR_PAGINA) {
    paginacionEl.style.display = 'none';
    return;
  }
  paginacionEl.style.display = 'flex';
  pagInfo.textContent = 'Página ' + paginaProductos + ' de ' + totalPaginas;
  btnPagAnterior.disabled = paginaProductos <= 1;
  btnPagSiguiente.disabled = paginaProductos >= totalPaginas;
}
btnPagAnterior.addEventListener('click', () => {
  if (paginaProductos > 1) { paginaProductos--; renderProductos(); }
});
btnPagSiguiente.addEventListener('click', () => {
  paginaProductos++;
  renderProductos();
});

// ── Buscador de productos (solo la categoría seleccionada) ───────────────
async function obtenerTodosLosProductos() {
  if (!todosLosProductos) {
    todosLosProductos = await apiFetch('/productos');
  }
  return todosLosProductos;
}

function ocultarResultadosBusqueda() {
  buscarResultados.classList.remove('visible');
  buscarResultados.innerHTML = '';
}

async function buscarCoincidencias(texto) {
  const q = texto.trim().toLowerCase();
  if (!q || !paqueteSeleccionadoId) return [];
  return productosDelPaquete.filter(p =>
    (p.nombre || '').toLowerCase().includes(q) ||
    (p.codigoBarras || '').toLowerCase().includes(q)
  );
}

async function renderResultadosBusqueda(texto) {
  if (!texto.trim() || !paqueteSeleccionadoId) { ocultarResultadosBusqueda(); return; }

  let coincidencias;
  try {
    coincidencias = await buscarCoincidencias(texto);
  } catch (e) {
    return;
  }
  // Si el usuario siguió escribiendo mientras cargaba, se ignora este resultado viejo.
  if (buscarProductoInput.value !== texto) return;

  buscarResultados.innerHTML = '';
  if (coincidencias.length === 0) {
    const vacio = document.createElement('div');
    vacio.className = 'buscar-resultado-vacio';
    vacio.textContent = 'Ningún producto de esta categoría coincide con esa búsqueda.';
    buscarResultados.appendChild(vacio);
  } else {
    coincidencias.slice(0, 30).forEach(prod => {
      const item = document.createElement('div');
      item.className = 'buscar-resultado-item';

      const info = document.createElement('div');
      info.className = 'info';
      const nombre = document.createElement('div');
      nombre.className = 'nombre';
      nombre.textContent = prod.nombre;
      const detalle = document.createElement('div');
      detalle.className = 'detalle';
      detalle.textContent = [textoPrecioProducto(prod), prod.codigoBarras].filter(Boolean).join(' · ');
      info.appendChild(nombre);
      info.appendChild(detalle);

      item.appendChild(crearMiniatura(prod));
      item.appendChild(info);
      item.addEventListener('click', () => abrirProducto(prod));
      buscarResultados.appendChild(item);
    });
  }
  buscarResultados.classList.add('visible');
}

// Abre un producto en el formulario, cambiando de paquete si hace falta.
async function abrirProducto(prod) {
  try {
    if (prod.paqueteId !== paqueteSeleccionadoId) await seleccionarPaquete(prod.paqueteId);
    const actual = productosDelPaquete.find(p => p.id === prod.id) || prod;
    cargarProductoEnFormulario(actual);
  } catch (e) {
    alert('No se pudo abrir el producto: ' + e.message);
  }
}

buscarProductoInput.addEventListener('input', () => renderResultadosBusqueda(buscarProductoInput.value));
buscarProductoInput.addEventListener('focus', () => {
  if (buscarProductoInput.value.trim()) renderResultadosBusqueda(buscarProductoInput.value);
});
// Enter (o el lector de códigos de barras, que termina con Enter): abre el código exacto, o el primer resultado.
buscarProductoInput.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const texto = buscarProductoInput.value.trim();
  if (!texto) return;
  try {
    const coincidencias = await buscarCoincidencias(texto);
    const exacto = coincidencias.find(p => p.codigoBarras === texto);
    const elegido = exacto || coincidencias[0];
    if (elegido) await abrirProducto(elegido);
  } catch (err) {
    alert('No se pudo buscar: ' + err.message);
  }
});
document.addEventListener('click', (e) => {
  if (!buscarEditarWrap.contains(e.target)) ocultarResultadosBusqueda();
});

// ── Eliminar producto ───────────────────────────────────────
async function eliminarProducto(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  try {
    await apiFetch('/productos/' + id, { method: 'DELETE' });
    todosLosProductos = null;
    await cargarPaquetes();
    await cargarProductosDelPaquete(paqueteSeleccionadoId);
    cargarHistorial();
  } catch (e) {
    alert('No se pudo eliminar: ' + e.message);
  }
}

// ── Eliminar paquete completo ────────────────────────────────
btnEliminarPaquete.addEventListener('click', async () => {
  if (!paqueteSeleccionadoId) return;
  const paquete = paquetes.find(p => p.id === paqueteSeleccionadoId);
  if (!confirm('¿Eliminar la categoría "' + paquete.nombre + '" y todos sus productos?')) return;

  try {
    await apiFetch('/paquetes/' + paqueteSeleccionadoId, { method: 'DELETE' });
    todosLosProductos = null;
    paqueteSeleccionadoId = null;
    productoForm.style.display = 'none';
    actualizarCampoCodigo();
    productosCard.style.display = 'none';
    sinProductosCard.style.display = 'flex';
    buscarProductoInput.value = '';
    ocultarResultadosBusqueda();
    sinPaqueteHint.style.display = 'block';
    await cargarPaquetes();
    cargarHistorial();
  } catch (e) {
    alert('No se pudo eliminar la categoría: ' + e.message);
  }
});

// ── Modal nuevo paquete ──────────────────────────────────────
function abrirModalPaquete() {
  document.getElementById('nuevoPaqueteNombre').value = '';
  mostrarMsg(modalPaqueteMsg, '', '');
  modalPaquete.classList.remove('hidden');
}
document.getElementById('btnCancelarPaquete').addEventListener('click', () => modalPaquete.classList.add('hidden'));

document.getElementById('btnConfirmarPaquete').addEventListener('click', async () => {
  const nombre = document.getElementById('nuevoPaqueteNombre').value.trim();

  if (!nombre) {
    mostrarMsg(modalPaqueteMsg, 'El nombre de la categoría es obligatorio.', 'error');
    return;
  }
  if (nombre.length > MAX_NOMBRE_CATEGORIA) {
    mostrarMsg(modalPaqueteMsg, 'Nombre de categoría extenso (máximo ' + MAX_NOMBRE_CATEGORIA + ' caracteres).', 'error');
    return;
  }

  try {
    const nuevo = await apiFetch('/paquetes', {
      method: 'POST',
      body: JSON.stringify({ nombre: nombre })
    });
    modalPaquete.classList.add('hidden');
    await cargarPaquetes();
    filtroCategorias = '';
    document.getElementById('buscarCategoriaInput').value = '';
    const pos = paquetes.findIndex(p => p.id === nuevo.id);
    if (pos >= 0) paginaCategorias = Math.floor(pos / CATEGORIAS_POR_PAGINA) + 1;
    await seleccionarPaquete(nuevo.id);
    cargarHistorial();
  } catch (e) {
    mostrarMsg(modalPaqueteMsg, e.message, 'error');
  }
});

// ── Historial reciente (guardado en la base de datos) ────────
const historialLista = document.getElementById('historialLista');

const ETIQUETAS_HISTORIAL = {
  CREADO: { texto: 'registró', clase: 'creado' },
  EDITADO: { texto: 'editó', clase: 'editado' },
  ELIMINADO: { texto: 'eliminó', clase: 'eliminado' },
  PAQUETE_CREADO: { texto: 'creó el paquete', clase: 'creado' },
  PAQUETE_ELIMINADO: { texto: 'eliminó el paquete', clase: 'eliminado' }
};

function formatearFechaHistorial(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function mostrarTextoHistorial(texto) {
  historialLista.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'empty-hint';
  p.textContent = texto;
  historialLista.appendChild(p);
}

async function cargarHistorial() {
  let lista;
  try {
    lista = await apiFetch('/historial-productos');
  } catch (e) {
    mostrarTextoHistorial('No se pudo cargar el historial. Revisa que la tabla historial_producto exista en la base de datos.');
    return;
  }
  renderHistorial(lista || []);
}

function renderHistorial(lista) {
  historialLista.innerHTML = '';

  if (lista.length === 0) {
    mostrarTextoHistorial('Aún no hay movimientos. Aquí aparecerán los productos que registres, edites o elimines.');
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
    const accion = document.createElement('span');
    accion.className = 'accion';
    accion.textContent = (item.usuario ? item.usuario + ' ' : '') + etiqueta.texto + ' ';
    titulo.appendChild(accion);
    titulo.appendChild(document.createTextNode(item.productoNombre));
    cuerpo.appendChild(titulo);

    const textoDetalle = [item.paqueteNombre && item.accion.indexOf('PAQUETE') !== 0 ? 'Paquete: ' + item.paqueteNombre : '', item.detalle]
      .filter(Boolean).join(' · ');
    if (textoDetalle) {
      const detalle = document.createElement('div');
      detalle.className = 'historial-detalle';
      detalle.textContent = textoDetalle;
      cuerpo.appendChild(detalle);
    }

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
    const todos = await obtenerTodosLosProductos();
    const prod = todos.find(p => p.id === item.productoId);
    if (!prod) {
      alert('Ese producto ya no existe (pudo haber sido eliminado).');
      return;
    }
    await abrirProducto(prod);
  } catch (e) {
    alert('No se pudo abrir el producto: ' + e.message);
  }
}

// ── Inicio ───────────────────────────────────────────────────
cargarHistorial();
// Refresca el historial cada 30 s para ver también lo que hagan otros usuarios.
setInterval(cargarHistorial, 30000);
cargarPaquetes();

// ── Imagen del código de barras (EAN-13) ─────────────────────
// La imagen se dibuja desde el número guardado (codigo-barras.js); no se guarda en la base de datos.
let barrasActual = null;   // { codigo, nombre } del código que muestra el modal

function crearCeldaBarras(prod) {
  const codigo = prod.codigoBarras || '';

  // Los productos por peso usan un PLU de 6 dígitos, que no es un EAN-13: no hay imagen.
  if (!CapcobBarras.esEAN13(codigo)) {
    const vacio = document.createElement('div');
    vacio.className = 'barras-vacio';
    vacio.textContent = '—';
    vacio.title = 'Sin imagen: solo se dibujan códigos EAN-13 (los productos por peso usan PLU de 6 dígitos y algunos productos de fábrica traen otro formato).';
    return vacio;
  }

  // Botón con el ícono de código de barras; al hacer clic se abre la imagen grande.
  const btn = document.createElement('div');
  btn.className = 'icon-btn barras-btn';
  btn.title = 'Ver código de barras';
  btn.innerHTML =
    '<svg viewBox="0 0 24 24">' +
      '<rect class="bc-fondo" x="2" y="5" width="20" height="14" rx="2.5"/>' +
      '<g class="bc-barras">' +
        '<line x1="5" y1="5" x2="5" y2="19" stroke-width="0.9"/>' +
        '<line x1="7.2" y1="5" x2="7.2" y2="19" stroke-width="1.6"/>' +
        '<line x1="10.2" y1="5" x2="10.2" y2="19" stroke-width="0.9"/>' +
        '<line x1="12.4" y1="5" x2="12.4" y2="19" stroke-width="2"/>' +
        '<line x1="15.4" y1="5" x2="15.4" y2="19" stroke-width="0.9"/>' +
        '<line x1="17.4" y1="5" x2="17.4" y2="19" stroke-width="1.4"/>' +
        '<line x1="19.7" y1="5" x2="19.7" y2="19" stroke-width="0.9"/>' +
      '</g>' +
    '</svg>';
  btn.addEventListener('click', () => abrirModalBarras(codigo, prod.nombre));
  return btn;
}

function abrirModalBarras(codigo, nombre) {
  barrasActual = { codigo: codigo, nombre: nombre };
  ponerTitulo(document.getElementById('modalBarrasTitulo'), 'Código de barras de ', nombre);
  document.getElementById('modalBarrasImagen').innerHTML = CapcobBarras.svg(codigo);
  document.getElementById('modalBarras').classList.remove('hidden');
}

function cerrarModalBarras() {
  document.getElementById('modalBarras').classList.add('hidden');
  barrasActual = null;
}

document.getElementById('btnCerrarBarras').addEventListener('click', cerrarModalBarras);
document.getElementById('modalBarras').addEventListener('click', (e) => {
  if (e.target.id === 'modalBarras') cerrarModalBarras();
});
document.getElementById('btnDescargarBarras').addEventListener('click', () => {
  if (barrasActual) CapcobBarras.descargarPNG(barrasActual.codigo, barrasActual.nombre);
});
document.getElementById('btnImprimirBarras').addEventListener('click', () => {
  if (barrasActual) CapcobBarras.imprimir(barrasActual.codigo, barrasActual.nombre);
});


// ══════════════════════════════════════════════════════════════
// CÓDIGO DE BARRAS QUE YA TRAE EL PRODUCTO (escaneo con cámara o lector)
// ──────────────────────────────────────────────────────────────
// Aquí la cámara NO busca un producto para venderlo (eso es la caja del empleado):
// solo LEE el código de fábrica para registrar el producto con ese mismo código.
// Si el campo queda vacío, el sistema genera uno como siempre.
// ══════════════════════════════════════════════════════════════
const REG_LS_ESCANEO = 'capcob_escaneo_registro';
const REG_CODIGO_RE = /^[0-9A-Za-z\-._]{6,20}$/;   // igual que el backend (columna de 20 caracteres)
var regCodigoActual = null;                         // código actual del producto que se está editando
var regEscaner = { qr: null, activa: false, procesando: false };

function regEl(id) { return document.getElementById(id); }

// Muestra/oculta el campo del código y el botón "Escanear producto" según el estado del formulario.
// Los productos por peso usan un PLU del sistema, así que ahí no aplica escanear.
function actualizarCampoCodigo() {
  const campo = regEl('campoCodigoBarras');
  const btn = regEl('btnEscanearProducto');
  const input = regEl('codigoBarrasInput');
  if (!campo || !btn || !input) return;

  const formVisible = productoForm.style.display !== 'none' && !!paqueteSeleccionadoId;
  const esPeso = tipoPrecioActual === 'PESO';
  if (esPeso) input.value = '';

  campo.style.display = esPeso ? 'none' : 'block';
  btn.style.display = (formVisible && !esPeso) ? 'inline-flex' : 'none';
  input.placeholder = (editandoProductoId && regCodigoActual)
    ? 'Vacío = se conserva el actual (' + regCodigoActual + ')'
    : 'Vacío = el sistema genera uno al guardar';
  regEl('btnQuitarCodigo').style.display = input.value ? 'inline-flex' : 'none';
}

regEl('codigoBarrasInput').addEventListener('input', () => {
  regEl('btnQuitarCodigo').style.display = regEl('codigoBarrasInput').value ? 'inline-flex' : 'none';
});
regEl('btnQuitarCodigo').addEventListener('click', () => {
  regEl('codigoBarrasInput').value = '';
  actualizarCampoCodigo();
  mostrarMsg(formMsg, '', '');
});
// El lector USB/Bluetooth escribe el código y manda Enter. Sin esto, el Enter dispararía "Guardar producto".
regEl('codigoBarrasInput').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  regAplicarCodigo(regEl('codigoBarrasInput').value);
});

// ── Preferencia de escaneo (se recuerda en este navegador) ──
function regGuardarPref(obj) { try { localStorage.setItem(REG_LS_ESCANEO, JSON.stringify(obj)); } catch (e) { /* sin almacenamiento */ } }
function regLeerPref() { try { return JSON.parse(localStorage.getItem(REG_LS_ESCANEO)) || {}; } catch (e) { return {}; } }
function regMsg(texto, error) {
  const el = regEl('escanerMsgReg');
  el.textContent = texto || '';
  el.className = 'form-msg ' + (error ? 'error' : '');
}

// ── Modal "¿Cómo quieres escanear?" ──
function regAbrirModalEscaner() {
  regMsg('');
  regEl('panelCamarasReg').hidden = true;
  regEl('escanerVista').style.display = 'none';
  regEl('escanerOpciones').style.display = 'grid';
  const pref = regLeerPref();
  document.querySelectorAll('#escanerOpciones .escaner-opt').forEach(b => b.classList.toggle('sel', b.dataset.opt === pref.opt));
  regEl('modalEscanerProducto').classList.remove('hidden');
}

async function regCerrarModalEscaner() {
  await regDetenerCamara();
  regEl('modalEscanerProducto').classList.add('hidden');
}

regEl('btnEscanearProducto').addEventListener('click', regAbrirModalEscaner);
regEl('btnCerrarEscaner').addEventListener('click', regCerrarModalEscaner);
regEl('modalEscanerProducto').addEventListener('click', (e) => {
  if (e.target.id === 'modalEscanerProducto') regCerrarModalEscaner();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !regEl('modalEscanerProducto').classList.contains('hidden')) regCerrarModalEscaner();
});
document.querySelectorAll('#escanerOpciones .escaner-opt').forEach(b => {
  b.addEventListener('click', () => regElegirOpcion(b.dataset.opt));
});
regEl('btnUsarCamaraReg').addEventListener('click', () => {
  const sel = regEl('selCamaraReg');
  if (!sel.value) return;
  regGuardarPref({ opt: 'camara-externa', camaraId: sel.value });
  regIniciarCamara(sel.value);
});

async function regElegirOpcion(opt) {
  regMsg('');
  regEl('panelCamarasReg').hidden = true;
  if (opt === 'camara-dispositivo') {
    regGuardarPref({ opt: opt });
    regIniciarCamara(null);
  } else if (opt === 'camara-externa') {
    await regListarCamaras();
  } else if (opt === 'lector-usb') {
    regGuardarPref({ opt: opt });
    await regCerrarModalEscaner();
    const input = regEl('codigoBarrasInput');
    input.focus();
    mostrarMsg(formMsg, 'Lector listo: escanea el producto con la pistola y el código se llena solo.', 'ok');
  }
}

// Pide permiso (sin él el navegador oculta los nombres) y lista TODAS las cámaras conectadas
async function regListarCamaras() {
  if (!CapcobEscaner.disponible()) { regMsg('No se pudo cargar el lector de cámara. Revisa tu conexión a internet.', true); return; }
  if (!window.isSecureContext) { regMsg('El navegador solo permite usar la cámara en https o localhost.', true); return; }
  regMsg('Buscando cámaras…');
  try {
    const camaras = await CapcobEscaner.listarCamaras();
    if (!camaras || camaras.length === 0) { regMsg('No se detectó ninguna cámara. Conecta la cámara externa y vuelve a intentar.', true); return; }
    const pref = regLeerPref();
    const sel = regEl('selCamaraReg');
    sel.innerHTML = '';
    camaras.forEach((c, i) => {
      const op = document.createElement('option');
      op.value = c.id;
      op.textContent = c.label || ('Cámara ' + (i + 1));
      sel.appendChild(op);
    });
    if (pref.camaraId && camaras.some(c => c.id === pref.camaraId)) sel.value = pref.camaraId;
    else if (camaras.length > 1) sel.selectedIndex = camaras.length - 1;   // normalmente la externa se lista al final
    regEl('panelCamarasReg').hidden = false;
    regMsg(camaras.length === 1 ? 'Solo se detectó una cámara.' : camaras.length + ' cámaras detectadas. Elige la que quieres usar.');
  } catch (err) {
    regMsg('No se pudo acceder a las cámaras: permiso denegado o cámara en uso.', true);
  }
}

// ── Cámara (escaner-barras.js, el mismo lector de la caja del empleado) ──
async function regIniciarCamara(camaraId) {
  if (!CapcobEscaner.disponible()) { regMsg('No se pudo cargar el lector de cámara. Revisa tu conexión a internet.', true); return; }
  if (!window.isSecureContext) { regMsg('El navegador solo permite usar la cámara en https o localhost.', true); return; }
  await regDetenerCamara();

  regEl('escanerOpciones').style.display = 'none';
  regEl('panelCamarasReg').hidden = true;
  regEl('escanerVista').style.display = 'block';
  regMsg('Iniciando cámara…');
  regEscaner.activa = true;
  regEscaner.procesando = false;

  // Solo códigos de productos (1D). Se lee a la resolución real de la cámara (ver escaner-barras.js).
  regEscaner.qr = new CapcobEscaner.Lector('camaraReaderReg');
  const ok = (texto) => regOnCodigoCamara(texto);

  try {
    if (camaraId) {
      await regEscaner.qr.start(camaraId, ok);
    } else {
      try {
        await regEscaner.qr.start({ facingMode: 'environment' }, ok);
      } catch (e) {
        // sin cámara trasera (portátil): usa la que haya
        await regEscaner.qr.start({ facingMode: 'user' }, ok);
      }
    }
    regMsg('');
  } catch (err) {
    await regDetenerCamara();
    regEl('escanerOpciones').style.display = 'grid';
    regMsg('No se pudo acceder a la cámara: ' + err, true);
  }
}

async function regDetenerCamara() {
  regEscaner.activa = false;
  const qr = regEscaner.qr;
  regEscaner.qr = null;
  if (qr) {
    try { await qr.stop(); qr.clear(); } catch (e) { /* ya estaba detenida */ }
  }
  const vista = regEl('escanerVista');
  if (vista) vista.style.display = 'none';
}

async function regOnCodigoCamara(texto) {
  if (regEscaner.procesando) return;
  const codigo = regLimpiarCodigo(texto);
  // lecturas raras (QR, texto largo) se ignoran y la cámara sigue buscando
  if (!REG_CODIGO_RE.test(codigo) || !/\d/.test(codigo)) return;
  regEscaner.procesando = true;
  await regCerrarModalEscaner();
  await regAplicarCodigo(codigo);
}

// Sin caracteres de control ni espacios sobrantes
function regLimpiarCodigo(texto) {
  return String(texto == null ? '' : texto).replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, '').trim().slice(0, 40);
}

// Pone el código en el formulario, avisa si ya existe en el inventario y, si falta, sugiere el nombre.
async function regAplicarCodigo(crudo) {
  const codigo = regLimpiarCodigo(crudo);
  const input = regEl('codigoBarrasInput');
  if (!codigo) return;
  if (!REG_CODIGO_RE.test(codigo) || !/\d/.test(codigo)) {
    mostrarMsg(formMsg, 'Ese código no parece válido (6 a 20 caracteres: números, letras o guiones).', 'error');
    return;
  }
  input.value = codigo;
  actualizarCampoCodigo();
  mostrarMsg(formMsg, 'Código leído: ' + codigo + '. Revisando…', '');

  // 1) ¿Ya está registrado en este inventario?
  try {
    const existente = await apiFetch('/productos/codigo/' + encodeURIComponent(codigo));
    if (existente && existente.id !== editandoProductoId) {
      input.value = '';
      actualizarCampoCodigo();
      mostrarMsg(formMsg, 'Ese código ya está registrado en "' + existente.nombre + '" (categoría ' + existente.paqueteNombre + '). Búscalo arriba para editarlo.', 'error');
      return;
    }
  } catch (e) {
    // 404 = no existe (lo normal). Si fue un problema de conexión, el servidor lo vuelve a validar al guardar.
  }

  // 2) Nombre sugerido (opcional, solo si el nombre está vacío)
  const sugerido = await regSugerirNombre(codigo);
  if (sugerido) {
    mostrarMsg(formMsg, 'Código leído: ' + codigo + '. Nombre sugerido desde Open Food Facts: revísalo antes de guardar.', 'ok');
  } else if (!regEl('nombre').value.trim()) {
    mostrarMsg(formMsg, 'Código leído: ' + codigo + '. Escribe el nombre del producto.', 'ok');
  } else {
    mostrarMsg(formMsg, 'Código leído: ' + codigo + '.', 'ok');
  }
}

// Busca el producto por su código en Open Food Facts (base pública y gratuita) para adelantar el nombre.
// Es solo una ayuda: si no hay internet o no lo conocen, simplemente no se llena nada.
async function regSugerirNombre(codigo) {
  const nombreEl = regEl('nombre');
  if (nombreEl.value.trim() || !/^\d{8,14}$/.test(codigo)) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch('https://world.openfoodfacts.org/api/v2/product/' + codigo +
      '.json?fields=product_name,product_name_es,brands,quantity', { signal: ctrl.signal });
    if (!res.ok) return false;
    const data = await res.json();
    const p = data && data.status === 1 ? data.product : null;
    if (!p) return false;

    let nombre = String(p.product_name_es || p.product_name || '').trim();
    if (!nombre) return false;
    const marca = String(p.brands || '').split(',')[0].trim();
    if (marca && !nombre.toLowerCase().includes(marca.toLowerCase())) nombre += ' ' + marca;
    const cantidad = String(p.quantity || '').trim();
    if (cantidad && !nombre.toLowerCase().includes(cantidad.toLowerCase())) nombre += ' ' + cantidad;

    if (nombreEl.value.trim()) return false;   // mientras tanto la persona ya escribió algo
    nombreEl.value = nombre.slice(0, MAX_NOMBRE_PRODUCTO);
    return true;
  } catch (e) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

window.addEventListener('beforeunload', () => {
  try { if (regEscaner.qr) regEscaner.qr.stop(); } catch (e) {}
});
