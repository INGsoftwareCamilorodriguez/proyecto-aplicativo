/* ── Datos de ejemplo — reemplaza esto por tu consulta real al backend/BD ── */
  const inventario = [
    { codigo: "7702001001621", nombre: "Coca-Cola 400ml", precio: 2900, stock: 42, cat: "Bebidas" },
    { codigo: "7702001045502", nombre: "Arroz Diana 500g", precio: 3200, stock: 15, cat: "Abarrotes" },
    { codigo: "7701234567890", nombre: "Leche Alquería 1L", precio: 4500, stock: 6, cat: "Lácteos" },
    { codigo: "7709876543210", nombre: "Pan Bimbo Tajado", precio: 6800, stock: 0, cat: "Panadería" },
    { codigo: "7702090001234", nombre: "Café Sello Rojo 250g", precio: 8900, stock: 23, cat: "Abarrotes" },
    { codigo: "7701112223330", nombre: "Papas Margarita 150g", precio: 3900, stock: 31, cat: "Snacks" },
  ];

  let ticket = []; // { codigo, nombre, precio, cantidad }
  let ultimaCantidad = 1;

  const codigoInput = document.getElementById('codigoInput');
  const productCard = document.getElementById('productCard');
  const ticketList = document.getElementById('ticketList');
  const ticketCount = document.getElementById('ticketCount');
  const subtotalVal = document.getElementById('subtotalVal');
  const ivaVal = document.getElementById('ivaVal');
  const totalVal = document.getElementById('totalVal');
  const btnCobrar = document.getElementById('btnCobrar');
  const scanBox = document.getElementById('scanBox');

  function money(n) {
    return '$' + Math.round(n).toLocaleString('es-CO');
  }

  function buscarProducto(codigo) {
    return inventario.find(p => p.codigo === codigo);
  }

  function procesarCodigo() {
    const codigo = codigoInput.value.trim();
    codigoInput.value = '';
    if (!codigo) return;

    const producto = buscarProducto(codigo);
    if (!producto) {
      mostrarNoEncontrado(codigo);
      flashScanBox(false);
      return;
    }
    if (producto.stock <= 0) {
      mostrarSinStock(producto);
      flashScanBox(false);
      return;
    }
    agregarAlTicket(producto, 1);
    mostrarProducto(producto);
    flashScanBox(true);
  }

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
      <div class="product-thumb">${producto.nombre.charAt(0)}</div>
      <div class="product-info">
        <div class="product-name">${producto.nombre}</div>
        <div class="product-meta">
          <span>${producto.cat}</span>
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
      <div class="product-thumb" style="background:var(--red-light);color:var(--red);">!</div>
      <div class="product-info">
        <div class="product-name">Código no encontrado</div>
        <div class="product-meta">
          <span>“${codigo}” no está registrado en el inventario</span>
        </div>
      </div>
    `;
  }

  function mostrarSinStock(producto) {
    productCard.classList.remove('empty');
    productCard.innerHTML = `
      <div class="product-thumb" style="background:var(--red-light);color:var(--red);">${producto.nombre.charAt(0)}</div>
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
      ticket.push({ codigo: producto.codigo, nombre: producto.nombre, precio: producto.precio, cantidad });
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
    const producto = buscarProducto(codigo);
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
          <div>El ticket está vacío.<br/>Escanea un producto para comenzar.</div>
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

  function cancelarVenta() {
    if (ticket.length === 0) return;
    if (!confirm('¿Cancelar la venta en curso? Se perderán los productos escaneados.')) return;
    ticket = [];
    renderTicket();
    productCard.classList.add('empty');
    productCard.innerHTML = `<div>Aún no has escaneado ningún producto</div><div style="font-size:.76rem;">El último producto leído aparecerá aquí</div>`;
    codigoInput.focus();
  }

  function cobrarVenta() {
    if (ticket.length === 0) return;
    mostrarToast(`Venta registrada — ${totalVal.textContent}`);
    ticket = [];
    renderTicket();
    productCard.classList.add('empty');
    productCard.innerHTML = `<div>Aún no has escaneado ningún producto</div><div style="font-size:.76rem;">El último producto leído aparecerá aquí</div>`;
    codigoInput.focus();
  }

  function mostrarToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2600);
  }

  /* Accesos rápidos (productos frecuentes, sin necesidad de escanear) */
  function renderQuickGrid() {
    const grid = document.getElementById('quickGrid');
    grid.innerHTML = inventario.map(p => `
      <div class="quick-item" onclick="agregarRapido('${p.codigo}')">
        <div class="qi-icon">${p.nombre.charAt(0)}</div>
        <div class="qi-name">${p.nombre}</div>
        <div class="qi-price">${money(p.precio)}</div>
      </div>
    `).join('');
  }

  function agregarRapido(codigo) {
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

  /* Mantener el foco siempre en el input, como en un punto de venta real */
  document.addEventListener('click', (e) => {
    if (!e.target.closest('button') && !e.target.closest('.quick-item')) {
      codigoInput.focus();
    }
  });
  setInterval(() => {
    if (document.activeElement !== codigoInput) codigoInput.focus();
  }, 3000);

  /* Reloj */
  function actualizarReloj() {
    const now = new Date();
    document.getElementById('reloj').textContent = now.toLocaleTimeString('es-CO', { hour12: false });
  }
  setInterval(actualizarReloj, 1000);
  actualizarReloj();

  /* ── Sesión y roles ──
     Si nadie inició sesión, no se puede ver esta pantalla: se manda a login.
     El rol "Empleado" se queda encerrado aquí (no ve el link de volver al panel);
     Administrador y Auditor sí pueden volver al dashboard. */
  (function verificarSesion() {
    const rol = localStorage.getItem('rol');
    const username = localStorage.getItem('username');

    if (!rol) {
      window.location.href = "/frontend/paginas/login/login.html";
      return;
    }

    if (username) {
      document.getElementById('cajeroNombre').textContent = username;
      document.getElementById('cajeroInicial').textContent = username.charAt(0).toUpperCase();
    }

    if (rol !== 'Empleado') {
      document.getElementById('volverPanel').style.display = 'inline';
    }
  })();

  renderQuickGrid();
  codigoInput.focus();