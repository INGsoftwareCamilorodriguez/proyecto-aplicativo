  // ── BAR CHART ──
  const barCtx = document.getElementById('barChart').getContext('2d');
  new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: ['Producto 1', 'Producto 2', 'Producto 3'],
      datasets: [
        {
          label: 'Ventas Diarias',
          data: [10, 10, 10],
          backgroundColor: '#d1d5db',
          borderRadius: 4,
        },
        {
          label: 'Ventas extra',
          data: [15, 1, 2],
          backgroundColor: '#a855f7',
          borderRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 11 }, boxWidth: 12, padding: 14 }
        }
      },
      scales: {
        x: { stacked: false, grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 } } }
      }
    }
  });

  // ── PIE CHART ──
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: ['PRODUCTO 1', 'PRODUCTO 2', 'PRODUTO 3'],
      datasets: [{
        data: [59.5, 11.9, 28.6],
        backgroundColor: ['#06b6d4', '#0e7490', '#164e63'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { font: { size: 11 }, boxWidth: 12, padding: 14 }
        }
      }
    }
  });

  // ── TAB SWITCH ──
  function setTab(el, tipo) {
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('active');
      t.classList.add('inactive');
    });
    el.classList.remove('inactive');
    el.classList.add('active');
  }

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