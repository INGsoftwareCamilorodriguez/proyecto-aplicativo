// ══════════════════════════════════════════════════════════════
// CAJA — ESCANEAR CÓDIGO DE BARRAS — CAPCOB
// Conectado al backend real: GET /api/productos/codigo/{codigo}
// y GET /api/productos (para el panel de accesos rápidos).
// ══════════════════════════════════════════════════════════════

let ticket = []; // { codigo, nombre, precio, cantidad }
let productosCache = []; // catálogo completo del backend (para la búsqueda en vivo)
let escaneados = []; // historial de productos escaneados en esta venta (más reciente primero)
let html5QrCode = null;
let camaraActiva = false;
let ultimoCodigoCamara = null;
let ultimoCodigoCamaraTs = 0;

const codigoInput = document.getElementById('codigoInput');
const productCard = document.getElementById('productCard');
const ticketList = document.getElementById('ticketList');
const ticketCount = document.getElementById('ticketCount');
const subtotalVal = document.getElementById('subtotalVal');
const ivaVal = document.getElementById('ivaVal');
const totalVal = document.getElementById('totalVal');
const btnCobrar = document.getElementById('btnCobrar');
const scanBox = document.getElementById('scanBox');
const btnCamara = document.getElementById('btnCamara');
const camaraWrap = document.getElementById('camaraWrap');
const quickGrid = document.getElementById('quickGrid');
const quickGridLabel = document.getElementById('quickGridLabel');

function money(n) {
  return '$' + Math.round(n).toLocaleString('es-CO');
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

// Normaliza la respuesta del backend (ProductoResponse) al formato que usa la caja
function normalizarProducto(p) {
  return {
    id: p.id,
    codigo: p.codigoBarras,
    nombre: p.nombre,
    precio: Number(p.precio),
    stock: Number(p.cantidad),
    cat: p.paqueteNombre,
    tipoPrecio: p.tipoPrecio
  };
}

// ── Cargar catálogo completo (queda en memoria para la búsqueda en vivo) ──
async function cargarCatalogo() {
  try {
    const data = await apiFetch('/productos');
    productosCache = data.map(normalizarProducto);
  } catch (e) {
    quickGrid.innerHTML = `<div class="quick-loading">No se pudo cargar el catálogo: ${e.message}</div>`;
    return;
  }
  renderGridEscaneados();
}

// ── Vista por defecto: historial de lo escaneado en esta venta ──
function renderGridEscaneados() {
  quickGridLabel.textContent = 'Productos escaneados';
  if (escaneados.length === 0) {
    quickGrid.innerHTML = '<div class="quick-loading">Los productos que escanees en esta venta van a aparecer aquí.</div>';
    return;
  }
  quickGrid.innerHTML = escaneados.map(p => `
    <div class="quick-item" onclick="agregarRapido('${p.codigo}')">
      <div class="qi-name">${p.nombre}</div>
      <div class="qi-price">${money(p.precio)}</div>
    </div>
  `).join('');
}

// ── Vista mientras se escribe: búsqueda en vivo contra todo el catálogo ──
// Por nombre: coincidencia parcial (puedes escribir medio nombre).
// Por código: coincidencia EXACTA únicamente, porque el código es único
// y no tiene sentido listar varios productos a partir de un código parcial.
function renderGridBusqueda(texto) {
  quickGridLabel.textContent = 'Resultados de búsqueda';
  const t = texto.trim().toLowerCase();
  const resultados = productosCache
    .filter(p => p.nombre.toLowerCase().includes(t) || p.codigo.toLowerCase() === t)
    .slice(0, 12);

  if (resultados.length === 0) {
    quickGrid.innerHTML = `<div class="quick-loading">Sin coincidencias para "${texto}"</div>`;
    return;
  }
  quickGrid.innerHTML = resultados.map(p => `
    <div class="quick-item" onclick="agregarRapido('${p.codigo}')">
      <div class="qi-name">${p.nombre}</div>
      <div class="qi-price">${money(p.precio)}</div>
    </div>
  `).join('');
}

// Guarda el producto en el historial de esta venta (sin duplicados, el más reciente primero)
function registrarEscaneado(producto) {
  escaneados = escaneados.filter(p => p.codigo !== producto.codigo);
  escaneados.unshift(producto);
  if (escaneados.length > 12) escaneados = escaneados.slice(0, 12);
  renderGridEscaneados();
}

function agregarRapido(codigo) {
  codigoInput.value = codigo;
  procesarCodigo();
}

// ── Buscar y agregar producto por código escaneado/tecleado ────
async function procesarCodigo() {
  const codigo = codigoInput.value.trim();
  codigoInput.value = '';
  renderGridEscaneados(); // el campo quedó vacío: vuelve a la vista de historial
  if (!codigo) return;

  try {
    const data = await apiFetch(`/productos/codigo/${encodeURIComponent(codigo)}`);
    const producto = normalizarProducto(data);
    registrarEscaneado(producto);

    if (producto.stock <= 0) {
      mostrarSinStock(producto);
      flashScanBox(false);
      return;
    }
    agregarAlTicket(producto, 1);
    mostrarProducto(producto);
    flashScanBox(true);
  } catch (e) {
    mostrarNoEncontrado(codigo);
    flashScanBox(false);
  }
}

// Mientras el cajero escribe, filtra en vivo; al borrar todo, vuelve al historial
codigoInput.addEventListener('input', () => {
  const val = codigoInput.value;
  if (val.trim().length === 0) {
    renderGridEscaneados();
  } else {
    renderGridBusqueda(val);
  }
});

function flashScanBox(ok) {
  scanBox.classList.remove('flash-ok', 'flash-err');
  void scanBox.offsetWidth; // reinicia la animación
  scanBox.classList.add(ok ? 'flash-ok' : 'flash-err');
  setTimeout(() => scanBox.classList.remove('flash-ok', 'flash-err'), 500);
}

function stockBadge(stock) {
  if (stock <= 0) return '<span class="stock-badge stock-out">Sin stock</span>';
  if (stock <= 8) return `<span class="stock-badge stock-low">Quedan ${stock}</span>`;
  return `<span class="stock-badge stock-ok">Disponible</span>`;
}

function mostrarProducto(producto) {
  const enTicket = ticket.find(i => i.codigo === producto.codigo);
  const cantidad = enTicket ? enTicket.cantidad : 1;
  productCard.classList.remove('empty');
  productCard.innerHTML = `
    <div class="product-info">
      <div class="product-name">${producto.nombre}</div>
      <div class="product-meta">
        <span>${producto.cat || ''}</span>
        <span>Cód. ${producto.codigo}</span>
        ${stockBadge(producto.stock)}
      </div>
    </div>
    <div class="qty-stepper">
      <button onclick="cambiarCantidad('${producto.codigo}', -1)">−</button>
      <span class="qty-val">${cantidad}</span>
      <button onclick="cambiarCantidad('${producto.codigo}', 1)">+</button>
    </div>
    <div class="product-price">${money(producto.precio)}</div>
  `;
}

function mostrarNoEncontrado(codigo) {
  productCard.classList.remove('empty');
  productCard.innerHTML = `
    <div class="product-info">
      <div class="product-name">Código no encontrado</div>
      <div class="product-meta">
        <span>"${codigo}" no está registrado en el inventario</span>
      </div>
    </div>
  `;
}

function mostrarSinStock(producto) {
  productCard.classList.remove('empty');
  productCard.innerHTML = `
    <div class="product-info">
      <div class="product-name">${producto.nombre}</div>
      <div class="product-meta">
        <span>Sin unidades disponibles en este momento</span>
      </div>
    </div>
  `;
}

function agregarAlTicket(producto, cantidad) {
  const existente = ticket.find(i => i.codigo === producto.codigo);
  if (existente) {
    existente.cantidad += cantidad;
  } else {
    ticket.push({ productoId: producto.id, codigo: producto.codigo, nombre: producto.nombre, precio: producto.precio, cantidad });
  }
  renderTicket();
}

function cambiarCantidad(codigo, delta) {
  const item = ticket.find(i => i.codigo === codigo);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) {
    ticket = ticket.filter(i => i.codigo !== codigo);
  }
  renderTicket();
  const producto = productosCache.find(p => p.codigo === codigo);
  if (producto && ticket.find(i => i.codigo === codigo)) mostrarProducto(producto);
  codigoInput.focus();
}

function eliminarDelTicket(codigo) {
  ticket = ticket.filter(i => i.codigo !== codigo);
  renderTicket();
  codigoInput.focus();
}

function renderTicket() {
  if (ticket.length === 0) {
    ticketList.innerHTML = `
      <div class="ticket-empty">
        <div class="big-icon">🧾</div>
        <div>La factura esta vacío<br/>Escanea un producto para comenzar.</div>
      </div>`;
  } else {
    ticketList.innerHTML = ticket.map(item => `
      <div class="ticket-row">
        <div class="tr-name">
          <div class="tn">${item.nombre}</div>
          <div class="tp">${money(item.precio)} c/u</div>
        </div>
        <div class="tr-qty">x${item.cantidad}</div>
        <div class="tr-sub">${money(item.precio * item.cantidad)}</div>
        <button class="tr-del" onclick="eliminarDelTicket('${item.codigo}')" title="Quitar">✕</button>
      </div>
    `).join('');
  }

  const totalItems = ticket.reduce((a, i) => a + i.cantidad, 0);
  ticketCount.textContent = `${totalItems} item${totalItems === 1 ? '' : 's'}`;

  const subtotal = ticket.reduce((a, i) => a + i.precio * i.cantidad, 0);
  const iva = subtotal * 0.19;
  const total = subtotal + iva;

  subtotalVal.textContent = money(subtotal);
  ivaVal.textContent = money(iva);
  totalVal.textContent = money(total);

  btnCobrar.disabled = ticket.length === 0;
}

function limpiarVentaEnCurso() {
  ticket = [];
  renderTicket();
  productCard.classList.add('empty');
  productCard.innerHTML = `<div>Aún no has escaneado ningún producto</div><div style="font-size:.76rem;">El último producto leído aparecerá aquí</div>`;
}

function cancelarVenta() {
  if (ticket.length === 0) return;
  if (!confirm('¿Cancelar la venta en curso? Se perderán los productos escaneados.')) return;
  limpiarVentaEnCurso();
  codigoInput.focus();
}

// ── Cobrar: primero confirmación, luego ticket imprimible ──────
function cobrarVenta() {
  if (ticket.length === 0) return;
  document.getElementById('confirmarTexto').textContent =
    `Vas a cobrar ${ticketCount.textContent} por un total de ${totalVal.textContent}. ¿Estás seguro?`;
  document.getElementById('modalConfirmar').classList.add('show');
}

function cerrarModalConfirmar() {
  document.getElementById('modalConfirmar').classList.remove('show');
}

async function confirmarCobro() {
  const btnConfirmar = document.getElementById('btnConfirmarCobro');
  if (btnConfirmar) {
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Registrando...';
  }

  const usuarioId = Number(sessionStorage.getItem('userId'));
  const items = ticket.map(item => ({ productoId: item.productoId, cantidad: item.cantidad }));

  try {
    await apiFetch('/ventas', {
      method: 'POST',
      body: JSON.stringify({ usuarioId, items })
    });

    cerrarModalConfirmar();
    generarRecibo();
    document.getElementById('modalTicket').classList.add('show');
    mostrarToast(`Venta registrada — ${totalVal.textContent}`);
    cargarCatalogo(); // refresca el stock en memoria (se descontó en el backend)
  } catch (e) {
    cerrarModalConfirmar();
    alert('No se pudo registrar la venta: ' + e.message);
  } finally {
    if (btnConfirmar) {
      btnConfirmar.disabled = false;
      btnConfirmar.textContent = 'Sí, cobrar';
    }
  }
}

function generarRecibo() {
  const fecha = new Date().toLocaleString('es-CO');
  const cajero = document.getElementById('cajeroNombre').textContent;
  const filas = ticket.map(item => `
    <div class="r-row">
      <span>${item.nombre} x${item.cantidad}</span>
      <span>${money(item.precio * item.cantidad)}</span>
    </div>
  `).join('');

  document.getElementById('reciboContenido').innerHTML = `
    <div class="r-center r-title">CAPCOB</div>
    <div class="r-center">Caja 01 · ${cajero}</div>
    <div class="r-center">${fecha}</div>
    <hr/>
    ${filas}
    <hr/>
    <div class="r-row"><span>Subtotal</span><span>${subtotalVal.textContent}</span></div>
    <div class="r-row"><span>IVA (19%)</span><span>${ivaVal.textContent}</span></div>
    <div class="r-row r-total"><span>TOTAL</span><span>${totalVal.textContent}</span></div>
    <hr/>
    <div class="r-center">¡Gracias por su compra!</div>
  `;
}

function cerrarModalTicket() {
  document.getElementById('modalTicket').classList.remove('show');
  limpiarVentaEnCurso();
  codigoInput.focus();
}

function mostrarToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

// ── Escaneo por cámara (mientras no hay lector físico) ──────────
function toggleCamara() {
  if (camaraActiva) {
    detenerCamara();
  } else {
    iniciarCamara();
  }
}

function iniciarCamara() {
  if (typeof Html5Qrcode === 'undefined') {
    alert('No se pudo cargar el lector de cámara. Revisa tu conexión a internet.');
    return;
  }
  camaraWrap.style.display = 'block';
  btnCamara.classList.add('active');
  btnCamara.textContent = '⏹ Detener cámara';
  camaraActiva = true;

  html5QrCode = new Html5Qrcode('camaraReader');
  const config = { fps: 10, qrbox: { width: 260, height: 140 } };

  html5QrCode.start(
    { facingMode: 'environment' },
    config,
    (decodedText) => onCodigoDeCamara(decodedText),
    () => { /* frame sin código detectado, se ignora */ }
  ).catch(() => {
    // si no hay cámara trasera (típico en laptop), usa la cámara disponible
    html5QrCode.start(
      { facingMode: 'user' },
      config,
      (decodedText) => onCodigoDeCamara(decodedText),
      () => {}
    ).catch((err) => {
      alert('No se pudo acceder a la cámara: ' + err);
      detenerCamara();
    });
  });
}

function detenerCamara() {
  camaraActiva = false;
  btnCamara.classList.remove('active');
  btnCamara.textContent = '📷 Cámara';
  camaraWrap.style.display = 'none';
  if (html5QrCode) {
    html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {});
  }
  codigoInput.focus();
}

function onCodigoDeCamara(codigo) {
  // evita agregar el mismo código varias veces seguidas mientras la cámara sigue enfocando
  const ahora = Date.now();
  if (codigo === ultimoCodigoCamara && (ahora - ultimoCodigoCamaraTs) < 2500) return;
  ultimoCodigoCamara = codigo;
  ultimoCodigoCamaraTs = ahora;

  codigoInput.value = codigo;
  procesarCodigo();
}

/* Enter dispara el agregado — así funciona con cualquier lector físico de código de barras */
codigoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    procesarCodigo();
  }
});

/* Mantener el foco siempre en el input, como en un punto de venta real
   (pero no le quita el foco a la cámara ni a los modales) */
document.addEventListener('click', (e) => {
  if (camaraActiva) return;
  if (e.target.closest('.modal-overlay')) return;
  if (!e.target.closest('button') && !e.target.closest('.quick-item')) {
    codigoInput.focus();
  }
});
setInterval(() => {
  if (!camaraActiva && document.activeElement !== codigoInput && !document.querySelector('.modal-overlay.show')) {
    codigoInput.focus();
  }
}, 3000);

/* ── Sesión y roles ──
   Si nadie inició sesión, no se puede ver esta pantalla: se manda a login.
   El rol "Empleado" se queda encerrado aquí (no ve el link de volver al panel);
   Administrador y Auditor sí pueden volver al dashboard. */
(function verificarSesion() {
  const rol = sessionStorage.getItem('rol');
  const username = sessionStorage.getItem('username');

  if (!rol) {
    window.location.href = "/frontend/paginas/login/login.html";
    return;
  }

  if (username) {
    document.getElementById('cajeroNombre').textContent = username;
    document.getElementById('cajeroInicial').textContent = username.charAt(0).toUpperCase();
  }

  if (rol !== 'Empleado') {
    const volverPanel = document.getElementById('volverPanel');
    if (volverPanel) volverPanel.style.display = 'inline';
  }
})();

cargarCatalogo();
codigoInput.focus();