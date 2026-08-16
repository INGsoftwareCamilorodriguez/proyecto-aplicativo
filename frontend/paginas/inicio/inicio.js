// ══════════════════════════════════════════════════════════════
// INICIO / DASHBOARD — CAPCOB
// Conectado al backend real:
//   GET /api/productos
//   GET /api/ventas?inicio=...&fin=...
// ══════════════════════════════════════════════════════════════

const UMBRAL_STOCK_BAJO = 10; // cantidad igual o menor a esto se considera "bajo stock"
const DIAS_GRAFICA = 7;       // días hacia atrás que cubre la gráfica de ventas
const DIAS_ACTIVIDAD = 30;    // rango de búsqueda para "Actividad reciente"
const FILAS_ACTIVIDAD = 6;    // filas que se muestran en "Actividad reciente"

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

function formatFechaISO(d) {
  // formato compatible con LocalDateTime de Java: yyyy-MM-ddTHH:mm:ss
  return d.toISOString().slice(0, 19);
}

function inicioDelDia(d) {
  const copia = new Date(d);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function finDelDia(d) {
  const copia = new Date(d);
  copia.setHours(23, 59, 59, 999);
  return copia;
}

document.addEventListener('DOMContentLoaded', () => {
  cargarResumen();
  cargarGraficaSemanal();
  cargarActividadReciente();
});

// ── Tarjetas superiores: productos registrados, ventas de hoy y bajo stock ──
async function cargarResumen() {
  try {
    const productos = await apiFetch('/productos');
    document.getElementById('statProductos').textContent = productos.length.toLocaleString('es-CO');

    const bajoStock = productos.filter(p => Number(p.cantidad) <= UMBRAL_STOCK_BAJO).length;
    document.getElementById('statBajoStock').textContent = bajoStock.toLocaleString('es-CO');
  } catch (e) {
    document.getElementById('statProductos').textContent = '--';
    document.getElementById('statBajoStock').textContent = '--';
  }

  try {
    const hoy = new Date();
    const ventasHoy = await apiFetch(
      `/ventas?inicio=${formatFechaISO(inicioDelDia(hoy))}&fin=${formatFechaISO(finDelDia(hoy))}`
    );
    document.getElementById('statVentasHoy').textContent = ventasHoy.length.toLocaleString('es-CO');

    const totalHoy = ventasHoy.reduce((suma, v) => suma + Number(v.total), 0);
    document.getElementById('statTotalHoy').textContent = money(totalHoy);
  } catch (e) {
    document.getElementById('statVentasHoy').textContent = '--';
    document.getElementById('statTotalHoy').textContent = '--';
  }
}

// ── Gráfica de barras: total vendido cada uno de los últimos 7 días ──
async function cargarGraficaSemanal() {
  const chart = document.getElementById('barChart');
  const labelsRow = document.getElementById('barChartLabels');

  const hoy = new Date();
  const inicioRango = inicioDelDia(new Date(hoy));
  inicioRango.setDate(inicioRango.getDate() - (DIAS_GRAFICA - 1));

  let ventas = [];
  try {
    ventas = await apiFetch(
      `/ventas?inicio=${formatFechaISO(inicioRango)}&fin=${formatFechaISO(finDelDia(hoy))}`
    );
  } catch (e) {
    chart.innerHTML = `<div style="padding:10px;color:var(--red,#dc2626);font-size:.8rem;">No se pudo cargar la actividad de ventas: ${e.message}</div>`;
    return;
  }

  // Total vendido por cada uno de los últimos DIAS_GRAFICA días
  const dias = [];
  for (let i = 0; i < DIAS_GRAFICA; i++) {
    const fecha = new Date(inicioRango);
    fecha.setDate(inicioRango.getDate() + i);
    dias.push({ fecha, total: 0 });
  }

  ventas.forEach(v => {
    const fechaVenta = new Date(v.fecha);
    const dia = dias.find(d => d.fecha.toDateString() === fechaVenta.toDateString());
    if (dia) dia.total += Number(v.total);
  });

  const maxTotal = Math.max(...dias.map(d => d.total), 1);
  const chartH = 140;

  chart.innerHTML = '';
  labelsRow.innerHTML = '';

  dias.forEach(d => {
    const alturaBarra = Math.max(Math.round((d.total / maxTotal) * chartH), d.total > 0 ? 2 : 0);

    const grupo = document.createElement('div');
    grupo.className = 'bar-group';
    grupo.innerHTML = `
      <div class="bars-pair" style="align-items:flex-end;height:${chartH}px;">
        <div class="bar-col purple" style="height:${alturaBarra}px;width:26px" title="${money(d.total)} el ${d.fecha.toLocaleDateString('es-CO')}"></div>
      </div>
    `;
    chart.appendChild(grupo);

    const label = document.createElement('div');
    label.style.cssText = 'flex:1;text-align:center;font-size:.7rem;color:var(--muted)';
    label.textContent = d.fecha.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '');
    labelsRow.appendChild(label);
  });
}

// ── Tabla "Actividad reciente": últimos productos vendidos, datos reales de /api/ventas ──
async function cargarActividadReciente() {
  const tbody = document.getElementById('actividadBody');

  try {
    const desde = new Date();
    desde.setDate(desde.getDate() - DIAS_ACTIVIDAD);

    const [productos, ventas] = await Promise.all([
      apiFetch('/productos'),
      apiFetch(`/ventas?inicio=${formatFechaISO(desde)}&fin=${formatFechaISO(new Date())}`)
    ]);

    const codigoPorProducto = new Map(productos.map(p => [p.id, p.codigoBarras]));

    // Aplana el detalle de cada venta en filas individuales (una fila por producto vendido)
    const filas = [];
    ventas.forEach(v => {
      v.detalles.forEach(det => {
        filas.push({
          producto: det.nombreProducto,
          codigo: codigoPorProducto.get(det.productoId) || '—',
          fecha: new Date(v.fecha)
        });
      });
    });

    filas.sort((a, b) => b.fecha - a.fecha);

    if (filas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="color:var(--muted)">Aún no hay ventas registradas.</td></tr>';
      return;
    }

    tbody.innerHTML = filas.slice(0, FILAS_ACTIVIDAD).map(f => `
      <tr>
        <td>${f.producto}</td>
        <td>${f.codigo}</td>
        <td>${f.fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</td>
        <td><span class="badge badge-green">Vendido</span></td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--red,#dc2626)">No se pudo cargar la actividad: ${e.message}</td></tr>`;
  }
}
