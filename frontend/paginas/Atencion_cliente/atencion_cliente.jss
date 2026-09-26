// ── Formulario de contacto: abre el cliente de correo con todo redactado ──
const CORREO_SOPORTE = 'camilo_rodriguezva@fet.edu.co';

const form = document.getElementById('formContacto');
const btnEnviar = document.getElementById('acEnviar');
const errBox = document.getElementById('acErr');
const fallback = document.getElementById('acFallback');
const fallbackTexto = document.getElementById('acFallbackTexto');
const btnCopiar = document.getElementById('acCopiar');
const avisoCopiado = document.getElementById('acCopiado');

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const nombre = document.getElementById('acNombre').value.trim();
  const correo = document.getElementById('acCorreo').value.trim();
  const motivo = document.getElementById('acMotivo').value;
  const mensaje = document.getElementById('acMensaje').value.trim();

  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);

  if (!nombre || !correo || !motivo || !mensaje || !correoValido) {
    errBox.textContent = !correoValido && correo
      ? 'Ingresa un correo electrónico válido.'
      : 'Por favor completa todos los campos.';
    errBox.style.display = 'block';
    fallback.classList.remove('show');
    btnEnviar.classList.add('shake');
    setTimeout(() => btnEnviar.classList.remove('shake'), 400);
    return;
  }
  errBox.style.display = 'none';

  const asunto = `[CAPCOB] ${motivo} - ${nombre}`;
  const cuerpo =
    `Para: ${CORREO_SOPORTE}\n` +
    `Asunto: ${asunto}\n\n` +
    `Nombre: ${nombre}\n` +
    `Correo: ${correo}\n` +
    `Motivo: ${motivo}\n\n` +
    `Mensaje:\n${mensaje}`;

  const mailtoUrl =
    `mailto:${CORREO_SOPORTE}` +
    `?subject=${encodeURIComponent(asunto)}` +
    `&body=${encodeURIComponent(
      `Nombre: ${nombre}\nCorreo: ${correo}\nMotivo: ${motivo}\n\nMensaje:\n${mensaje}`
    )}`;

  // Intenta abrir el cliente de correo. No hay forma de saber, desde el
  // navegador, si de verdad se abrió algo (si el computador no tiene un
  // programa de correo configurado, esto no hace nada visible). Por eso,
  // en vez de asumir que funcionó, dejamos siempre listo el mensaje para
  // copiar y pegar como respaldo.
  window.location.href = mailtoUrl;

  btnEnviar.classList.add('ok');
  btnEnviar.textContent = '¡Mensaje listo!';

  fallbackTexto.value = cuerpo;
  fallback.classList.add('show');
  avisoCopiado.classList.remove('show');
  fallback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

btnCopiar.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(fallbackTexto.value);
  } catch (e) {
    // Si el navegador bloquea el portapapeles, seleccionamos el texto
    // para que el usuario lo copie manualmente con Ctrl+C.
    fallbackTexto.select();
    document.execCommand('copy');
  }
  avisoCopiado.classList.add('show');
  setTimeout(() => avisoCopiado.classList.remove('show'), 2000);
});