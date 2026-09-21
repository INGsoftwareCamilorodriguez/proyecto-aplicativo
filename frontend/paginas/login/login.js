const ROL_BACKEND_A_FRONTEND = {
  'ADMIN': 'Administrador',
  'EMPLEADO': 'Empleado',
  'DESARROLLADOR': 'Desarrollador'
};

// ── A dónde va cada rol después de iniciar sesión ──
const REDIRECT_POR_ROL = {
  'Empleado': '/frontend/paginas/escanear-codigo-barras/escanear-codigo-barras.html',
  'Desarrollador': '/frontend/paginas/gestion-administradores/gestion-administradores.html'
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

// ── Identificador de ESTE navegador ──
// Se guarda en localStorage (lo comparten todas las pestañas de este navegador y
// sobrevive a cierres y reinicios del PC). El backend lo usa para saber si una sesión
// activa la abrió este mismo navegador.
function obtenerDispositivoId() {
  try {
    let id = localStorage.getItem('dispositivoId');
    if (!id) {
      id = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      localStorage.setItem('dispositivoId', id);
    }
    return id;
  } catch (e) {
    return null;
  }
}

async function enviarLogin(usuario, password, tomarSesion) {
  const res = await fetch(API_BASE_URL + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, password, dispositivoId: obtenerDispositivoId(), tomarSesion })
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* respuesta vacía */ }
  return { res, data };
}

// Pregunta a las demás pestañas de ESTE navegador si alguna sigue viva con la sesión de
// ese usuario. Si ninguna responde, la sesión quedó abandonada (cerraron la pestaña de
// golpe, se fue la luz, se apagó el PC...). Las pestañas responden desde
// session-heartbeat.js.
function hayPestanaViva(usuarioId, esperaMs = 800) {
  return new Promise(resolve => {
    if (!('BroadcastChannel' in window)) { resolve(true); return; } // no se puede verificar: se protege la sesión

    const canal = new BroadcastChannel('capcob-sesion');
    let timer = null;
    const terminar = viva => { clearTimeout(timer); canal.close(); resolve(viva); };

    canal.onmessage = e => {
      if (e.data && e.data.tipo === 'presente' && String(e.data.usuarioId) === String(usuarioId)) {
        terminar(true);
      }
    };
    timer = setTimeout(() => terminar(false), esperaMs);
    canal.postMessage({ tipo: 'preguntar', usuarioId });
  });
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
    let { res, data } = await enviarLogin(u, p, false);

    // Ya hay una sesión activa, pero la abrió ESTE mismo navegador: si ninguna de sus
    // pestañas sigue viva, esa sesión quedó abandonada y se toma de inmediato, sin
    // esperar nada. Si otra pestaña sí sigue viva, se mantiene el bloqueo.
    if (res.status === 409 && data && data.mismoDispositivo) {
      const sigueViva = await hayPestanaViva(data.usuarioId);
      if (!sigueViva) {
        ({ res, data } = await enviarLogin(u, p, true));
      }
    }

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
    sessionStorage.setItem('rol', rol);
    sessionStorage.setItem('username', data.nombre || data.usuario);
    sessionStorage.setItem('userId', data.id);
    sessionStorage.setItem('token', data.token);

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