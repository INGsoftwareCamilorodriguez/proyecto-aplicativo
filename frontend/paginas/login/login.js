const ROL_BACKEND_A_FRONTEND = {
  'ADMIN': 'Administrador',
  'EMPLEADO': 'Empleado'
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

function mostrarError(texto) {
  const err = document.getElementById('errMsg');
  err.textContent = texto || 'Usuario o contraseña incorrectos.';
  err.style.display = 'block';
}

async function doLogin() {
  const u   = document.getElementById('USERNAME').value.trim().toLowerCase();
  const p   = document.getElementById('PASSWORD').value;
  const btn = document.getElementById('btnLogin');
  const err = document.getElementById('errMsg');

  if (!u || !p) {
    mostrarError('Por favor ingresa usuario y contraseña.');
    return;
  }

  err.style.display = 'none';
  const textoOriginal = btn.textContent;
  btn.textContent = 'Ingresando...';

  try {
    const res = await fetch(API_BASE_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: u, password: p })
    });

    let data = null;
    try { data = await res.json(); } catch (e) { /* respuesta vacía */ }

    if (!res.ok) {
      btn.textContent = textoOriginal;
      mostrarError(data && data.mensaje ? data.mensaje : 'Usuario o contraseña incorrectos.');
      btn.classList.add('shake');
      setTimeout(() => btn.classList.remove('shake'));
      return;
    }

    btn.textContent = '✓ Bienvenido';
    btn.classList.add('ok');

    // ── Guardar sesión ──
    const rol = ROL_BACKEND_A_FRONTEND[data.rol] || data.rol;
    localStorage.setItem('rol', rol);
    localStorage.setItem('username', data.nombre || data.usuario);
    localStorage.setItem('userId', data.id);

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

  } catch (e) {
    btn.textContent = textoOriginal;
    mostrarError('No se pudo conectar con el servidor. Intenta de nuevo.');
  }
}

document.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });