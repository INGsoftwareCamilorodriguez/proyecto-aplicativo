// ══════════════════════════════════════════════════════════════
// PRODUCTO DE VENTAS — CAPCOB
// Conectado al backend real:
//   GET /api/ventas/resumen-productos?inicio=...&fin=...
//   GET /api/ventas/resumen-mensual?anio=...
// ══════════════════════════════════════════════════════════════

let barChartInstance = null;
let pieChartInstance = null;
let barChartTodasInstance = null;
let tabActivo = 'todas';

async function apiFetch(path) {
  const res = await fetch(API_BASE_URL + path);
  let data = null;
  try { data = await res.json(); } catch (e) { /* respuesta vacía */ }
  if (!res.ok) {
    const mensaje = (data && data.mensaje) ? data.mensaje : 'Ocurrió un error inesperado.';
    throw new Error(mensaje);
  }
  return data;
}

function money(n) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

// Calcula el rango de fechas [inicio, fin] según el tab activo
function calcularRango(tipo) {
  const fin = new Date();
  const inicio = new Date();
  if (tipo === 'semana') {
    inicio.setDate(fin.getDate() - 7);
  } else if (tipo === 'mes') {
    inicio.setDate(fin.getDate() - 30);
  } else {
    inicio.setFullYear(2000, 0, 1); // "todas las ventas"
  }
  return { inicio, fin };
}

function formatFechaISO(d) {
  // formato compatible con LocalDateTime de Java: yyyy-MM-ddTHH:mm:ss
  return d.toISOString().slice(0, 19);
}

function formatFechaInput(d) {
  // formato yyyy-MM-dd que entiende <input type="date">
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Carga los datos reales de ventas para el rango del tab activo ──
// rangoManual (opcional): { inicio, fin } cuando el usuario busca por fecha
async function cargarDatosVentas(tipo, rangoManual) {
  const { inicio, fin } = rangoManual || calcularRango(tipo);

  const dateRow = document.getElementById('dateRow');
  const cardBarTodas = document.getElementById('cardBarTodas');

  if (tipo === 'todas') {
    dateRow.style.display = 'none';
    cardBarTodas.style.display = '';
  } else {
    cardBarTodas.style.display = 'none';
    dateRow.style.display = 'flex';
    // solo prellenamos los inputs si el usuario no está en medio de una búsqueda manual
    if (!rangoManual) {
      document.getElementById('fechaInicioInput').value = formatFechaInput(inicio);
      document.getElementById('fechaFinInput').value = formatFechaInput(fin);
    }
  }

  const etiquetaTab = tipo === 'semana' ? 'ESTA SEMANA' : tipo === 'mes' ? 'ESTE MES' : 'TODAS LAS VENTAS';
  document.getElementById('chartLabelBar').textContent = etiquetaTab;
  document.getElementById('chartLabelPie').textContent = etiquetaTab;

  const productsGrid = document.getElementById('productsGrid');
  productsGrid.innerHTML = '<div style="padding:20px;color:var(--muted);font-size:.85rem;">Cargando ventas...</div>';

  try {
    const resumen = await apiFetch(
      `/ventas/resumen-productos?inicio=${formatFechaISO(inicio)}&fin=${formatFechaISO(fin)}`
    );
    renderGraficas(resumen);
    renderTarjetas(resumen);
  } catch (e) {
    productsGrid.innerHTML = `<div style="padding:20px;color:var(--red,#dc2626);font-size:.85rem;">No se pudieron cargar las ventas: ${e.message}</div>`;
  }
}

// ── Búsqueda manual por fecha (solo activa en Esta semana / Este mes) ──
function buscarPorFecha() {
  const inicioVal = document.getElementById('fechaInicioInput').value;
  const finVal = document.getElementById('fechaFinInput').value;

  if (!inicioVal || !finVal) {
    alert('Selecciona ambas fechas para buscar.');
    return;
  }

  const inicio = new Date(inicioVal + 'T00:00:00');
  const fin = new Date(finVal + 'T23:59:59');

  if (inicio > fin) {
    alert('La fecha de inicio no puede ser mayor que la fecha final.');
    return;
  }

  cargarDatosVentas(tabActivo, { inicio, fin });
}

// ── Gráficas (semana/mes: barras | todas las ventas: líneas | siempre: pastel con % del total) ──
function renderGraficas(resumen) {
  const top = resumen.slice(0, 8); // hasta 8 productos para que no se amontone

  // Paleta de las gráficas (verde y azul del diseño). Cada producto conserva el mismo
  // color en las tres gráficas porque se asigna según su posición en la lista.
  const PALETA_GRAFICAS = ['#1F8A2B', '#2563EB', '#8BC48F', '#60A5FA', '#1B6B24', '#1E40AF', '#E0A030', '#9CA3AF'];
  const coloresProductos = top.length
    ? top.map((_, i) => PALETA_GRAFICAS[i % PALETA_GRAFICAS.length])
    : [PALETA_GRAFICAS[0]];
  const labels = top.map(r => r.nombreProducto);
  const cantidades = top.map(r => Number(r.cantidadVendida));
  const porcentajes = top.map(r => Number(r.porcentajeDelTotal));

  // "todas las ventas" -> gráfico de líneas | "esta semana" / "este mes" -> gráfico de barras
  const tipoGrafico = tabActivo === 'todas' ? 'line' : 'bar';

  if (barChartInstance) barChartInstance.destroy();
  const barCtx = document.getElementById('barChart').getContext('2d');
  barChartInstance = new Chart(barCtx, {
    type: tipoGrafico,
    data: {
      labels: labels.length ? labels : ['Sin ventas'],
      datasets: [{
        label: 'Unidades vendidas',
        data: cantidades.length ? cantidades : [0],
        backgroundColor: tipoGrafico === 'line' ? 'rgba(31,138,43,.15)' : coloresProductos,
        borderColor: '#1F8A2B',
        borderWidth: tipoGrafico === 'line' ? 2 : 0,
        borderRadius: tipoGrafico === 'bar' ? 4 : 0,
        fill: tipoGrafico === 'line',
        tension: .3,
        pointBackgroundColor: '#1F8A2B',
        pointRadius: tipoGrafico === 'line' ? 4 : 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 } } }
      }
    }
  });

  if (pieChartInstance) pieChartInstance.destroy();
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  pieChartInstance = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: labels.length ? labels.map(l => l.toUpperCase()) : ['SIN VENTAS'],
      datasets: [{
        data: porcentajes.length ? porcentajes : [100],
        backgroundColor: coloresProductos,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12, padding: 14 } }
      }
    }
  });

  // ── Gráfico de barras adicional: SOLO se dibuja en "Todas las ventas" ──
  if (barChartTodasInstance) { barChartTodasInstance.destroy(); barChartTodasInstance = null; }
  if (tabActivo === 'todas') {
    document.getElementById('chartLabelBarTodas').textContent = 'TODAS LAS VENTAS';
    const barTodasCtx = document.getElementById('barChartTodas').getContext('2d');
    barChartTodasInstance = new Chart(barTodasCtx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['Sin ventas'],
        datasets: [{
          label: 'Unidades vendidas',
          data: cantidades.length ? cantidades : [0],
          backgroundColor: coloresProductos,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }
}

// ── Tarjetas: top 3 productos por monto vendido ──
function renderTarjetas(resumen) {
  const productsGrid = document.getElementById('productsGrid');
  const top3 = resumen.slice(0, 3);

  if (top3.length === 0) {
    productsGrid.innerHTML = '<div style="padding:20px;color:var(--muted);font-size:.85rem;">No hay ventas registradas en este período.</div>';
    return;
  }

  productsGrid.innerHTML = top3.map(r => `
    <div class="product-card">
      <div class="prod-label">${r.nombreProducto} - Cantidad:</div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="prod-qty">${Number(r.cantidadVendida)}</div>
        <div class="prod-trend trend-up">
          <span class="trend-icon">📊</span> ${Number(r.porcentajeDelTotal)}%
        </div>
      </div>
      <div class="prod-price-label">Total vendido:</div>
      <div class="prod-price">${money(Number(r.totalVendido))}</div>
    </div>
  `).join('');
}

// ── TAB SWITCH ──
function setTab(el, tipo) {
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.remove('active');
    t.classList.add('inactive');
  });
  el.classList.remove('inactive');
  el.classList.add('active');

  const vistaGraficos = document.getElementById('vistaGraficos');
  const vistaAnual = document.getElementById('vistaAnual');

  if (tipo === 'anual') {
    vistaGraficos.style.display = 'none';
    vistaAnual.style.display = 'block';
    cargarResumenMensual();
  } else {
    vistaGraficos.style.display = '';
    vistaAnual.style.display = 'none';
    tabActivo = tipo;
    cargarDatosVentas(tipo);
  }
}

// ══════════════════════════════════════════════════
// REGISTRO DE VENTAS ANUALES — datos reales del backend
// ══════════════════════════════════════════════════
const mesesAnual = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

let ventasAnual = [0,0,0,0,0,0,0,0,0,0,0,0];

function formatCurrency(n) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

function calcCrecimiento(actual, anterior) {
  if (anterior === 0) return { val: actual, pct: 0 };
  const crecimiento = actual - anterior;
  const pct = ((crecimiento / anterior) * 100).toFixed(1);
  return { val: crecimiento, pct };
}

function trendHTML(pct) {
  if (pct > 0)  return `<div class="trend-cell trend-up">+ ${pct}% ▲</div>`;
  if (pct < 0)  return `<div class="trend-cell trend-down">${pct}% ▼</div>`;
  return `<div class="trend-cell trend-neutral">+ - %0</div>`;
}

async function cargarResumenMensual() {
  const tbody = document.getElementById('tableBodyAnual');
  tbody.innerHTML = `<tr><td colspan="4" style="padding:20px;color:var(--muted);">Cargando...</td></tr>`;
  try {
    const anio = new Date().getFullYear();
    const resumen = await apiFetch(`/ventas/resumen-mensual?anio=${anio}`);
    ventasAnual = resumen.map(r => Number(r.total));
    renderTableAnual();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding:20px;color:#dc2626;">No se pudo cargar el resumen anual: ${e.message}</td></tr>`;
  }
}

function renderTableAnual() {
  const tbody = document.getElementById('tableBodyAnual');
  tbody.innerHTML = '';
  mesesAnual.forEach((mes, i) => {
    const anterior = i > 0 ? ventasAnual[i-1] : 0;
    const { val, pct } = calcCrecimiento(ventasAnual[i], anterior);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mes-col">${mes}</td>
      <td class="ventas-col">${formatCurrency(ventasAnual[i])}</td>
      <td>${formatCurrency(val)}</td>
      <td>${trendHTML(pct)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function generarRecibo() {
  const total = ventasAnual.reduce((a,b) => a+b, 0);
  let html = '';
  mesesAnual.forEach((mes, i) => {
    if (ventasAnual[i] > 0) {
      html += `<div class="modal-row"><span>${mes}</span><span>${formatCurrency(ventasAnual[i])}</span></div>`;
    }
  });
  if (!html) html = `<div class="modal-row"><span>Sin ventas registradas</span><span>$0</span></div>`;
  html += `<div class="modal-row" style="margin-top:8px;border-top:2px solid #e5e7eb;padding-top:10px;">
             <span style="font-weight:700">TOTAL ANUAL</span>
             <span style="color:#1F8A2B;font-size:1rem">${formatCurrency(total)}</span>
           </div>`;
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('show');
}

function cerrarModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

document.getElementById('modalOverlay').addEventListener('click', function(e) {
  if (e.target === this) cerrarModal();
});

// ── Carga inicial: gráficas con "todas las ventas" ──
cargarDatosVentas('todas');

// ── Control de roles ──
(function() {
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