const USERS = {
    'admin':    { password: '1234', role: 'Administrador' },
    'usuario':  { password: '1234', role: 'Ingreso de usuario' },
    'empleado': { password: 'caja2024', role: 'Empleado' }
  };

  // ── A dónde va cada rol después de iniciar sesión ──
  const REDIRECT_POR_ROL = {
    'Empleado': '/frontend/paginas/escanear-codigo-barras/escanear-codigo-barras.html'
  };
  const REDIRECT_DEFAULT = '/frontend/paginas/inicio/inicio.html';

  // ── Mostrar / ocultar contraseña ──
  function togglePassword() {
    const input = document.getElementById('PASSWORD');
    const icon  = document.getElementById('eyeToggle');
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    icon.classList.toggle('hidden-state', isHidden);
  }

  // ── Recordarme: precargar usuario guardado ──
  (function cargarUsuarioRecordado() {
    const recordado = localStorage.getItem('usuarioRecordado');
    if (recordado) {
      document.getElementById('USERNAME').value = recordado;
      document.getElementById('cb').classList.add('on');
    }
  })();

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
      const rol = USERS[u].role;
      localStorage.setItem('rol', rol);
      localStorage.setItem('username', u);

      // ── Recordarme ──
      const recordar = document.getElementById('cb').classList.contains('on');
      if (recordar) {
        localStorage.setItem('usuarioRecordado', u);
      } else {
        localStorage.removeItem('usuarioRecordado');
      }

      // ── Redirigir según el rol ──
      const destino = REDIRECT_POR_ROL[rol] || REDIRECT_DEFAULT;
      setTimeout(() => { window.location.href = destino; });
    } else {
      err.style.display = 'block';
      btn.classList.add('shake');
      setTimeout(() => btn.classList.remove('shake'));
    }
  }

  document.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });