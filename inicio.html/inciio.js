// Build bar chart
  const data = [
    { label: 'Lunes',     today: 320, total: 150 },
    { label: 'Martes',    today: 210, total: 140 },
    { label: 'Miércoles', today: 240, total: 160 },
    { label: 'Viernes',   today: 280, total: 130 },
  ];

  const maxVal = 400;
  const chartH = 140;
  const chart  = document.getElementById('barChart');

  data.forEach(d => {
    const hToday = Math.round((d.today / maxVal) * chartH);
    const hTotal = Math.round((d.total / maxVal) * chartH);
    const g = document.createElement('div');
    g.className = 'bar-group';
    g.style.cssText = 'display:flex;flex-direction:column;align-items:center;flex:1;justify-content:flex-end;height:100%';
    g.innerHTML = `
      <div class="bars-pair" style="align-items:flex-end;height:${chartH}px;">
        <div class="bar-col purple" style="height:${hToday}px;width:22px" title="${d.today} escaneos hoy"></div>
        <div class="bar-col gray"   style="height:${hTotal}px;width:22px" title="${d.total} escaneos totales"></div>
      </div>
    `;
    chart.appendChild(g);
  });
  // Nav active state - sin bloquear navegación
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', function() {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    this.classList.add('active');
  });
});

  // ── Control de roles ──
  (function() {
    const rol = localStorage.getItem('rol');
    const username = localStorage.getItem('username');

    // Mostrar nombre real del usuario logueado
    if (username) {
      const nameEl = document.querySelector('.user-name');
      if (nameEl) nameEl.textContent = username;
    }

    // Ocultar "Usuario/Gestión" si no es Administrador
    if (rol !== 'Administrador') {
      document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('href') && item.getAttribute('href').includes('getion_usuario')) {
          item.style.display = 'none';
        }
      });
    }
  })();