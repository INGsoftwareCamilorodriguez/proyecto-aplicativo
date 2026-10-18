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
let datosRecibo = null;     // empleado + administrador que salen en el recibo
let nombreEmpresa = null;   // nombre del negocio (Configuración)
let codigoMostrado = null; // código del producto que se ve en la tarjeta de "último producto"

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

function escapar(texto) {
  return String(texto == null ? '' : texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Datos del empleado y del administrador para el recibo. Si algo falla, el recibo
// sale igual con lo que haya (nunca bloquea una venta).
async function cargarDatosRecibo() {
  try { datosRecibo = await apiFetch('/usuarios/datos-recibo'); } catch (e) { datosRecibo = null; }
  try {
    const cfg = await apiFetch('/configuracion');
    if (cfg && cfg.nombreEmpresa) nombreEmpresa = cfg.nombreEmpresa;
  } catch (e) { /* se usa el nombre de la empresa del administrador o CAPCOB */ }
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
async function cargarCatalogo(silencioso) {
  try {
    const data = await apiFetch('/productos');
    productosCache = data.map(normalizarProducto);
  } catch (e) {
    if (!silencioso) quickGrid.innerHTML = `<div class="quick-loading">No se pudo cargar el catálogo: ${e.message}</div>`;
    return;
  }
  // En un refresco silencioso no se pisa lo que el cajero esté buscando en ese momento
  if (!silencioso || codigoInput.value.trim() === '') renderGridEscaneados();
}

// Minúsculas y sin tildes: "Éclair" se encuentra escribiendo "eclair"
function sinTildes(x) {
  return String(x == null ? '' : x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Productos cuyo nombre EMPIEZA con lo escrito (misma regla de la búsqueda en vivo)
function buscarPorNombre(texto) {
  const t = sinTildes(texto.trim());
  if (!t) return [];
  return productosCache.filter(p => sinTildes(p.nombre).startsWith(t));
}

function buscarEnCache(codigo) {
  return productosCache.find(p => p.codigo === codigo);
}

function cantidadEnTicket(codigo) {
  const item = ticket.find(i => i.codigo === codigo);
  return item ? item.cantidad : 0;
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
// Por nombre: el nombre tiene que EMPEZAR con lo escrito (en orden, desde la primera
// letra), sin importar mayúsculas ni tildes. Ej.: "l" muestra leche, pero "e" no.
// Por código: coincidencia EXACTA únicamente, porque el código es único
// y no tiene sentido listar varios productos a partir de un código parcial.
function renderGridBusqueda(texto) {
  quickGridLabel.textContent = 'Resultados de búsqueda';
  const t = sinTildes(texto.trim());
  const resultados = productosCache
    .filter(p => sinTildes(p.nombre).startsWith(t) || p.codigo.toLowerCase() === t)
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
// Primero se busca en el catálogo que ya está en memoria: así el producto se
// agrega al instante y cada clic cuenta una sola vez (antes cada clic esperaba
// la respuesta del servidor, y si el servidor tardaba los clics se seguían
// sumando solos después). Solo si el código no está en memoria se consulta al backend.
async function procesarCodigo() {
  const texto = codigoInput.value.trim();
  if (!texto) { renderGridEscaneados(); return; }

  // 1) Código de barras exacto
  let producto = buscarEnCache(texto);

  // 2) Si no es un código: por nombre (Enter funciona igual que hacer clic en el producto)
  //    · nombre exacto            -> ese producto
  //    · una sola coincidencia    -> ese producto
  //    · varias coincidencias     -> no adivina: pide elegir uno de la lista
  if (!producto) {
    const coincidencias = buscarPorNombre(texto);
    const exacto = coincidencias.find(p => sinTildes(p.nombre) === sinTildes(texto));
    if (exacto) {
      producto = exacto;
    } else if (coincidencias.length === 1) {
      producto = coincidencias[0];
    } else if (coincidencias.length > 1) {
      codigoMostrado = null;
      mostrarVariasCoincidencias(texto, coincidencias.length);
      flashScanBox(false);
      return;   // se deja lo escrito y la lista de resultados para que elija
    }
  }

  codigoInput.value = '';
  renderGridEscaneados(); // el campo quedó vacío: vuelve a la vista de historial

  // 3) Último recurso: código que no está en memoria (producto nuevo) -> se consulta al backend
  if (!producto) {
    try {
      const data = await apiFetch(`/productos/codigo/${encodeURIComponent(texto)}`);
      producto = normalizarProducto(data);
      productosCache.push(producto);
    } catch (e) {
      codigoMostrado = null;
      mostrarNoEncontrado(texto);
      flashScanBox(false);
      return;
    }
  }
  intentarAgregar(producto);
}

// Agrega UNA unidad respetando el stock disponible
function intentarAgregar(producto) {
  registrarEscaneado(producto);

  if (producto.stock <= 0) {
    codigoMostrado = null;
    mostrarSinStock(producto);
    flashProductCard();
    return;
  }
  if (cantidadEnTicket(producto.codigo) + 1 > producto.stock) {
    mostrarProducto(producto, true);   // con el aviso de "ya no hay más disponible"
    flashProductCard();
    return;
  }
  agregarAlTicket(producto, 1);
  mostrarProducto(producto);
  flashScanBox(true);
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

// Brillo rojo en la tarjeta del PRODUCTO (no en el buscador) cuando se pasa del stock
function flashProductCard() {
  productCard.classList.remove('flash-err');
  void productCard.offsetWidth; // reinicia la animación
  productCard.classList.add('flash-err');
  clearTimeout(flashProductCard._t);
  flashProductCard._t = setTimeout(() => productCard.classList.remove('flash-err'), 700);
}

function stockBadge(stock) {
  if (stock <= 0) return '<span class="stock-badge stock-out">Sin stock</span>';
  if (stock <= 8) return `<span class="stock-badge stock-low">Quedan ${stock}</span>`;
  return `<span class="stock-badge stock-ok">Disponible</span>`;
}

function mostrarProducto(producto, sinMas) {
  codigoMostrado = producto.codigo;
  const cantidad = cantidadEnTicket(producto.codigo);
  productCard.classList.remove('empty');
  productCard.innerHTML = `
    <div class="product-info">
      <div class="product-name">${producto.nombre}</div>
      <div class="product-meta">
        <span>${producto.cat || ''}</span>
        <span>Cód. ${producto.codigo}</span>
        ${stockBadge(producto.stock)}
      </div>
      <div class="limite-msg" id="limiteMsg"${sinMas ? '' : ' hidden'}>Ya no hay más disponible: solo hay ${producto.stock} en inventario.</div>
    </div>
    <div class="qty-stepper">
      <button onclick="cambiarCantidad('${producto.codigo}', -1)">−</button>
      <input type="text" inputmode="numeric" class="qty-input" value="${cantidad}" maxlength="6" autocomplete="off"
             title="Escribe la cantidad (máximo ${producto.stock})"
             onfocus="this.select()"
             oninput="escribirCantidad(this, '${producto.codigo}')"
             onblur="restaurarCantidad(this, '${producto.codigo}')"
             onkeydown="teclaCantidad(event, this)">
      <button onclick="cambiarCantidad('${producto.codigo}', 1)">+</button>
    </div>
    <div class="product-price">${money(producto.precio)}</div>
  `;
}

function mostrarVariasCoincidencias(texto, cantidad) {
  productCard.classList.remove('empty');
  productCard.innerHTML = `
    <div class="product-info">
      <div class="product-name">Hay ${cantidad} productos que empiezan con "${escapar(texto)}"</div>
      <div class="product-meta">
        <span>Elige uno de la lista de abajo o escribe el nombre completo.</span>
      </div>
    </div>
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

// Botones − / + de la tarjeta del producto. Funcionan siempre, aunque el producto
// ya no esté en la factura (por ejemplo, después de quitarlo con la ✕ o de llegar a 0).
function cambiarCantidad(codigo, delta) {
  const producto = buscarEnCache(codigo);
  if (!producto) return;

  const actual = cantidadEnTicket(codigo);
  const nueva = actual + delta;
  if (nueva < 0) { codigoInput.focus(); return; }

  if (nueva > producto.stock) {
    mostrarProducto(producto, true);   // ya no hay más disponible
    flashProductCard();
    codigoInput.focus();
    return;
  }

  const item = ticket.find(i => i.codigo === codigo);
  if (nueva === 0) {
    ticket = ticket.filter(i => i.codigo !== codigo);
  } else if (item) {
    item.cantidad = nueva;
  } else {
    ticket.push({ productoId: producto.id, codigo: producto.codigo, nombre: producto.nombre, precio: producto.precio, cantidad: nueva });
  }
  renderTicket();
  mostrarProducto(producto);
  codigoInput.focus();
}

// Cantidad escrita a mano en la tarjeta del producto:
//  · solo números enteros (se borran letras, símbolos, espacios, signo menos y puntos)
//  · nunca negativa
//  · nunca más que el stock disponible (si se pasa, se deja el máximo y se avisa)
// Se aplica a la factura mientras se escribe.
function escribirCantidad(inp, codigo) {
  const producto = buscarEnCache(codigo);
  if (!producto) return;

  let v = inp.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const aviso = document.getElementById('limiteMsg');
  let pasado = false;
  if (v !== '' && Number(v) > producto.stock) {
    v = String(producto.stock);
    pasado = true;
  }
  inp.value = v;
  if (aviso) aviso.hidden = !pasado;
  if (pasado) flashProductCard();
  if (v === '') return;   // campo vacío: no se cambia nada hasta que salga del campo

  const nueva = Number(v);
  const item = ticket.find(i => i.codigo === codigo);
  if (nueva === 0) {
    ticket = ticket.filter(i => i.codigo !== codigo);
  } else if (item) {
    item.cantidad = nueva;
  } else {
    ticket.push({ productoId: producto.id, codigo: producto.codigo, nombre: producto.nombre, precio: producto.precio, cantidad: nueva });
  }
  renderTicket();
}

// Al salir del campo vacío, vuelve a mostrar la cantidad real de la factura
function restaurarCantidad(inp, codigo) {
  if (inp.value === '') inp.value = cantidadEnTicket(codigo);
}

function teclaCantidad(e, inp) {
  if (e.key === 'Enter') {
    e.preventDefault();
    inp.blur();
    codigoInput.focus();
  } else if (e.key === 'Escape') {
    inp.blur();
    codigoInput.focus();
  }
}

function eliminarDelTicket(codigo) {
  ticket = ticket.filter(i => i.codigo !== codigo);
  renderTicket();
  // Si la tarjeta de arriba muestra ese producto, se actualiza (cantidad 0) para que el + siga funcionando
  if (codigoMostrado === codigo) {
    const producto = buscarEnCache(codigo);
    if (producto) mostrarProducto(producto);
  }
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
  codigoMostrado = null;
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
    const venta = await apiFetch('/ventas', {
      method: 'POST',
      body: JSON.stringify({ usuarioId, items })
    });

    cerrarModalConfirmar();
    generarRecibo(venta);
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

// Recibo con el formato de un ticket de caja: negocio, quién atendió (empleado y su
// correo), administrador, productos con cantidad x precio, y totales.
function generarRecibo(venta) {
  const d = datosRecibo || {};
  const fecha = new Date().toLocaleString('es-CO');
  const cajero = d.empleadoNombre || document.getElementById('cajeroNombre').textContent;
  const empresa = nombreEmpresa || d.empresaNombre || 'CAPCOB';

  // Línea "Etiqueta: valor" (solo si hay valor)
  const dato = (etiqueta, valor) => valor
    ? `<div class="r-line"><span class="r-et">${etiqueta}</span> ${escapar(valor)}</div>`
    : '';

  const filas = ticket.map(item => `
    <div class="r-item">
      <div class="r-item-nom">${escapar(item.nombre)}</div>
      <div class="r-row r-item-det">
        <span>${item.cantidad} x ${money(item.precio)}</span>
        <span>${money(item.precio * item.cantidad)}</span>
      </div>
    </div>
  `).join('');

  const bloqueEmpleado =
    dato('Atendió:', cajero) +
    dato('Correo:', d.empleadoCorreo) +
    dato('Tel.:', d.empleadoTelefono);

  const bloqueAdmin =
    dato('Administrador:', d.adminNombre) +
    dato('Correo:', d.adminCorreo) +
    dato('Tel.:', d.empresaTelefono);

  document.getElementById('reciboContenido').innerHTML = `
    <div class="r-center r-title">${escapar(empresa)}</div>
    ${d.empresaIdentidad ? `<div class="r-center">NIT ${escapar(d.empresaIdentidad)}</div>` : ''}
    <hr/>
    <div class="r-row"><span>${venta && venta.id ? 'Factura N° ' + escapar(venta.id) : 'Factura'}</span><span>Caja 01</span></div>
    <div class="r-line">${fecha}</div>
    <hr/>
    ${bloqueEmpleado}
    ${bloqueAdmin ? '<div class="r-gap"></div>' + bloqueAdmin : ''}
    <hr/>
    ${filas}
    <hr/>
    <div class="r-row"><span>Subtotal</span><span>${subtotalVal.textContent}</span></div>
    <div class="r-row"><span>IVA (19%)</span><span>${ivaVal.textContent}</span></div>
    <div class="r-row r-total"><span>TOTAL</span><span>${totalVal.textContent}</span></div>
    <hr/>
    <div class="r-center">¡Gracias por su compra!</div>
    ${d.adminCorreo ? `<div class="r-center r-chico">Contacto: ${escapar(d.adminCorreo)}</div>` : ''}
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
  if (!e.target.closest('button') && !e.target.closest('.quick-item') && !e.target.closest('.qty-input')) {
    codigoInput.focus();
  }
});
function esCampoCantidad(el) { return !!(el && el.classList && el.classList.contains('qty-input')); }
setInterval(() => {
  if (!camaraActiva && document.activeElement !== codigoInput && !esCampoCantidad(document.activeElement) && !document.querySelector('.modal-overlay.show')) {
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
cargarDatosRecibo();
codigoInput.focus();
// Mantiene el stock al día (por si otro cajero vende o se reabastece mientras esta caja está abierta)
setInterval(() => cargarCatalogo(true), 30000);

// ── Cerrar sesión (botón "Salir"): libera el token en el backend para poder volver
// a iniciar sesión (login de un solo dispositivo) y limpia la sesión local. Es la misma
// lógica de cerrarSesion() de sidebar.js, que esta página no carga.
async function cerrarSesion() {
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
    // Si el backend no responde, igual dejamos salir al usuario localmente.
  } finally {
    sessionStorage.clear();
    window.location.href = '/frontend/paginas/login/login.html';
  }
}