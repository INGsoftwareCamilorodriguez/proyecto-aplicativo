// ══════════════════════════════════════════════════════════════
// GESTIÓN DE EMPLEADOS — CAPCOB
// Conectado al backend real: /api/usuarios
// Por ahora solo administra cuentas con rol Empleado. Administrador
// y Auditor quedan pendientes de definir (ver select del modal).
// ══════════════════════════════════════════════════════════════

// ── Estado ──────────────────────────────────────────────────
let usuarios = [];
let editingId = null;
let paginaActual = 1;
const porPagina = 8;

// ── Utilidades ──────────────────────────────────────────────
async function apiFetch(path, options) {
  const res = await fetch(API_BASE_URL + path, Object.assign({
    headers: { 'Content-Type': 'application/json' }
  }, options));
  let data = null;
  try { data = await res.json(); } catch (e) { /* respuesta vacía */ }
  if (!res.ok) {
    const mensaje = (data && data.mensaje) ? data.mensaje : 'Ocurrió un error inesperado.';
    throw new Error(mensaje);
  }
  return data;
}

function iniciales(nombre) {
  return nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
}

function rolBadge() {
  // Por ahora esta pantalla solo maneja el rol Empleado.
  return `<span class="role-badge role-ventas">Empleado</span>`;
}

function estadoBadge(activo) {
  if (activo) return `<span class="status-badge status-active">Activo</span>`;
  return `<span class="status-badge status-inactive">Inactivo</span>`;
}

// ── Cargar usuarios desde el backend ───────────────────────
async function cargarUsuarios() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:28px">Cargando empleados...</td></tr>`;
  try {
    usuarios = await apiFetch('/usuarios');
    renderTable();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:28px">No se pudieron cargar los empleados: ${e.message}</td></tr>`;
  }
}

function filtrarUsuarios() {
  paginaActual = 1;
  renderTable();
}

function renderTable() {
  const search = document.getElementById('searchInput').value.toLowerCase();

  let filtrados = usuarios.filter(u => {
    return u.nombre.toLowerCase().includes(search) || u.usuario.toLowerCase().includes(search);
  });

  const total  = filtrados.length;
  const inicio = (paginaActual - 1) * porPagina;
  const pagina = filtrados.slice(inicio, inicio + porPagina);

  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (pagina.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:28px">No se encontraron empleados.</td></tr>`;
  } else {
    pagina.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="user-cell">
            <div class="user-avatar">${iniciales(u.nombre)}</div>
            <div class="user-cell-info">
              <span class="user-cell-name">${u.nombre}</span>
              <span class="user-cell-role">● Empleado</span>
            </div>
          </div>
        </td>
        <td>${rolBadge()}</td>
        <td>${u.identidad || '—'}</td>
        <td>${u.telefono || '—'}</td>
        <td>${u.usuario}</td>
        <td>${estadoBadge(u.activo)}</td>
        <td>
          <div class="action-cell">
            <button class="btn-edit" onclick="editarUsuario(${u.id})">Editar</button>
            <button class="btn-delete" onclick="eliminarUsuario(${u.id})" title="Eliminar">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Footer info
  document.getElementById('footerInfo').textContent =
    `Mostrando ${total === 0 ? 0 : Math.min(inicio+1,total)}–${Math.min(inicio+porPagina,total)} de ${total} empleados`;

  // Pagination
  const totalPags = Math.ceil(total / porPagina);
  const pgDiv = document.getElementById('pagination');
  pgDiv.innerHTML = '';

  const crear = (texto, pagina, deshabilitado, activo) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pg-btn' + (activo ? ' active' : '');
    btn.textContent = texto;
    btn.disabled = !!deshabilitado;
    btn.onclick = () => { paginaActual = pagina; renderTable(); };
    pgDiv.appendChild(btn);
  };

  if (total > 0) {
    crear('‹ Anterior', paginaActual - 1, paginaActual === 1);
    for (let i = 1; i <= totalPags; i++) crear(String(i), i, false, i === paginaActual);
    crear('Siguiente ›', paginaActual + 1, paginaActual === totalPags);
  }
}

// ── Modal ──
function abrirModal(id = null) {
  editingId = id;
  const passwordHint = document.getElementById('fPasswordHint');
  document.getElementById('modalTitle').textContent = id ? 'Editar empleado' : 'Añadir nuevo empleado';
  if (id) {
    const u = usuarios.find(x => x.id === id);
    document.getElementById('fNombre').value   = u.nombre;
    document.getElementById('fIdentidad').value = u.identidad || '';
    document.getElementById('fTelefono').value  = u.telefono || '';
    document.getElementById('fEmail').value    = u.usuario;
    document.getElementById('fPassword').value = '';
    document.getElementById('fEstado').value   = u.activo ? 'Activo' : 'Inactivo';
    passwordHint.style.display = 'block';
  } else {
    document.getElementById('fNombre').value   = '';
    document.getElementById('fIdentidad').value = '';
    document.getElementById('fTelefono').value  = '';
    document.getElementById('fEmail').value    = '';
    document.getElementById('fPassword').value = '';
    document.getElementById('fEstado').value   = 'Activo';
    passwordHint.style.display = 'none';
  }
  document.getElementById('fRol').value = 'Empleado';
  document.getElementById('modalOverlay').classList.add('show');
}

function cerrarModal() {
  document.getElementById('modalOverlay').classList.remove('show');
  editingId = null;
}

async function guardarUsuario() {
  const nombre   = document.getElementById('fNombre').value.trim();
  const email    = document.getElementById('fEmail').value.trim();
  const identidad = document.getElementById('fIdentidad').value.trim();
  const telefono  = document.getElementById('fTelefono').value.trim();
  const password = document.getElementById('fPassword').value;
  const estado   = document.getElementById('fEstado').value;

  if (!nombre || !email) { alert('Por favor completa nombre y correo.'); return; }
  if (!identidad) { alert('La identidad es obligatoria.'); return; }
  if (!telefono) { alert('El teléfono es obligatorio.'); return; }
  if (!/^[0-9A-Za-z.\-]{5,30}$/.test(identidad)) { alert('La identidad solo puede tener letras, números, puntos o guiones (mínimo 5 caracteres).'); return; }
  if (!/^[0-9+()\s-]{7,30}$/.test(telefono)) { alert('El teléfono no es válido. Usa solo números (mínimo 7 dígitos).'); return; }
  if (!editingId && !password) { alert('La contraseña es obligatoria para crear el empleado.'); return; }

  const body = {
    nombre: nombre,
    usuario: email,
    identidad: identidad,
    telefono: telefono,
    activo: estado === 'Activo'
  };
  if (password) body.password = password;

  const btnGuardar = document.querySelector('.btn-save');
  const textoOriginal = btnGuardar.textContent;
  btnGuardar.textContent = 'Guardando...';
  btnGuardar.disabled = true;

  try {
    if (editingId) {
      await apiFetch('/usuarios/' + editingId, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await apiFetch('/usuarios', { method: 'POST', body: JSON.stringify(body) });
    }
    cerrarModal();
    await cargarUsuarios();
  } catch (e) {
    alert(e.message);
  } finally {
    btnGuardar.textContent = textoOriginal;
    btnGuardar.disabled = false;
  }
}

function editarUsuario(id) { abrirModal(id); }

async function eliminarUsuario(id) {
  if (!confirm('¿Estás seguro de eliminar este empleado?')) return;
  try {
    await apiFetch('/usuarios/' + id, { method: 'DELETE' });
    await cargarUsuarios();
  } catch (e) {
    alert('No se pudo eliminar: ' + e.message);
  }
}

// El modal NO se cierra al hacer clic afuera (así no se pierde lo escrito): solo con la X o el botón Cancelar.

// ── Control de roles ──
(function() {
  const rol = sessionStorage.getItem('rol');
  const username = sessionStorage.getItem('username');

  // Si no es admin, redirigir a inicio (protección directa)
  if (rol !== 'Administrador') {
    window.location.href = 'inicio.html';
    return;
  }

  if (username) {
    const nameEl = document.querySelector('.user-name');
    if (nameEl) nameEl.textContent = username;
  }
})();

cargarUsuarios();