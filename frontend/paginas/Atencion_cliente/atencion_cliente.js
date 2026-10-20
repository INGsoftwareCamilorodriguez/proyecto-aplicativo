// ── Formulario de contacto: envía el mensaje al backend, que lo manda por correo ──
const form = document.getElementById('formContacto');
const btnEnviar = document.getElementById('acEnviar');
const errBox = document.getElementById('acErr');
const okBox = document.getElementById('acOk');

function mostrarError(texto) {
  okBox.style.display = 'none';
  errBox.textContent = texto;
  errBox.style.display = 'block';
  btnEnviar.classList.add('shake');
  setTimeout(() => btnEnviar.classList.remove('shake'), 400);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nombre = document.getElementById('acNombre').value.trim();
  const correo = document.getElementById('acCorreo').value.trim();
  const motivo = document.getElementById('acMotivo').value;
  const mensaje = document.getElementById('acMensaje').value.trim();

  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);

  if (!nombre || !correo || !motivo || !mensaje || !correoValido) {
    mostrarError(!correoValido && correo
      ? 'Ingresa un correo electrónico válido.'
      : 'Por favor completa todos los campos.');
    return;
  }

  errBox.style.display = 'none';
  okBox.style.display = 'none';
  btnEnviar.disabled = true;
  btnEnviar.textContent = 'Enviando...';

  let enviado = false;
  try {
    const res = await fetch(`${API_BASE_URL}/contacto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, correo, motivo, mensaje })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      mostrarError(data.mensaje || 'No se pudo enviar el mensaje. Intenta de nuevo.');
      return;
    }

    enviado = true;
    okBox.style.display = 'block';
    form.reset();
    btnEnviar.classList.add('ok');
    btnEnviar.textContent = '¡Mensaje enviado!';
    setTimeout(() => {
      btnEnviar.classList.remove('ok');
      btnEnviar.textContent = 'Enviar mensaje';
      btnEnviar.disabled = false;
    }, 3000);
  } catch (err) {
    mostrarError('No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.');
  } finally {
    if (!enviado) {
      btnEnviar.disabled = false;
      btnEnviar.textContent = 'Enviar mensaje';
    }
  }
});