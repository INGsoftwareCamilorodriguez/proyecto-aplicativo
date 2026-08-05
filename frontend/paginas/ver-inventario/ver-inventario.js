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