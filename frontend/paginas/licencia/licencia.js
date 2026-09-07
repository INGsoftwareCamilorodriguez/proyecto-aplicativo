// ══════════════════════════════════════════════════════════════
// LICENCIA DEL SOFTWARE — CAPCOB
// Todavía no está conectada a ningún backend: el precio y los
// planes son solo un anticipo visual ("Muy pronto") para el rol
// Desarrollador. Cuando se defina cómo se va a guardar y facturar
// la licencia, aquí se conecta a un endpoint real.
// ══════════════════════════════════════════════════════════════

function mostrarMuyPronto() {
  const box = document.getElementById("alertBox");
  box.textContent = "🚧 Esta función estará disponible muy pronto.";
  box.className = "alert-box show ok";
  setTimeout(() => { box.className = "alert-box"; }, 3000);
}

// ── Control de roles (protección directa, además de guardian-dashboard.js) ──
(function () {
  const rol = sessionStorage.getItem('rol');
  if (rol !== 'Desarrollador') {
    window.location.href = '/frontend/paginas/login/login.html';
  }
})();
