// ══════════════════════════════════════════════════════════════
// GESTIÓN DE USUARIOS — CAPCOB
// Conectado al backend real: /api/usuarios
// Por ahora solo administra cuentas con rol Empleado. Administrador
// y Auditor quedan pendientes de definir (ver select del modal).
// ══════════════════════════════════════════════════════════════

// ── Estado ──────────────────────────────────────────────────
let usuarios = [];
let editingId = null;
let paginaActual = 1;
const porPagina = 5;

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
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:28px">Cargando usuarios...</td></tr>`;
  try {
    usuarios = await apiFetch('/usuarios');
    renderTable();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:28px">No se pudieron cargar los usuarios: ${e.message}</td></tr>`;
  }
}

function filtrarUsuarios() {
  paginaActual = 1;
  renderTable();
}

function renderTable() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const rol    = document.getElementById('rolFilter').value;

  // Solo existe el rol Empleado por ahora: si filtran por otro rol, la lista queda vacía.
  let filtrados = usuarios.filter(u => {
    const matchSearch = u.nombre.toLowerCase().includes(search) || u.usuario.toLowerCase().includes(search);
    const matchRol     = rol === '' || rol === 'Empleado';
    return matchSearch && matchRol;
  });

  const total  = filtrados.length;
  const inicio = (paginaActual - 1) * porPagina;
  const pagina = filtrados.slice(inicio, inicio + porPagina);

  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (pagina.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:28px">No se encontraron usuarios.</td></tr>`;
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
    `Mostrando ${total === 0 ? 0 : Math.min(inicio+1,total)}–${Math.min(inicio+porPagina,total)} de ${total} usuarios`;

  // Pagination
  const totalPags = Math.ceil(total / porPagina);
  const pgDiv = document.getElementById('pagination');
  pgDiv.innerHTML = '';

  const prev = document.createElement('div');
  prev.className = 'pg-btn';
  prev.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>`;
  prev.onclick = () => { if (paginaActual > 1) { paginaActual--; renderTable(); } };
  pgDiv.appendChild(prev);

  for (let i=1; i<=totalPags; i++) {
    const btn = document.createElement('div');
    btn.className = 'pg-btn' + (i === paginaActual ? ' active' : '');
    btn.textContent = i;
    btn.onclick = (()=> { const p=i; return ()=>{ paginaActual=p; renderTable(); }; })();
    pgDiv.appendChild(btn);
  }

  const next = document.createElement('div');
  next.className = 'pg-btn';
  next.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>`;
  next.onclick = () => { if (paginaActual < totalPags) { paginaActual++; renderTable(); } };
  pgDiv.appendChild(next);
}

// ── Modal ──
function abrirModal(id = null) {
  editingId = id;
  const passwordHint = document.getElementById('fPasswordHint');
  document.getElementById('modalTitle').textContent = id ? 'Editar usuario' : 'Añadir nuevo usuario';
  if (id) {
    const u = usuarios.find(x => x.id === id);
    document.getElementById('fNombre').value   = u.nombre;
    document.getElementById('fEmail').value    = u.usuario;
    document.getElementById('fPassword').value = '';
    document.getElementById('fEstado').value   = u.activo ? 'Activo' : 'Inactivo';
    passwordHint.style.display = 'block';
  } else {
    document.getElementById('fNombre').value   = '';
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
  const password = document.getElementById('fPassword').value;
  const estado   = document.getElementById('fEstado').value;

  if (!nombre || !email) { alert('Por favor completa nombre y correo.'); return; }
  if (!editingId && !password) { alert('La contraseña es obligatoria para crear el usuario.'); return; }

  const body = {
    nombre: nombre,
    usuario: email,
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
  if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
  try {
    await apiFetch('/usuarios/' + id, { method: 'DELETE' });
    await cargarUsuarios();
  } catch (e) {
    alert('No se pudo eliminar: ' + e.message);
  }
}

// cerrar modal al click fuera
document.getElementById('modalOverlay').addEventListener('click', function(e) {
  if (e.target === this) cerrarModal();
});

// ── Control de roles ──
(function() {
  const rol = localStorage.getItem('rol');
  const username = localStorage.getItem('username');

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