const meses = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];

  // Datos de ejemplo — puedes reemplazar con datos reales
  const ventas = [0,0,0,0,0,0,0,0,0,0,0,0];

  function calcCrecimiento(actual, anterior) {
    if (anterior === 0) return { val: 0, pct: 0 };
    const crecimiento = actual - anterior;
    const pct = ((crecimiento / anterior) * 100).toFixed(1);
    return { val: crecimiento, pct };
  }

  function formatCurrency(n) {
    return '$' + n.toLocaleString('es-CO');
  }

  function trendHTML(pct) {
    if (pct > 0)  return `<div class="trend-cell trend-up">+ ${pct}% ▲</div>`;
    if (pct < 0)  return `<div class="trend-cell trend-down">${pct}% ▼</div>`;
    return `<div class="trend-cell trend-neutral">+ - %0</div>`;
  }

  function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    meses.forEach((mes, i) => {
      const anterior = i > 0 ? ventas[i-1] : 0;
      const { val, pct } = calcCrecimiento(ventas[i], anterior);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mes-col">${mes}</td>
        <td class="ventas-col">${formatCurrency(ventas[i])}</td>
        <td>${formatCurrency(val)}</td>
        <td>${trendHTML(pct)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function generarRecibo() {
    const total = ventas.reduce((a,b) => a+b, 0);
    let html = '';
    meses.forEach((mes, i) => {
      if (ventas[i] > 0) {
        html += `<div class="modal-row"><span>${mes}</span><span>${formatCurrency(ventas[i])}</span></div>`;
      }
    });
    if (!html) html = `<div class="modal-row"><span>Sin ventas registradas</span><span>$0</span></div>`;
    html += `<div class="modal-row" style="margin-top:8px;border-top:2px solid #e5e7eb;padding-top:10px;">
               <span style="font-weight:700">TOTAL ANUAL</span>
               <span style="color:#a855f7;font-size:1rem">${formatCurrency(total)}</span>
             </div>`;
    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('show');
  }

  function cerrarModal() {
    document.getElementById('modalOverlay').classList.remove('show');
  }

  // cerrar al hacer click fuera
  document.getElementById('modalOverlay').addEventListener('click', function(e) {
    if (e.target === this) cerrarModal();
  });

  renderTable();

  // ── Control de roles ──
  (function() {
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