// ══════════════════════════════════════════════════════════════
// REGISTRAR PRODUCTO — CAPCOB
// Conectado al backend real: /api/paquetes y /api/productos
// ══════════════════════════════════════════════════════════════

(function () {
  const rol = localStorage.getItem('rol');
  const username = localStorage.getItem('username');
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

    const precioTexto = prod.tipoPrecio === 'PESO'
      ? formatearPrecio(prod.precio) + ' / kg'
      : formatearPrecio(prod.precio);
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

    const btnEditar = document.createElement('div');
    btnEditar.className = 'icon-btn';
    btnEditar.title = 'Editar';
    btnEditar.innerHTML = '<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>';
    btnEditar.addEventListener('click', () => cargarProductoEnFormulario(prod));
    rowActions.appendChild(btnEditar);

    const btnEliminar = document.createElement('div');
    btnEliminar.className = 'icon-btn danger';
    btnEliminar.title = 'Eliminar';
    btnEliminar.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
    btnEliminar.addEventListener('click', () => eliminarProducto(prod.id));
    rowActions.appendChild(btnEliminar);
  });
}

// ── Selector FIJO / PESO ────────────────────────────────────
function seleccionarTipoPrecio(tipo) {
  tipoPrecioActual = tipo;
  optFijo.classList.toggle('active', tipo === 'FIJO');
  optPeso.classList.toggle('active', tipo === 'PESO');

  if (tipo === 'PESO') {
    precioLabel.textContent = 'PRECIO POR KILO ($/KG)';
    document.getElementById('precio').placeholder = '$0 por kg';
    cantidadLabel.textContent = 'CANTIDAD DISPONIBLE (KG)';
    document.getElementById('cantidad').placeholder = '0.0 kg';
  } else {
    precioLabel.textContent = 'PRECIO ($)';
    document.getElementById('precio').placeholder = '$0';
    cantidadLabel.textContent = 'CANTIDAD (UNIDADES)';
    document.getElementById('cantidad').placeholder = '0';
  }
}
optFijo.addEventListener('click', () => seleccionarTipoPrecio('FIJO'));
optPeso.addEventListener('click', () => seleccionarTipoPrecio('PESO'));

// ── Guardar producto (crear o editar) ───────────────────────
document.getElementById('btnGuardar').addEventListener('click', async () => {
  const nombre = document.getElementById('nombre').value.trim();
  const precio = document.getElementById('precio').value;
  const cantidad = document.getElementById('cantidad').value;

  if (!paqueteSeleccionadoId) {
    mostrarMsg(formMsg, 'Selecciona un paquete primero.', 'error');
    return;
  }
  if (!nombre || !precio || cantidad === '') {
    mostrarMsg(formMsg, 'Completa nombre, precio y cantidad.', 'error');
    return;
  }

  const body = {
    paqueteId: paqueteSeleccionadoId,
    nombre: nombre,
    tipoPrecio: tipoPrecioActual,
    precio: Number(precio),
    cantidad: Number(cantidad)
  };

  try {
    let resultado;
    if (editandoProductoId) {
      resultado = await apiFetch('/productos/' + editandoProductoId, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
      mostrarMsg(formMsg, 'Producto actualizado. Código de barras: ' + resultado.codigoBarras, 'ok');
    } else {
      resultado = await apiFetch('/productos', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      mostrarMsg(formMsg, 'Producto guardado. Código de barras generado: ' + resultado.codigoBarras, 'ok');
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
  document.getElementById('precio').value = prod.precio;
  document.getElementById('cantidad').value = prod.cantidad;
  seleccionarTipoPrecio(prod.tipoPrecio);
  formTitle.textContent = 'Editando "' + prod.nombre + '"';
  btnCancelarEdicion.style.display = 'inline-flex';
  mostrarMsg(formMsg, '', '');
  productoForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelarEdicion() {
  editandoProductoId = null;
  document.getElementById('nombre').value = '';
  document.getElementById('precio').value = '';
  document.getElementById('cantidad').value = '';
  seleccionarTipoPrecio('FIJO');
  btnCancelarEdicion.style.display = 'none';
  const paquete = paquetes.find(p => p.id === paqueteSeleccionadoId);
  if (paquete) formTitle.textContent = 'Nuevo producto en "' + paquete.nombre + '"';
  mostrarMsg(formMsg, '', '');
}
btnCancelarEdicion.addEventListener('click', cancelarEdicion);

// ── Eliminar producto ───────────────────────────────────────
async function eliminarProducto(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  try {
    await apiFetch('/productos/' + id, { method: 'DELETE' });
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
    paqueteSeleccionadoId = null;
    productoForm.style.display = 'none';
    productosCard.style.display = 'none';
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
    await cargarPaquetes();
    await seleccionarPaquete(nuevo.id);
  } catch (e) {
    mostrarMsg(modalPaqueteMsg, e.message, 'error');
  }
});

// ── Inicio ───────────────────────────────────────────────────
cargarPaquetes();