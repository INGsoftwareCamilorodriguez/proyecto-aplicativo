// ══════════════════════════════════════════════════════════════
// CLIENTES (ADMINISTRADORES) — CAPCOB
// Uso exclusivo del rol Desarrollador. Conectado al backend real:
// /api/usuarios/administradores
// ══════════════════════════════════════════════════════════════

const MAX_IMG_BYTES = 1.5 * 1024 * 1024; // 1.5 MB, límite razonable para guardar el logo como base64

// ── Estado ──────────────────────────────────────────────────
let administradores = [];
let editingId = null;
let paginaActual = 1;
const porPagina = 5;
let nuevoLogo = undefined; // undefined = sin cambios, "" = quitar, "data:..." = nuevo

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
  return (nombre || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function estadoBadge(activo) {
  if (activo) return `<span class="status-badge status-active">Activo</span>`;
  return `<span class="status-badge status-inactive">Inactivo</span>`;
}

function archivoABase64(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_IMG_BYTES) {
      reject(new Error("El logo pesa demasiado. Usa uno de máximo 1.5 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

// ── Cargar administradores desde el backend ───────────────────
async function cargarAdministradores() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:28px">Cargando clientes...</td></tr>`;
  try {
    administradores = await apiFetch('/usuarios/administradores');
    renderTable();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:28px">No se pudieron cargar los clientes: ${e.message}</td></tr>`;
  }
}

function filtrarAdministradores() {
  paginaActual = 1;
  renderTable();
}

function renderTable() {
  const search = document.getElementById('searchInput').value.toLowerCase();

  let filtrados = administradores.filter(a => {
    return (a.empresaNombre || '').toLowerCase().includes(search)
      || a.nombre.toLowerCase().includes(search)
      || a.usuario.toLowerCase().includes(search);
  });

  const total  = filtrados.length;
  const inicio = (paginaActual - 1) * porPagina;
  const pagina = filtrados.slice(inicio, inicio + porPagina);

  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (pagina.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:28px">No se encontraron clientes.</td></tr>`;
  } else {
    pagina.forEach(a => {
      const tr = document.createElement('tr');
      const logoCelda = a.empresaLogo
        ? `<img src="${a.empresaLogo}" alt="Logo"/>`
        : iniciales(a.empresaNombre);
      tr.innerHTML = `
        <td>
          <div class="user-cell">
            <div class="user-avatar">${logoCelda}</div>
            <div class="user-cell-info">
              <span class="user-cell-name">${a.empresaNombre || '—'}</span>
              <span class="user-cell-role">${a.empresaIdentidad ? 'NIT: ' + a.empresaIdentidad : ''}</span>
            </div>
          </div>
        </td>
        <td>${a.nombre}</td>
        <td>${a.usuario}${a.telefono ? '<br><span style="color:var(--muted);font-size:.78rem">' + a.telefono + '</span>' : ''}</td>
        <td>${estadoBadge(a.activo)}</td>
        <td>
          <div class="action-cell">
            <button class="btn-edit" onclick="editarAdministrador(${a.id})">Editar</button>
            <button class="btn-delete" onclick="eliminarAdministrador(${a.id})" title="Eliminar">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  document.getElementById('footerInfo').textContent =
    `Mostrando ${total === 0 ? 0 : Math.min(inicio + 1, total)}–${Math.min(inicio + porPagina, total)} de ${total} clientes`;

  const totalPags = Math.ceil(total / porPagina);
  const pgDiv = document.getElementById('pagination');
  pgDiv.innerHTML = '';

  const prev = document.createElement('div');
  prev.className = 'pg-btn';
  prev.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>`;
  prev.onclick = () => { if (paginaActual > 1) { paginaActual--; renderTable(); } };
  pgDiv.appendChild(prev);

  for (let i = 1; i <= totalPags; i++) {
    const btn = document.createElement('div');
    btn.className = 'pg-btn' + (i === paginaActual ? ' active' : '');
    btn.textContent = i;
    btn.onclick = (() => { const p = i; return () => { paginaActual = p; renderTable(); }; })();
    pgDiv.appendChild(btn);
  }

  const next = document.createElement('div');
  next.className = 'pg-btn';
  next.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>`;
  next.onclick = () => { if (paginaActual < totalPags) { paginaActual++; renderTable(); } };
  pgDiv.appendChild(next);
}

// ── Logo (dentro del modal) ──
async function onLogoFileChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const base64 = await archivoABase64(file);
    nuevoLogo = base64;
    pintarLogoPreview(base64);
  } catch (e) {
    alert(e.message);
  }
}

function pintarLogoPreview(src) {
  const wrap = document.getElementById('logoPreviewWrap');
  const img = document.getElementById('logoPreview');
  img.src = src;
  img.style.display = 'block';
  wrap.classList.add('has-image');
}

function limpiarLogoPreview() {
  const wrap = document.getElementById('logoPreviewWrap');
  const img = document.getElementById('logoPreview');
  wrap.classList.remove('has-image');
  img.style.display = 'none';
  img.src = '';
}

// ── Modal ──
function abrirModal(id = null) {
  editingId = id;
  nuevoLogo = undefined;
  const passwordHint = document.getElementById('fPasswordHint');
  document.getElementById('modalTitle').textContent = id ? 'Editar cliente (Administrador)' : 'Añadir cliente (Administrador)';

  if (id) {
    const a = administradores.find(x => x.id === id);
    document.getElementById('fEmpresaNombre').value    = a.empresaNombre || '';
    document.getElementById('fEmpresaIdentidad').value = a.empresaIdentidad || '';
    document.getElementById('fNombre').value            = a.nombre;
    document.getElementById('fEmail').value              = a.usuario;
    document.getElementById('fPassword').value           = '';
    document.getElementById('fTelefono').value           = a.telefono || '';
    document.getElementById('fEstado').value             = a.activo ? 'Activo' : 'Inactivo';
    passwordHint.style.display = 'block';
    if (a.empresaLogo) pintarLogoPreview(a.empresaLogo); else limpiarLogoPreview();
  } else {
    document.getElementById('fEmpresaNombre').value    = '';
    document.getElementById('fEmpresaIdentidad').value = '';
    document.getElementById('fNombre').value            = '';
    document.getElementById('fEmail').value              = '';
    document.getElementById('fPassword').value           = '';
    document.getElementById('fTelefono').value           = '';
    document.getElementById('fEstado').value             = 'Activo';
    passwordHint.style.display = 'none';
    limpiarLogoPreview();
  }
  document.getElementById('modalOverlay').classList.add('show');
}

function cerrarModal() {
  document.getElementById('modalOverlay').classList.remove('show');
  editingId = null;
}

async function guardarAdministrador() {
  const empresaNombre    = document.getElementById('fEmpresaNombre').value.trim();
  const empresaIdentidad = document.getElementById('fEmpresaIdentidad').value.trim();
  const nombre            = document.getElementById('fNombre').value.trim();
  const email             = document.getElementById('fEmail').value.trim();
  const password          = document.getElementById('fPassword').value;
  const telefono          = document.getElementById('fTelefono').value.trim();
  const estado            = document.getElementById('fEstado').value;

  if (!empresaNombre) { alert('Por favor indica el nombre de la empresa.'); return; }
  if (!nombre || !email) { alert('Por favor completa el nombre y el correo del administrador.'); return; }
  if (!editingId && !password) { alert('La contraseña es obligatoria para crear el cliente.'); return; }

  const body = {
    nombre: nombre,
    usuario: email,
    telefono: telefono,
    empresaNombre: empresaNombre,
    empresaIdentidad: empresaIdentidad,
    activo: estado === 'Activo'
  };
  if (password) body.password = password;
  if (nuevoLogo !== undefined) body.empresaLogo = nuevoLogo;

  const btnGuardar = document.querySelector('.btn-save');
  const textoOriginal = btnGuardar.textContent;
  btnGuardar.textContent = 'Guardando...';
  btnGuardar.disabled = true;

  try {
    if (editingId) {
      await apiFetch('/usuarios/administradores/' + editingId, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await apiFetch('/usuarios/administradores', { method: 'POST', body: JSON.stringify(body) });
    }
    cerrarModal();
    await cargarAdministradores();
  } catch (e) {
    alert(e.message);
  } finally {
    btnGuardar.textContent = textoOriginal;
    btnGuardar.disabled = false;
  }
}

function editarAdministrador(id) { abrirModal(id); }

async function eliminarAdministrador(id) {
  if (!confirm('¿Estás seguro de eliminar este cliente? Perderá acceso al sistema.')) return;
  try {
    await apiFetch('/usuarios/administradores/' + id, { method: 'DELETE' });
    await cargarAdministradores();
  } catch (e) {
    alert('No se pudo eliminar: ' + e.message);
  }
}

// cerrar modal al click fuera
document.getElementById('modalOverlay').addEventListener('click', function (e) {
  if (e.target === this) cerrarModal();
});

// ── Control de roles (protección directa, además de guardian-dashboard.js) ──
(function () {
  const rol = sessionStorage.getItem('rol');
  if (rol !== 'Desarrollador') {
    window.location.href = '/frontend/paginas/login/login.html';
    return;
  }
})();

cargarAdministradores();
