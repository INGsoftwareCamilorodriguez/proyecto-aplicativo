const USERS = {
    'admin':   { password: '1234', role: 'Administrador' },
    'usuario': { password: '1234', role: 'Ingreso de usuario' }
  };
 
  function doLogin() {
    const u   = document.getElementById('USERNAME').value.trim().toLowerCase();
    const p   = document.getElementById('PASSWORD').value;
    const btn = document.getElementById('btnLogin');
    const err = document.getElementById('errMsg');
 
    if (USERS[u] && USERS[u].password === p) {
      err.style.display = 'none';
      btn.textContent = '✓ Bienvenido';
      btn.classList.add('ok');

      // ── Guardar sesión ──
      localStorage.setItem('rol', USERS[u].role);
      localStorage.setItem('username', u);

      setTimeout(() => { window.location.href = "/inicio.html/inicio.html"; });
    } else {
      err.style.display = 'block';
      btn.classList.add('shake');
      setTimeout(() => btn.classList.remove('shake'));
    }
  }
 
  document.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });