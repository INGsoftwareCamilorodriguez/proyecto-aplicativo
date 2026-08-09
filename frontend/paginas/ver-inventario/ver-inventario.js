// ══════════════════════════════════════════════════════════════
// VER INVENTARIO — CAPCOB
// Conectado al backend real: /api/paquetes y /api/productos
// ══════════════════════════════════════════════════════════════

(function () {
  const username = localStorage.getItem('username');
  if (username) {
    const nameEl = document.querySelector('.user-name');
    if (nameEl) nameEl.textContent = username;
  }
})();

let paquetes = [];
let paqueteSeleccionadoId = null;

const paquetesRow = document.getElementById('paquetesRow');
const sinPaqueteHint = document.getElementById('sinPaqueteHint');
const inventarioTitle = document.getElementById('inventarioTitle');
const inventarioTable = document.getElementById('inventarioTable');
const inventarioBody = document.getElementById('inventarioBody');
const sinProductosHint = document.getElementById('sinProductosHint');

const modalCodigo = document.getElementById('modalCodigo');
const modalCodigoNombre = document.getElementById('modalCodigoNombre');
const modalCodigoTipo = document.getElementById('modalCodigoTipo');
const modalCodigoValor = document.getElementById('modalCodigoValor');
const modalCodigoPrecio = document.getElementById('modalCodigoPrecio');

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
    hint.textContent = 'Todavía no hay paquetes creados. Ve a "Registrar producto" para crear el primero.';
    paquetesRow.appendChild(hint);
    return;
  }

  paquetes.forEach(p => {
    const pill = document.createElement('div');
    pill.className = 'paquete-pill' + (p.id === paqueteSeleccionadoId ? ' active' : '');
    pill.innerHTML = '<span>' + p.nombre + '</span><span class="count">' + p.totalProductos + '</span>';
    pill.addEventListener('click', () => seleccionarPaquete(p.id));
    paquetesRow.appendChild(pill);
  });
}

// ── Seleccionar paquete e inventario ────────────────────────
async function seleccionarPaquete(id) {
  paqueteSeleccionadoId = id;
  renderPaquetes();

  const paquete = paquetes.find(p => p.id === id);
  sinPaqueteHint.style.display = 'none';
  inventarioTitle.textContent = 'Inventario de "' + paquete.nombre + '"';

  try {
    const productos = await apiFetch('/productos?paqueteId=' + id);
    renderInventario(productos);
  } catch (e) {
    inventarioTable.style.display = 'none';
    sinProductosHint.style.display = 'block';
    sinProductosHint.textContent = 'Error cargando inventario: ' + e.message;
  }
}

function renderInventario(productos) {
  inventarioBody.innerHTML = '';

  if (productos.length === 0) {
    inventarioTable.style.display = 'none';
    sinProductosHint.style.display = 'block';
    sinProductosHint.textContent = 'Este paquete todavía no tiene productos.';
    return;
  }
  sinProductosHint.style.display = 'none';
  inventarioTable.style.display = 'table';

  productos.forEach(prod => {
    const esPeso = prod.tipoPrecio === 'PESO';
    const cantidadNum = Number(prod.cantidad);
    const bajoStock = esPeso ? cantidadNum < 2 : cantidadNum < 10;

    const precioTexto = esPeso ? formatearPrecio(prod.precio) + ' / kg' : formatearPrecio(prod.precio);
    const cantidadTexto = esPeso
      ? cantidadNum.toLocaleString('es-CO') + ' kg'
      : cantidadNum.toLocaleString('es-CO') + ' und';

    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + prod.nombre + '</td>' +
      '<td><span class="badge ' + (esPeso ? 'badge-purple' : 'badge-green') + '">' + (esPeso ? 'Por peso' : 'Fijo') + '</span></td>' +
      '<td>' + cantidadTexto + '</td>' +
      '<td>' + precioTexto + '</td>' +
      '<td><span class="badge ' + (bajoStock ? 'badge-purple' : 'badge-green') + '">' + (bajoStock ? 'Bajo stock' : 'Disponible') + '</span></td>' +
      '<td></td>';

    const btnVerCodigo = document.createElement('div');
    btnVerCodigo.className = 'icon-btn';
    btnVerCodigo.title = 'Ver código de barras';
    btnVerCodigo.innerHTML = '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="2" height="14"/><rect x="7" y="5" width="1" height="14"/><rect x="10" y="5" width="3" height="14"/><rect x="15" y="5" width="1" height="14"/><rect x="18" y="5" width="2" height="14"/></svg>';
    btnVerCodigo.addEventListener('click', () => mostrarCodigo(prod));
    tr.lastElementChild.appendChild(btnVerCodigo);

    inventarioBody.appendChild(tr);
  });
}

// ── Modal código de barras ───────────────────────────────────
function mostrarCodigo(prod) {
  modalCodigoNombre.textContent = prod.nombre;
  const esPeso = prod.tipoPrecio === 'PESO';
  modalCodigoTipo.textContent = esPeso ? 'PLU por peso' : 'EAN-13 fijo';
  modalCodigoValor.textContent = prod.codigoBarras;
  modalCodigoPrecio.textContent = esPeso
    ? 'Precio de referencia: ' + formatearPrecio(prod.precio) + ' por kg (el valor final se calcula al pesar el producto en el punto de venta)'
    : 'Precio: ' + formatearPrecio(prod.precio);
  modalCodigo.classList.remove('hidden');
}
document.getElementById('btnCerrarModalCodigo').addEventListener('click', () => modalCodigo.classList.add('hidden'));

// ── Inicio ───────────────────────────────────────────────────
cargarPaquetes();