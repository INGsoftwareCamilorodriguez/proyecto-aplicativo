// ══════════════════════════════════════════════════════════════
// CAJA — ESCANEAR CÓDIGO DE BARRAS — CAPCOB
// Conectado al backend real: GET /api/productos/codigo/{codigo}
// y GET /api/productos (para el panel de accesos rápidos).
// ══════════════════════════════════════════════════════════════

let ticket = []; // { codigo, nombre, precio, cantidad }
let productosCache = []; // catálogo completo del backend (para la búsqueda en vivo)
let recientes = [];  // ids de producto en orden de uso (más reciente primero). Lo que se muestra en
                     // "Productos escaneados" sale SIEMPRE de la factura, así nunca quedan desfasados.
let html5QrCode = null;
let camaraActiva = false;
let procesandoCodigo = false;   // evita lecturas duplicadas mientras se consulta al servidor
let modoEscaneo = 'usb';        // 'usb' | 'camara'
const LS_ESCANEO = 'capcob_escaneo';
const LS_PAPEL = 'capcob_papel_mm';
let ultimoCodigoCamara = null;
let ultimoCodigoCamaraTs = 0;
let datosRecibo = null;     // empleado + administrador que salen en el recibo
let nombreEmpresa = null;   // nombre del negocio (Configuración)
let idMostrado = null;     // id del producto que se ve en la tarjeta de "último producto"

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

function buscarPorId(id) {
  return productosCache.find(p => p.id === Number(id));
}

// ── Productos por peso (carne, queso por kilo...) ──
// El administrador solo define el PRECIO POR KILO. Aquí el cajero elige cuánto lleva el cliente
// (kilo, libra, media libra, cuarto de libra o gramos) y se convierte SIEMPRE a kilos:
// así el precio, el inventario y el recibo usan la misma unidad. 1 libra = 500 g.
const UNIDADES_PESO = { kg: 1, lb: 0.5, g: 0.001 };
const PESOS_RAPIDOS = [
  { etq: '¼ libra', sub: '125 g', kg: 0.125 },
  { etq: '½ libra', sub: '250 g', kg: 0.25 },
  { etq: '1 libra', sub: '500 g', kg: 0.5 },
  { etq: '1 kilo',  sub: '1 kg',  kg: 1 }
];

function esPeso(p) { return !!p && p.tipoPrecio === 'PESO'; }
function redondearKg(x) { return Math.round(x * 1000) / 1000; }

function formatearPeso(kg) {
  kg = redondearKg(kg);
  if (kg < 1) return Math.round(kg * 1000) + ' g';
  return kg.toLocaleString('es-CO', { maximumFractionDigits: 3 }) + ' kg';
}

function equivalenciaLibras(kg) {
  const lb = Math.round(kg * 2 * 100) / 100;
  const ent = Math.floor(lb);
  const dec = Math.round((lb - ent) * 100) / 100;
  const fr = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[dec];
  let t;
  if (dec === 0) t = String(ent);
  else if (fr) t = (ent ? ent + ' ' : '') + fr;
  else t = lb.toLocaleString('es-CO', { maximumFractionDigits: 2 });
  return t + ' lb';
}

// Texto de la cantidad de una línea de la factura: "x3" o "250 g"
function textoCantidad(item) {
  return item.tipoPrecio === 'PESO' ? formatearPeso(item.cantidad) : 'x' + item.cantidad;
}

// Cantidad de un producto en la factura (siempre por id: dos productos nunca se mezclan)
function cantidadEnTicket(id) {
  const item = ticket.find(i => i.productoId === Number(id));
  return item ? item.cantidad : 0;
}

// Limpia lo que llega del teclado, lector o cámara: sin caracteres de control,
// espacios repetidos ni textos kilométricos
function limpiarEntrada(texto) {
  return String(texto == null ? '' : texto)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

// ¿Tiene pinta de código de barras? (sin espacios, 6+ caracteres y al menos un número).
// Solo en ese caso se consulta al servidor; escribir "quso" o "12" nunca genera una solicitud.
function pareceCodigo(texto) {
  return /^[0-9A-Za-z\-._]{6,40}$/.test(texto) && /\d/.test(texto);
}

// ── "Productos escaneados": exactamente los productos que están en la factura ──
function marcarReciente(id) {
  id = Number(id);
  recientes = recientes.filter(x => x !== id);
  recientes.unshift(id);
}

function renderGridEscaneados() {
  quickGridLabel.textContent = 'Productos escaneados';
  const lista = recientes
    .map(id => ({ p: buscarPorId(id), cant: cantidadEnTicket(id) }))
    .filter(x => x.p && x.cant > 0)
    .slice(0, 12);

  if (lista.length === 0) {
    quickGrid.innerHTML = '<div class="quick-loading">Los productos que escanees en esta venta van a aparecer aquí.</div>';
    return;
  }
  quickGrid.innerHTML = lista.map(({ p, cant }) => `
    <div class="quick-item" data-id="${p.id}" data-modo="ver" title="Ver / cambiar la cantidad de ${escapar(p.nombre)}">
      <span class="qi-qty">${esPeso(p) ? formatearPeso(cant) : 'x' + cant}</span>
      <div class="qi-name">${escapar(p.nombre)}</div>
      <div class="qi-price">${money(p.precio)}</div>
    </div>
  `).join('');
}

// ── Vista mientras se escribe: búsqueda en vivo contra todo el catálogo ──
// Por nombre: el nombre tiene que EMPEZAR con lo escrito, sin importar mayúsculas ni tildes.
// Por código: coincidencia EXACTA únicamente.
function renderGridBusqueda(texto) {
  quickGridLabel.textContent = 'Resultados de búsqueda';
  const t = sinTildes(texto.trim());
  const resultados = productosCache
    .filter(p => sinTildes(p.nombre).startsWith(t) || p.codigo.toLowerCase() === t)
    .slice(0, 12);

  if (resultados.length === 0) {
    quickGrid.innerHTML = `<div class="quick-loading">Sin coincidencias para "${escapar(texto)}"</div>`;
    return;
  }
  quickGrid.innerHTML = resultados.map(p => `
    <div class="quick-item" data-id="${p.id}" data-modo="agregar">
      <div class="qi-name">${escapar(p.nombre)}</div>
      <div class="qi-price">${money(p.precio)}</div>
    </div>
  `).join('');
}

// Un clic en una tarjeta:
//  · resultado de búsqueda   -> agrega UNA unidad de ESE producto
//  · producto ya escaneado   -> solo lo muestra arriba (no suma nada); ahí se cambia la cantidad
quickGrid.addEventListener('click', (e) => {
  const tarjeta = e.target.closest('.quick-item');
  if (!tarjeta) return;
  const producto = buscarPorId(tarjeta.dataset.id);
  if (!producto) return;
  if (tarjeta.dataset.modo === 'agregar') {
    codigoInput.value = '';
    renderGridEscaneados();
    intentarAgregar(producto);
  } else {
    mostrarProducto(producto);
    enfocarBuscador();
  }
});

// ── Buscar y agregar producto por código escaneado/tecleado ────
// Se busca en el catálogo en memoria. Si no hay NADA relacionado, lo escrito se queda en el
// buscador (no se borra) y no se hace ninguna solicitud al servidor, salvo que lo escrito
// tenga forma de código de barras (producto nuevo que aún no está en memoria).
async function procesarCodigo() {
  const texto = limpiarEntrada(codigoInput.value);
  if (!texto) { renderGridEscaneados(); return; }
  if (procesandoCodigo) return;

  // 1) Código de barras exacto
  let producto = buscarEnCache(texto);

  // 2) Por nombre: exacto -> ese; una sola coincidencia -> esa; varias -> pide elegir
  if (!producto) {
    const coincidencias = buscarPorNombre(texto);
    const exacto = coincidencias.find(p => sinTildes(p.nombre) === sinTildes(texto));
    if (exacto) {
      producto = exacto;
    } else if (coincidencias.length === 1) {
      producto = coincidencias[0];
    } else if (coincidencias.length > 1) {
      idMostrado = null;
      mostrarVariasCoincidencias(texto, coincidencias.length);
      flashScanBox(false);
      return;   // se deja lo escrito y la lista de resultados para que elija
    }
  }

  // 3) Código que no está en memoria -> se consulta al backend (solo si parece un código)
  if (!producto && pareceCodigo(texto)) {
    procesandoCodigo = true;
    try {
      const data = await apiFetch(`/productos/codigo/${encodeURIComponent(texto)}`);
      producto = normalizarProducto(data);
      if (!buscarPorId(producto.id)) productosCache.push(producto);
    } catch (e) {
      producto = null;
    } finally {
      procesandoCodigo = false;
    }
  }

  // 4) Nada relacionado: NO se borra lo escrito, queda ahí para corregirlo
  if (!producto) {
    idMostrado = null;
    mostrarNoEncontrado(texto);
    marcarBusquedaFallida(true);
    flashScanBox(false);
    enfocarBuscador();
    codigoInput.select();
    renderGridBusqueda(texto);
    return;
  }

  // Encontrado: ahora sí se limpia el campo
  marcarBusquedaFallida(false);
  codigoInput.value = '';
  renderGridEscaneados();
  intentarAgregar(producto);
}

// Borde rojo en el buscador mientras lo escrito no corresponda a ningún producto
function marcarBusquedaFallida(si) {
  codigoInput.classList.toggle('no-encontrado', !!si);
}

// Agrega UNA unidad respetando el stock disponible
function intentarAgregar(producto) {
  if (producto.stock <= 0) {
    idMostrado = null;
    mostrarSinStock(producto);
    flashProductCard();
    return;
  }
  if (esPeso(producto)) {
    // Por peso no se suma "1": se muestra el producto y el cajero elige cuánto lleva el cliente.
    mostrarProducto(producto);
    flashProductOk();
    return;
  }
  if (cantidadEnTicket(producto.id) + 1 > producto.stock) {
    mostrarProducto(producto, true);   // con el aviso de "ya no hay más disponible"
    flashProductCard();
    return;
  }
  agregarAlTicket(producto, 1);
  mostrarProducto(producto);
  flashProductOk();
}

// Mientras el cajero escribe, filtra en vivo; al borrar todo, vuelve al historial
codigoInput.addEventListener('input', () => {
  marcarBusquedaFallida(false);
  const val = codigoInput.value;
  if (val.trim().length === 0) {
    renderGridEscaneados();
  } else {
    renderGridBusqueda(val);
  }
});

// En celular/tablet NO se le devuelve el foco al buscador: subía la pantalla y abría el teclado
// cada vez que se tocaba un botón de la tarjeta. En PC (lector USB) sigue igual, pero sin hacer scroll.
const ES_TACTIL = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
function enfocarBuscador() {
  if (ES_TACTIL) return;
  codigoInput.focus({ preventScroll: true });
}

function flashScanBox(ok) {
  scanBox.classList.remove('flash-ok', 'flash-err');
  void scanBox.offsetWidth; // reinicia la animación
  scanBox.classList.add(ok ? 'flash-ok' : 'flash-err');
  setTimeout(() => scanBox.classList.remove('flash-ok', 'flash-err'), 500);
}

// Brillo rojo en la tarjeta del PRODUCTO (no en el buscador) cuando se pasa del stock
function flashProductCard() {
  productCard.classList.remove('flash-ok', 'flash-err');
  void productCard.offsetWidth; // reinicia la animación
  productCard.classList.add('flash-err');
  clearTimeout(flashProductCard._t);
  flashProductCard._t = setTimeout(() => productCard.classList.remove('flash-err'), 700);
}

// Brillo verde en la tarjeta del PRODUCTO cuando la acción salió bien (peso elegido, cantidad cambiada…)
function flashProductOk() {
  productCard.classList.remove('flash-ok', 'flash-err');
  void productCard.offsetWidth; // reinicia la animación
  productCard.classList.add('flash-ok');
  clearTimeout(flashProductOk._t);
  flashProductOk._t = setTimeout(() => productCard.classList.remove('flash-ok'), 600);
}

function stockBadge(stock, peso) {
  if (stock <= 0) return '<span class="stock-badge stock-out">Sin stock</span>';
  if (stock <= 8) return `<span class="stock-badge stock-low">Quedan ${peso ? formatearPeso(stock) : stock}</span>`;
  return `<span class="stock-badge stock-ok">Disponible</span>`;
}

function mostrarProducto(producto, sinMas) {
  if (esPeso(producto)) { mostrarProductoPeso(producto, sinMas); return; }
  idMostrado = producto.id;
  const cantidad = cantidadEnTicket(producto.id);
  productCard.classList.remove('empty');
  productCard.innerHTML = `
    <div class="product-info">
      <div class="product-name">${escapar(producto.nombre)}</div>
      <div class="product-meta">
        <span>${escapar(producto.cat || '')}</span>
        <span>Cód. ${escapar(producto.codigo)}</span>
        ${stockBadge(producto.stock)}
      </div>
      <div class="limite-msg" id="limiteMsg"${sinMas ? '' : ' hidden'}>Ya no hay más disponible: solo hay ${producto.stock} en inventario.</div>
    </div>
    <div class="qty-stepper">
      <button onclick="cambiarCantidad(${producto.id}, -1)">−</button>
      <input type="text" inputmode="numeric" class="qty-input" value="${cantidad}" maxlength="6" autocomplete="off"
             title="Escribe la cantidad (máximo ${producto.stock})"
             onfocus="this.select()"
             oninput="escribirCantidad(this, ${producto.id})"
             onblur="restaurarCantidad(this, ${producto.id})"
             onkeydown="teclaCantidad(event, this)">
      <button onclick="cambiarCantidad(${producto.id}, 1)">+</button>
    </div>
    <div class="product-price">${money(producto.precio)}</div>
  `;
}

// Tarjeta de un producto por peso: botones rápidos + cantidad a la medida (gramos, libras o kilos)
function mostrarProductoPeso(producto, sinMas) {
  idMostrado = producto.id;
  const kg = cantidadEnTicket(producto.id);
  const actual = kg > 0
    ? `En la factura: <b>${formatearPeso(kg)}</b> <span class="peso-eq">(${equivalenciaLibras(kg)})</span>`
    : 'Elige cuánto lleva el cliente';
  const rapidos = PESOS_RAPIDOS.map(r => `
        <button type="button" class="peso-rapido${redondearKg(kg) === r.kg ? ' sel' : ''}" onclick="elegirPeso(${producto.id}, ${r.kg})">
          ${r.etq}<small>${r.sub}</small>
        </button>`).join('');

  productCard.classList.remove('empty');
  productCard.innerHTML = `
    <div class="peso-layout">
      <div class="product-info">
        <div class="product-name">${escapar(producto.nombre)}</div>
        <div class="product-meta">
          <span>${escapar(producto.cat || '')}</span>
          <span>Cód. ${escapar(producto.codigo)}</span>
          ${stockBadge(producto.stock, true)}
        </div>
        <div class="limite-msg" id="limiteMsg"${sinMas ? '' : ' hidden'}>No alcanza: solo hay ${formatearPeso(producto.stock)} en inventario.</div>
        <div class="peso-actual">${actual}</div>
      </div>
      <div class="product-price">${money(producto.precio)}<small class="por-kg">por kg</small></div>

      <div class="peso-controles">
        <div class="peso-rapidos">${rapidos}
        </div>
        <div class="peso-custom">
          <input type="text" inputmode="decimal" class="peso-input" id="pesoInput" placeholder="Otra cantidad" maxlength="8" autocomplete="off"
                 onkeydown="if(event.key==='Enter'){event.preventDefault();aplicarPesoPersonalizado(${producto.id});}">
          <select class="peso-unidad" id="pesoUnidad">
            <option value="g">gramos</option>
            <option value="lb">libras</option>
            <option value="kg">kilos</option>
          </select>
          <button type="button" class="peso-aplicar" onclick="aplicarPesoPersonalizado(${producto.id})">Poner</button>
        </div>
      </div>
    </div>
  `;
}

// Fija el peso (en kilos) que lleva el cliente de ese producto
function elegirPeso(id, kg) {
  const producto = buscarPorId(id);
  if (!producto) return;
  kg = redondearKg(kg);
  if (kg < 0.001) { flashProductCard(); return; }
  if (kg > producto.stock) {
    mostrarProducto(producto, true);   // no alcanza el inventario
    flashProductCard();
    return;
  }
  fijarCantidad(producto, kg);
  mostrarProducto(producto);
  flashProductOk();
  enfocarBuscador();
}

function aplicarPesoPersonalizado(id) {
  const inp = document.getElementById('pesoInput');
  const unidad = document.getElementById('pesoUnidad').value;
  const n = parseFloat(String(inp.value).replace(',', '.'));
  if (!isFinite(n) || n <= 0) { flashProductCard(); inp.focus(); return; }
  elegirPeso(id, n * UNIDADES_PESO[unidad]);
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

function mostrarNoEncontrado(texto) {
  productCard.classList.remove('empty');
  productCard.innerHTML = `
    <div class="product-info">
      <div class="product-name">Código no encontrado</div>
      <div class="product-meta">
        <span>"${escapar(texto)}" no está registrado en el inventario. Revísalo y corrígelo en el buscador.</span>
      </div>
    </div>
  `;
}

function mostrarSinStock(producto) {
  productCard.classList.remove('empty');
  productCard.innerHTML = `
    <div class="product-info">
      <div class="product-name">${escapar(producto.nombre)}</div>
      <div class="product-meta">
        <span>Sin unidades disponibles en este momento</span>
      </div>
    </div>
  `;
}

function agregarAlTicket(producto, cantidad) {
  const existente = ticket.find(i => i.productoId === producto.id);
  if (existente) {
    existente.cantidad += cantidad;
  } else {
    ticket.push({ productoId: producto.id, codigo: producto.codigo, nombre: producto.nombre, precio: producto.precio, tipoPrecio: producto.tipoPrecio, cantidad });
  }
  marcarReciente(producto.id);
  renderTicket();
}

// Fija la cantidad EXACTA de UN producto en la factura (0 = quitarlo). Nunca toca otros productos.
function fijarCantidad(producto, nueva) {
  const item = ticket.find(i => i.productoId === producto.id);
  if (nueva <= 0) {
    ticket = ticket.filter(i => i.productoId !== producto.id);
    recientes = recientes.filter(x => x !== producto.id);
  } else if (item) {
    item.cantidad = nueva;
    marcarReciente(producto.id);
  } else {
    ticket.push({ productoId: producto.id, codigo: producto.codigo, nombre: producto.nombre, precio: producto.precio, tipoPrecio: producto.tipoPrecio, cantidad: nueva });
    marcarReciente(producto.id);
  }
  renderTicket();
}

// Botones − / + de la tarjeta del producto: solo afectan al producto que se ve en la tarjeta.
function cambiarCantidad(id, delta) {
  const producto = buscarPorId(id);
  if (!producto) return;

  const nueva = cantidadEnTicket(id) + delta;
  if (nueva < 0) { enfocarBuscador(); return; }

  if (nueva > producto.stock) {
    mostrarProducto(producto, true);   // ya no hay más disponible
    flashProductCard();
    enfocarBuscador();
    return;
  }
  fijarCantidad(producto, nueva);
  mostrarProducto(producto);
  flashProductOk();
  enfocarBuscador();
}

// Cantidad escrita a mano: solo enteros, nunca negativa, nunca más que el stock.
function escribirCantidad(inp, id) {
  const producto = buscarPorId(id);
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

  fijarCantidad(producto, Number(v));
}

// Al salir del campo vacío, vuelve a mostrar la cantidad real de la factura
function restaurarCantidad(inp, id) {
  if (inp.value === '') inp.value = cantidadEnTicket(id);
}

function teclaCantidad(e, inp) {
  if (e.key === 'Enter') {
    e.preventDefault();
    inp.blur();
    enfocarBuscador();
  } else if (e.key === 'Escape') {
    inp.blur();
    enfocarBuscador();
  }
}

// Quitar de la factura (✕): también sale de "Productos escaneados"
function eliminarDelTicket(id) {
  id = Number(id);
  ticket = ticket.filter(i => i.productoId !== id);
  recientes = recientes.filter(x => x !== id);
  renderTicket();
  if (idMostrado === id) {
    const producto = buscarPorId(id);
    if (producto) mostrarProducto(producto);   // queda en 0 para que el + siga funcionando
  }
  enfocarBuscador();
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
          <div class="tn">${escapar(item.nombre)}</div>
          <div class="tp">${money(item.precio)} ${item.tipoPrecio === 'PESO' ? 'por kg' : 'c/u'}</div>
        </div>
        <div class="tr-qty">${textoCantidad(item)}</div>
        <div class="tr-sub">${money(item.precio * item.cantidad)}</div>
        <button class="tr-del" onclick="eliminarDelTicket(${item.productoId})" title="Quitar">✕</button>
      </div>
    `).join('');
  }

  // un producto por peso cuenta como 1 ítem (no como sus kilos)
  const totalItems = ticket.reduce((a, i) => a + (i.tipoPrecio === 'PESO' ? 1 : i.cantidad), 0);
  ticketCount.textContent = `${totalItems} item${totalItems === 1 ? '' : 's'}`;

  const subtotal = ticket.reduce((a, i) => a + i.precio * i.cantidad, 0);
  const iva = subtotal * 0.19;
  const total = subtotal + iva;

  subtotalVal.textContent = money(subtotal);
  ivaVal.textContent = money(iva);
  totalVal.textContent = money(total);

  btnCobrar.disabled = ticket.length === 0;
  renderGridEscaneados_siCorresponde();
}

// Si el cajero no está buscando nada, "Productos escaneados" se mantiene al día con la factura
function renderGridEscaneados_siCorresponde() {
  if (codigoInput.value.trim() === '') renderGridEscaneados();
}

function limpiarVentaEnCurso() {
  ticket = [];
  recientes = [];
  idMostrado = null;
  marcarBusquedaFallida(false);
  renderTicket();
  productCard.classList.add('empty');
  productCard.innerHTML = `<div>Aún no has escaneado ningún producto</div><div style="font-size:.76rem;">El último producto leído aparecerá aquí</div>`;
}

function cancelarVenta() {
  if (ticket.length === 0) return;
  if (!confirm('¿Cancelar la venta en curso? Se perderán los productos escaneados.')) return;
  limpiarVentaEnCurso();
  enfocarBuscador();
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
        <span>${item.tipoPrecio === 'PESO' ? formatearPeso(item.cantidad) + ' x ' + money(item.precio) + '/kg' : item.cantidad + ' x ' + money(item.precio)}</span>
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

// Papel de ticket (58 mm o 80 mm): ajusta el tamaño de página de impresión y el ancho del recibo
function aplicarPapel(mm) {
  mm = (mm === 58) ? 58 : 80;
  let estilo = document.getElementById('estiloPapel');
  if (!estilo) {
    estilo = document.createElement('style');
    estilo.id = 'estiloPapel';
    document.head.appendChild(estilo);
  }
  // alto automático: la hoja mide lo que mida el ticket (no es una hoja carta/A4)
  estilo.textContent = `@page { size: ${mm}mm auto; margin: 0; }`;
  const recibo = document.getElementById('reciboContenido');
  recibo.classList.remove('papel-58', 'papel-80');
  recibo.classList.add('papel-' + mm);
  document.querySelectorAll('.papel-opt').forEach(b => b.classList.toggle('sel', Number(b.dataset.mm) === mm));
  try { localStorage.setItem(LS_PAPEL, String(mm)); } catch (e) {}
}

function imprimirTicket() {
  window.print();
}

function cerrarModalTicket() {
  document.getElementById('modalTicket').classList.remove('show');
  limpiarVentaEnCurso();
  enfocarBuscador();
}

function mostrarToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

// ── Elegir cómo escanear: cámara del dispositivo, cámara externa, lector USB/Bluetooth ──
const modalEscaner = document.getElementById('modalEscaner');
const modoEscaneoTxt = document.getElementById('modoEscaneo');
const panelCamaras = document.getElementById('panelCamaras');
const selCamara = document.getElementById('selCamara');
const escanerMsg = document.getElementById('escanerMsg');

function guardarPreferencia(obj) {
  try { localStorage.setItem(LS_ESCANEO, JSON.stringify(obj)); } catch (e) { /* sin almacenamiento */ }
}
function leerPreferencia() {
  try { return JSON.parse(localStorage.getItem(LS_ESCANEO)) || {}; } catch (e) { return {}; }
}

function setModo(modo, etiqueta) {
  modoEscaneo = modo;
  modoEscaneoTxt.textContent = etiqueta ? '· ' + etiqueta : '';
  btnCamara.classList.toggle('active', modo !== 'usb' || camaraActiva);
}

function msgEscaner(texto, error) {
  escanerMsg.textContent = texto || '';
  escanerMsg.classList.toggle('error', !!error);
}

// El botón principal: si la cámara está encendida la apaga; si no, pregunta cómo escanear
function toggleCamara() {
  if (camaraActiva) { detenerCamara(); return; }
  abrirModalEscaner();
}

function abrirModalEscaner() {
  panelCamaras.hidden = true;
  msgEscaner('');
  const pref = leerPreferencia();
  document.querySelectorAll('.scan-opt').forEach(b => b.classList.toggle('sel', b.dataset.opt === pref.opt));
  modalEscaner.classList.add('show');
}

function cerrarModalEscaner() {
  modalEscaner.classList.remove('show');
  enfocarBuscador();
}

async function elegirOpcionEscaneo(opt) {
  msgEscaner('');
  panelCamaras.hidden = true;

  if (opt === 'camara-dispositivo') {
    guardarPreferencia({ opt });
    cerrarModalEscaner();
    iniciarCamara(null, 'Cámara del dispositivo');
  } else if (opt === 'camara-externa') {
    await listarCamaras();
  } else if (opt === 'lector-usb') {
    guardarPreferencia({ opt });
    if (camaraActiva) await detenerCamara();
    setModo('usb', 'Lector USB / Bluetooth');
    btnCamara.classList.add('active');
    cerrarModalEscaner();
    mostrarToast('Lector USB listo: escanea y el código se agrega solo');
  }
}

// Pide permiso (sin él el navegador oculta los nombres) y lista TODAS las cámaras conectadas
async function listarCamaras() {
  if (typeof Html5Qrcode === 'undefined') { msgEscaner('No se pudo cargar el lector de cámara. Revisa tu conexión a internet.', true); return; }
  if (!window.isSecureContext) { msgEscaner('El navegador solo permite usar la cámara en https o localhost.', true); return; }
  msgEscaner('Buscando cámaras…');
  try {
    const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
    tmp.getTracks().forEach(t => t.stop());
    const camaras = await Html5Qrcode.getCameras();
    if (!camaras || camaras.length === 0) { msgEscaner('No se detectó ninguna cámara. Conecta la cámara externa y vuelve a intentar.', true); return; }
    const pref = leerPreferencia();
    selCamara.innerHTML = camaras.map((c, i) =>
      `<option value="${escapar(c.id)}">${escapar(c.label || ('Cámara ' + (i + 1)))}</option>`).join('');
    if (pref.camaraId && camaras.some(c => c.id === pref.camaraId)) selCamara.value = pref.camaraId;
    else if (camaras.length > 1) selCamara.selectedIndex = camaras.length - 1;   // normalmente la externa se lista al final
    panelCamaras.hidden = false;
    msgEscaner(camaras.length === 1 ? 'Solo se detectó una cámara.' : `${camaras.length} cámaras detectadas. Elige la que quieres usar.`);
  } catch (err) {
    msgEscaner('No se pudo acceder a las cámaras: permiso denegado o cámara en uso.', true);
  }
}

function usarCamaraSeleccionada() {
  const id = selCamara.value;
  if (!id) return;
  const nombre = selCamara.options[selCamara.selectedIndex].text;
  guardarPreferencia({ opt: 'camara-externa', camaraId: id });
  cerrarModalEscaner();
  iniciarCamara(id, nombre);
}

// ── Cámara (html5-qrcode) ──
async function iniciarCamara(camaraId, etiqueta) {
  if (typeof Html5Qrcode === 'undefined') {
    alert('No se pudo cargar el lector de cámara. Revisa tu conexión a internet.');
    return;
  }
  if (camaraActiva) await detenerCamara();

  camaraWrap.style.display = 'block';
  btnCamara.classList.add('active');
  btnCamara.textContent = '⏹ Detener cámara';
  camaraActiva = true;
  setModo('camara', etiqueta || 'Cámara');

  html5QrCode = new Html5Qrcode('camaraReader', { experimentalFeatures: { useBarCodeDetectorIfSupported: true } });
  const config = { fps: 10, qrbox: { width: 260, height: 140 } };
  const ok = (texto) => onCodigoExterno(texto);
  const ignorar = () => {};

  try {
    if (camaraId) {
      await html5QrCode.start(camaraId, config, ok, ignorar);
    } else {
      try {
        await html5QrCode.start({ facingMode: 'environment' }, config, ok, ignorar);
      } catch (e) {
        // sin cámara trasera (laptop): usa la que haya
        await html5QrCode.start({ facingMode: 'user' }, config, ok, ignorar);
      }
    }
  } catch (err) {
    alert('No se pudo acceder a la cámara: ' + err);
    detenerCamara();
  }
}

async function detenerCamara() {
  camaraActiva = false;
  btnCamara.textContent = '📷 Escanear';
  camaraWrap.style.display = 'none';
  const qr = html5QrCode;
  html5QrCode = null;
  if (qr) {
    try { await qr.stop(); qr.clear(); } catch (e) { /* ya estaba detenida */ }
  }
  setModo('usb', 'Lector USB / teclado');
  btnCamara.classList.remove('active');
  enfocarBuscador();
}

// Código recibido de la cámara
function onCodigoExterno(codigo) {
  codigo = limpiarEntrada(codigo);
  if (!codigo) return;
  // evita agregar el mismo código varias veces seguidas mientras la cámara sigue enfocando
  const ahora = Date.now();
  if (codigo === ultimoCodigoCamara && (ahora - ultimoCodigoCamaraTs) < 2500) return;
  ultimoCodigoCamara = codigo;
  ultimoCodigoCamaraTs = ahora;

  codigoInput.value = codigo;
  procesarCodigo();
}

window.addEventListener('beforeunload', () => {
  try { if (html5QrCode) html5QrCode.stop(); } catch (e) {}
});

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
  if (!e.target.closest('button') && !e.target.closest('.quick-item') && !e.target.closest('.qty-input') && !e.target.closest('.peso-custom')) {
    enfocarBuscador();
  }
});
function esCampoCantidad(el) { return !!(el && el.classList && (el.classList.contains('qty-input') || el.classList.contains('peso-input') || el.classList.contains('peso-unidad'))); }
setInterval(() => {
  if (!camaraActiva && document.activeElement !== codigoInput && !esCampoCantidad(document.activeElement) && !document.querySelector('.modal-overlay.show')) {
    enfocarBuscador();
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

setModo('usb', 'Lector USB / teclado');
cargarCatalogo();
cargarDatosRecibo();
aplicarPapel(Number((function(){ try { return localStorage.getItem(LS_PAPEL); } catch (e) { return null; } })()) || 80);
enfocarBuscador();
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