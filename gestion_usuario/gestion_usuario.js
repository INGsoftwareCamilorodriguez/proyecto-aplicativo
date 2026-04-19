// ── Data ──
  let usuarios = [
    { id:1, nombre:'Gabriel Márquez', rol:'Administrador', email:'gabriel@example.com', estado:'Activo' },
    { id:2, nombre:'Melissa Silva',   rol:'Ventas',        email:'melissa@example.com', estado:'Activo' },
    { id:3, nombre:'Andrés López',    rol:'Ventas',        email:'andres@example.com',  estado:'Activo' },
    { id:4, nombre:'Laura Garcia',    rol:'Auditor',       email:'laura@example.com',   estado:'Activo' },
    { id:5, nombre:'Samuel Ruiz',     rol:'Ventas',        email:'samuel@example.com',  estado:'Inactivo' },
  ];

  let editingId = null;
  let paginaActual = 1;
  const porPagina = 5;

  function iniciales(nombre) {
    return nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  }

  function rolBadge(rol) {
    if (rol === 'Administrador') return `<span class="role-badge role-admin">${rol}</span>`;
    return `<span class="role-badge role-ventas">${rol}</span>`;
  }

  function estadoBadge(estado) {
    if (estado === 'Activo') return `<span class="status-badge status-active">Activo</span>`;
    return `<span class="status-badge status-inactive">Inactivo</span>`;
  }

  function filtrarUsuarios() {
    paginaActual = 1;
    renderTable();
  }

  function renderTable() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const rol    = document.getElementById('rolFilter').value;

    let filtrados = usuarios.filter(u => {
      const matchSearch = u.nombre.toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
      const matchRol    = rol === '' || u.rol === rol;
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
                <span class="user-cell-role">● ${u.rol}</span>
              </div>
            </div>
          </td>
          <td>${rolBadge(u.rol)}</td>
          <td>${u.email}</td>
          <td>${estadoBadge(u.estado)}</td>
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
      `Mostrando ${Math.min(inicio+1,total)}–${Math.min(inicio+porPagina,total)} de ${total} usuarios`;

    // Pagination
    const totalPags = Math.ceil(total / porPagina);
    const pgDiv = document.getElementById('pagination');
    pgDiv.innerHTML = '';

    // prev
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

    // next
    const next = document.createElement('div');
    next.className = 'pg-btn';
    next.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>`;
    next.onclick = () => { if (paginaActual < totalPags) { paginaActual++; renderTable(); } };
    pgDiv.appendChild(next);
  }

  // ── Modal ──
  function abrirModal(id = null) {
    editingId = id;
    document.getElementById('modalTitle').textContent = id ? 'Editar usuario' : 'Añadir nuevo usuario';
    if (id) {
      const u = usuarios.find(x => x.id === id);
      document.getElementById('fNombre').value = u.nombre;
      document.getElementById('fEmail').value  = u.email;
      document.getElementById('fRol').value    = u.rol;
      document.getElementById('fEstado').value = u.estado;
    } else {
      document.getElementById('fNombre').value = '';
      document.getElementById('fEmail').value  = '';
      document.getElementById('fRol').value    = 'Ventas';
      document.getElementById('fEstado').value = 'Activo';
    }
    document.getElementById('modalOverlay').classList.add('show');
  }

  function cerrarModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    editingId = null;
  }

  function guardarUsuario() {
    const nombre = document.getElementById('fNombre').value.trim();
    const email  = document.getElementById('fEmail').value.trim();
    const rol    = document.getElementById('fRol').value;
    const estado = document.getElementById('fEstado').value;

    if (!nombre || !email) { alert('Por favor completa todos los campos.'); return; }

    if (editingId) {
      const u = usuarios.find(x => x.id === editingId);
      u.nombre = nombre; u.email = email; u.rol = rol; u.estado = estado;
    } else {
      const newId = usuarios.length ? Math.max(...usuarios.map(u=>u.id)) + 1 : 1;
      usuarios.push({ id: newId, nombre, rol, email, estado });
    }
    cerrarModal();
    renderTable();
  }

  function editarUsuario(id) { abrirModal(id); }

  function eliminarUsuario(id) {
    if (confirm('¿Estás seguro de eliminar este usuario?')) {
      usuarios = usuarios.filter(u => u.id !== id);
      renderTable();
    }
  }

  // cerrar modal al click fuera
  document.getElementById('modalOverlay').addEventListener('click', function(e) {
    if (e.target === this) cerrarModal();
  });

  renderTable();

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