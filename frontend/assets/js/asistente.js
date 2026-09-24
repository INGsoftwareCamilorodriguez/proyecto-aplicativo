// ══════════════════════════════════════════════════════════════
// ASISTENTE FLOTANTE — CAPCOB
// ══════════════════════════════════════════════════════════════
// Chat con OPCIONES CERRADAS (botones) y respuestas predeterminadas
// que se arman con datos reales del sistema. No usa IA externa ni
// necesita internet: solo consulta el backend que ya existe:
//   GET /api/productos
//   GET /api/ventas?inicio=...&fin=...
//   GET /api/ventas/resumen-mensual?anio=...
//   GET /api/ventas/resumen-productos?inicio=...&fin=...
//
// Cómo se usa en cada página del panel (después de sidebar.js):
//   <script src="/frontend/assets/js/asistente.js"></script>
//
// ROLES
//   · Empleado: no lo ve (la pantalla de caja no carga este archivo).
//   · Administrador: lo ve y TODAS las opciones funcionan.
//   · Desarrollador: lo ve, pero los botones están desactivados hasta
//     que el equipo decida. Para activarlo basta con agregar
//     'Desarrollador' a ROLES_CON_ASISTENTE_ACTIVO (línea de abajo).
//
// PARA AGREGAR O QUITAR OPCIONES: edita el arreglo MENU (más abajo).
//
// Todo va dentro de una función para no chocar con las variables de
// las demás páginas (inicio.js, etc. ya definen apiFetch, money...).
// ══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Quién lo ve y en quién funciona ──
  const ROLES_QUE_LO_VEN = ['Administrador', 'Desarrollador'];
  const ROLES_CON_ASISTENTE_ACTIVO = ['Administrador'];

  const rol = sessionStorage.getItem('rol');
  if (!ROLES_QUE_LO_VEN.includes(rol)) return;
  if (typeof API_BASE_URL === 'undefined') return; // falta api-config.js
  const activo = ROLES_CON_ASISTENTE_ACTIVO.includes(rol);

  // Debe coincidir con UMBRAL_STOCK_BAJO de inicio.js (lo que cuenta la tarjeta "bajo stock")
  const UMBRAL_STOCK_BAJO = 10;
  const MAX_RESULTADOS_BUSQUEDA = 5;
  const MAX_LISTA_BAJO_STOCK = 10;

  const AVATAR = '/frontend/assets/imagenes/asistente-avatar.png';
  const RUTAS = {
    registrar: '/frontend/paginas/registrar-producto/registrar-producto.html',
    inventario: '/frontend/paginas/ver-inventario/ver-inventario.html',
    configuracion: '/frontend/paginas/configuracion/configuracion.html'
  };

  // ── Períodos para "Producto más vendido" ──
  const RANGOS = [
    { texto: 'Hoy', frase: 'hoy', desde: () => inicioDelDia(new Date()) },
    { texto: 'Últimos 7 días', frase: 'en los últimos 7 días', desde: () => { const d = inicioDelDia(new Date()); d.setDate(d.getDate() - 6); return d; } },
    { texto: 'Este mes', frase: 'este mes', desde: () => { const d = inicioDelDia(new Date()); d.setDate(1); return d; } }
  ];

  // ══════════════════════════════════════════════════════════════
  // MENÚ DE OPCIONES (aquí se agregan o quitan botones)
  // ══════════════════════════════════════════════════════════════
  const MENU = [
    {
      titulo: 'Consultas rápidas',
      opciones: [
        { texto: 'Resumen del día', accion: resumenDelDia },
        { texto: 'Productos con bajo stock', accion: productosBajoStock },
        { texto: 'Buscar un producto', accion: iniciarBusqueda },
        { texto: 'Producto más vendido', accion: preguntarPeriodoMasVendido },
        { texto: 'Ventas del mes', accion: ventasDelMes }
      ]
    },
    {
      titulo: 'Atajos',
      opciones: [
        { texto: 'Registrar producto', accion: () => irA(RUTAS.registrar, 'Te llevo a Registrar producto.') },
        { texto: 'Ver inventario', accion: () => irA(RUTAS.inventario, 'Te llevo a Ver inventario.') },
        { texto: 'Configuración', accion: () => irA(RUTAS.configuracion, 'Te llevo a Configuración.') }
      ]
    },
    {
      titulo: 'Ayuda',
      opciones: [
        { texto: '¿Cómo escaneo un producto?', accion: ayudaEscanear },
        { texto: '¿Cómo registro un producto?', accion: ayudaRegistrar },
        { texto: 'Preguntas frecuentes', accion: preguntasFrecuentes }
      ]
    }
  ];

  // ══════════════════════════════════════════════════════════════
  // UTILIDADES
  // ══════════════════════════════════════════════════════════════

  async function pedir(ruta) {
    const res = await fetch(API_BASE_URL + ruta);
    let data = null;
    try { data = await res.json(); } catch (e) { /* respuesta vacía */ }
    if (!res.ok) throw new Error(data && data.mensaje ? data.mensaje : 'Ocurrió un error inesperado.');
    return data;
  }

  function mensajeDeError(e) {
    if (e instanceof TypeError) return 'No se pudo conectar con el servidor. Verifica que el backend esté encendido.';
    return e.message;
  }

  const dinero = n => '$' + Math.round(Number(n)).toLocaleString('es-CO');
  const formatoNumero = (n, decimales = 3) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: decimales });
  const esBajoStock = prod => Number(prod.cantidad) <= UMBRAL_STOCK_BAJO;
  const normalizar = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const mayuscula = t => t.charAt(0).toUpperCase() + t.slice(1);

  function textoCantidad(prod) {
    const n = Number(prod.cantidad);
    if (prod.tipoPrecio === 'PESO') return formatoNumero(n) + ' kg';
    return formatoNumero(n) + (n === 1 ? ' unidad' : ' unidades');
  }

  // Fechas en HORA LOCAL con el formato que espera el backend (yyyy-MM-ddTHH:mm:ss)
  const dos = n => String(n).padStart(2, '0');
  function aFechaBackend(d) {
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()) +
      'T' + dos(d.getHours()) + ':' + dos(d.getMinutes()) + ':' + dos(d.getSeconds());
  }
  function inicioDelDia(d) { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; }
  function finDelDia(d) { const c = new Date(d); c.setHours(23, 59, 59, 0); return c; }

  // ── Constructores de DOM (todo el texto entra con textContent: nada de HTML suelto) ──
  function nodo(x) { return x instanceof Node ? x : document.createTextNode(String(x)); }
  function el(etiqueta, clase, hijos) {
    const e = document.createElement(etiqueta);
    if (clase) e.className = clase;
    [].concat(hijos || []).forEach(h => e.appendChild(nodo(h)));
    return e;
  }
  const p = (...hijos) => el('p', '', hijos);
  const tenue = texto => el('p', 'tenue', [texto]);
  const fuerte = texto => el('strong', '', [texto]);
  const lista = (items, ordenada) => el(ordenada ? 'ol' : 'ul', '', items.map(i => el('li', '', i)));

  // ══════════════════════════════════════════════════════════════
  // VENTANA DEL CHAT
  // ══════════════════════════════════════════════════════════════

  const lanzador = el('button', 'asistente-lanzador');
  lanzador.type = 'button';
  lanzador.title = 'Asistente CAPCOB';
  lanzador.setAttribute('aria-label', 'Abrir el asistente');
  lanzador.setAttribute('aria-expanded', 'false');
  lanzador.innerHTML = '<img src="' + AVATAR + '" alt="">';

  const panel = el('div', 'asistente-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Asistente CAPCOB');
  panel.innerHTML =
    '<div class="asistente-cabecera">' +
      '<div class="av"><img src="' + AVATAR + '" alt=""></div>' +
      '<div class="titulos"><div class="nombre">Asistente CAPCOB</div>' +
      '<div class="sub">Respuestas con los datos de tu sistema</div></div>' +
      '<button type="button" class="asistente-cerrar" aria-label="Cerrar el asistente">&times;</button>' +
    '</div>' +
    '<div class="asistente-cuerpo" aria-live="polite"></div>' +
    '<div class="asistente-entrada" hidden>' +
      '<input type="text" maxlength="60" placeholder="Nombre o código de barras" aria-label="Producto a buscar">' +
      '<button type="button">Enviar</button>' +
    '</div>';

  const cuerpo = panel.querySelector('.asistente-cuerpo');
  const entrada = panel.querySelector('.asistente-entrada');
  const campo = entrada.querySelector('input');

  let iniciado = false;
  let grupoCancelarBusqueda = null;

  function alternar(forzar) {
    const abrir = typeof forzar === 'boolean' ? forzar : !panel.classList.contains('abierto');
    panel.classList.toggle('abierto', abrir);
    lanzador.setAttribute('aria-expanded', String(abrir));
    if (abrir && !iniciado) {
      iniciado = true;
      mostrarMenu('Hola, soy el asistente de CAPCOB. ¿Qué necesitas?');
    }
  }

  lanzador.addEventListener('click', () => alternar());
  panel.querySelector('.asistente-cerrar').addEventListener('click', () => alternar(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') alternar(false); });

  // ── Mensajes ──
  function alFondo() { cuerpo.scrollTop = cuerpo.scrollHeight; }

  function botDice(...elementos) {
    const mini = el('div', 'mini');
    mini.innerHTML = '<img src="' + AVATAR + '" alt="">';
    const fila = el('div', 'asistente-fila bot', [mini, el('div', 'asistente-burbuja', elementos)]);
    cuerpo.appendChild(fila);
    alFondo();
    return fila;
  }

  function reemplazarBurbuja(fila, elementos) {
    const burbuja = fila.querySelector('.asistente-burbuja');
    burbuja.textContent = '';
    elementos.forEach(e => burbuja.appendChild(e));
    alFondo();
  }

  function usuarioDice(texto) {
    cuerpo.appendChild(el('div', 'asistente-fila usuario', [el('div', 'asistente-burbuja', [texto])]));
    alFondo();
  }

  // ── Botones ──
  function bloquearGrupo(grupo, elegida) {
    if (!grupo) return;
    grupo.querySelectorAll('.asistente-chip').forEach(b => { b.disabled = true; });
    if (elegida) elegida.classList.add('elegida');
  }

  // Al pulsarlo: se bloquea su grupo (evita repetir la consulta), se muestra lo que "dijo" el usuario y corre la acción
  function crearChip(texto, alClic, deshabilitado) {
    const b = el('button', 'asistente-chip', [texto]);
    b.type = 'button';
    if (deshabilitado) {
      b.disabled = true;
      b.title = 'Disponible próximamente';
      return b;
    }
    b.addEventListener('click', () => {
      bloquearGrupo(b.closest('.asistente-menu, .asistente-grupo'), b);
      usuarioDice(texto);
      alClic();
    });
    return b;
  }

  function mostrarGrupo(chips) {
    const grupo = el('div', 'asistente-grupo asistente-chips');
    chips.forEach(c => grupo.appendChild(crearChip(c.texto, c.clic, false)));
    cuerpo.appendChild(grupo);
    alFondo();
    return grupo;
  }

  function ofrecerVolver(extra) {
    mostrarGrupo([].concat(extra || [], [{ texto: 'Volver al menú', clic: () => mostrarMenu() }]));
  }

  function mostrarMenu(saludo) {
    const contenido = [p(saludo || 'Elige una opción:')];
    if (!activo) {
      contenido.push(el('div', 'asistente-aviso', ['Estas opciones están en revisión con el equipo y por ahora no responden.']));
    }
    botDice(...contenido);

    const menu = el('div', 'asistente-menu');
    MENU.forEach(cat => {
      menu.appendChild(el('div', 'asistente-cat', [cat.titulo]));
      const fila = el('div', 'asistente-chips');
      cat.opciones.forEach(op => fila.appendChild(crearChip(op.texto, op.accion, !activo)));
      menu.appendChild(fila);
    });
    cuerpo.appendChild(menu);
    alFondo();
  }

  // Muestra "Consultando..." y lo reemplaza por la respuesta armada con datos reales
  async function consultar(espera, generar, extra) {
    const fila = botDice(p(espera));
    try {
      reemplazarBurbuja(fila, await generar());
    } catch (e) {
      reemplazarBurbuja(fila, [p('No pude obtener la información del sistema.'), tenue(mensajeDeError(e))]);
    }
    ofrecerVolver(extra);
  }

  function responder(elementos, extra) {
    botDice(...elementos);
    ofrecerVolver(extra);
  }

  function irA(url, mensaje) {
    botDice(p(mensaje));
    setTimeout(() => { window.location.href = url; }, 600);
  }

  // ══════════════════════════════════════════════════════════════
  // CONSULTAS (datos reales)
  // ══════════════════════════════════════════════════════════════

  // Mismos números que las 4 tarjetas de Inicio
  function resumenDelDia() {
    consultar('Consultando los datos de hoy…', async () => {
      const hoy = new Date();
      const [productos, ventas] = await Promise.all([
        pedir('/productos'),
        pedir('/ventas?inicio=' + aFechaBackend(inicioDelDia(hoy)) + '&fin=' + aFechaBackend(finDelDia(hoy)))
      ]);
      const total = ventas.reduce((suma, v) => suma + Number(v.total), 0);
      const fecha = hoy.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
      const filas = [
        ['Productos registrados: ', fuerte(formatoNumero(productos.length))],
        ['Ventas registradas hoy: ', fuerte(formatoNumero(ventas.length))],
        ['Total vendido hoy: ', fuerte(dinero(total))]
      ];
      if (ventas.length > 0) filas.push(['Venta promedio: ', fuerte(dinero(total / ventas.length))]);
      filas.push(['Productos con bajo stock: ', fuerte(formatoNumero(productos.filter(esBajoStock).length))]);

      return [
        p(fuerte('Resumen de hoy, ' + fecha)),
        lista(filas),
        ventas.length === 0 ? tenue('Todavía no hay ventas registradas hoy.') : ''
      ].filter(Boolean);
    });
  }

  function productosBajoStock() {
    consultar('Revisando el inventario…', async () => {
      const productos = await pedir('/productos');
      const bajos = productos.filter(esBajoStock).sort((a, b) => Number(a.cantidad) - Number(b.cantidad));
      if (bajos.length === 0) {
        return [p('Todo el inventario está bien: ningún producto tiene ' + UMBRAL_STOCK_BAJO + ' o menos en stock.')];
      }
      const visibles = bajos.slice(0, MAX_LISTA_BAJO_STOCK);
      const salida = [
        p(fuerte(bajos.length === 1 ? '1 producto con bajo stock' : bajos.length + ' productos con bajo stock'),
          ' (' + UMBRAL_STOCK_BAJO + ' o menos):'),
        lista(visibles.map(prod => [fuerte(prod.nombre), ' — ' + textoCantidad(prod)]))
      ];
      if (bajos.length > visibles.length) {
        salida.push(tenue('Y ' + (bajos.length - visibles.length) + ' más. Puedes verlos todos en el inventario.'));
      }
      return salida;
    }, [{ texto: 'Ver inventario', clic: () => irA(RUTAS.inventario, 'Te llevo a Ver inventario.') }]);
  }

  // ── Buscar un producto (único paso con campo de texto) ──
  function iniciarBusqueda() {
    botDice(p('Escribe el nombre o el código de barras del producto y pulsa Enviar.'));
    grupoCancelarBusqueda = mostrarGrupo([{
      texto: 'Cancelar',
      clic: () => { terminarBusqueda(); mostrarMenu(); }
    }]);
    entrada.hidden = false;
    campo.value = '';
    campo.focus();
  }

  function terminarBusqueda() {
    entrada.hidden = true;
    bloquearGrupo(grupoCancelarBusqueda);
    grupoCancelarBusqueda = null;
  }

  function enviarBusqueda() {
    const texto = campo.value.trim();
    if (!texto) return;
    campo.value = '';
    terminarBusqueda();
    usuarioDice(texto);
    consultar('Buscando…', () => resultadoBusqueda(texto),
      [{ texto: 'Buscar otro producto', clic: iniciarBusqueda }]);
  }

  entrada.querySelector('button').addEventListener('click', enviarBusqueda);
  campo.addEventListener('keydown', e => { if (e.key === 'Enter') enviarBusqueda(); });

  async function resultadoBusqueda(texto) {
    const productos = await pedir('/productos');
    const q = normalizar(texto);
    const buscaCodigo = /^\d{6,}$/.test(texto);
    const hallados = productos
      .filter(prod => buscaCodigo ? String(prod.codigoBarras).includes(texto) : normalizar(prod.nombre).includes(q))
      .sort((a, b) => (normalizar(b.nombre).startsWith(q) - normalizar(a.nombre).startsWith(q)) || a.nombre.localeCompare(b.nombre, 'es'));

    if (hallados.length === 0) {
      return [p('No encontré ningún producto que coincida con "' + texto + '".'), tenue('Revisa cómo está escrito o prueba con solo una parte del nombre.')];
    }

    const salida = [p(hallados.length === 1
      ? 'Encontré 1 producto:'
      : 'Encontré ' + hallados.length + ' productos' + (hallados.length > MAX_RESULTADOS_BUSQUEDA ? ' (te muestro los primeros ' + MAX_RESULTADOS_BUSQUEDA + ')' : '') + ':')];

    hallados.slice(0, MAX_RESULTADOS_BUSQUEDA).forEach(prod => {
      const filas = [
        ['Precio: ', dinero(prod.precio) + (prod.tipoPrecio === 'PESO' ? ' por kg' : '')],
        ['Disponible: ', textoCantidad(prod) + (esBajoStock(prod) ? ' (bajo stock)' : '')],
        ['Código: ', String(prod.codigoBarras)]
      ];
      if (prod.paqueteNombre) filas.push(['Paquete: ', prod.paqueteNombre]);
      salida.push(p(fuerte(prod.nombre)), lista(filas));
    });
    return salida;
  }

  // ── Producto más vendido (ordenado por monto, igual que las tarjetas de Producto de ventas) ──
  function preguntarPeriodoMasVendido() {
    botDice(p('¿De qué período quieres verlo?'));
    mostrarGrupo(RANGOS.map(r => ({
      texto: r.texto,
      clic: () => consultar('Calculando…', () => masVendidos(r))
    })));
  }

  async function masVendidos(rango) {
    const datos = await pedir('/ventas/resumen-productos?inicio=' + aFechaBackend(rango.desde()) +
      '&fin=' + aFechaBackend(finDelDia(new Date())));
    const top = datos
      .filter(d => Number(d.totalVendido) > 0)
      .sort((a, b) => Number(b.totalVendido) - Number(a.totalVendido))
      .slice(0, 3);

    if (top.length === 0) return [p('No hay ventas registradas ' + rango.frase + '.')];

    return [
      p(fuerte('Productos más vendidos ' + rango.frase)),
      lista(top.map(d => [
        fuerte(d.nombreProducto),
        ' — ' + dinero(d.totalVendido) + ' (' + formatoNumero(d.porcentajeDelTotal, 2) + ' % del total), cantidad vendida: ' + formatoNumero(d.cantidadVendida)
      ]), true),
      tenue('Ordenados por monto vendido.')
    ];
  }

  // ── Ventas del mes ──
  function ventasDelMes() {
    consultar('Consultando las ventas del mes…', async () => {
      const ahora = new Date();
      const anio = ahora.getFullYear();
      const mes = ahora.getMonth() + 1;
      const delMes = (resumen, m) => {
        const fila = resumen.find(r => Number(r.mes) === m);
        return fila ? Number(fila.total) : 0;
      };

      const resumenAnio = await pedir('/ventas/resumen-mensual?anio=' + anio);
      const totalMes = delMes(resumenAnio, mes);
      const anteriorEsAnioPasado = mes === 1;
      const totalAnterior = anteriorEsAnioPasado
        ? delMes(await pedir('/ventas/resumen-mensual?anio=' + (anio - 1)), 12)
        : delMes(resumenAnio, mes - 1);
      const acumulado = resumenAnio.reduce((suma, r) => suma + Number(r.total), 0);

      const nombreMes = m => mayuscula(new Date(anio, m - 1, 1).toLocaleDateString('es-CO', { month: 'long' }));
      const mesAnterior = anteriorEsAnioPasado ? 12 : mes - 1;

      const salida = [
        p(fuerte('Ventas de ' + nombreMes(mes) + ' ' + anio)),
        lista([
          ['Total del mes: ', fuerte(dinero(totalMes))],
          ['Mes anterior (' + nombreMes(mesAnterior) + '): ', dinero(totalAnterior)],
          ['Acumulado del año: ', dinero(acumulado)]
        ])
      ];
      if (totalAnterior > 0) {
        const variacion = Math.round(((totalMes - totalAnterior) / totalAnterior) * 100);
        salida.push(tenue('Frente al mes anterior: ' + (variacion > 0 ? '+' : '') + variacion + ' %.'));
      } else if (totalMes > 0) {
        salida.push(tenue('El mes anterior no tuvo ventas registradas.'));
      }
      return salida;
    });
  }

  // ══════════════════════════════════════════════════════════════
  // AYUDA (respuestas fijas, redactadas según cómo funciona el sistema)
  // ══════════════════════════════════════════════════════════════

  function ayudaEscanear() {
    responder([
      p(fuerte('Cómo escanear un producto (pantalla de caja)')),
      lista([
        'Con el lector, escanea el código de barras. También puedes escribirlo en el campo y pulsar "Agregar", o usar el botón "Cámara".',
        'El producto aparece en "Venta en curso" con su precio.',
        'Revisa el subtotal, el IVA (19 %) y el total a pagar.',
        'Pulsa "Cobrar venta" y confirma con "Sí, cobrar".',
        'Al terminar se muestra el ticket para imprimir o cerrar.'
      ], true)
    ]);
  }

  function ayudaRegistrar() {
    responder([
      p(fuerte('Cómo registrar un producto')),
      lista([
        'Entra a "Registrar producto".',
        'Elige un paquete arriba, o crea uno con "+ Nuevo paquete".',
        'Escribe el nombre y elige el tipo de venta: "Precio fijo" o "Por peso (kg)".',
        'Indica el precio y la cantidad (unidades, o kilos si es por peso).',
        'Pulsa "Guardar producto". El código de barras lo genera el sistema solo y aparece en la columna "Código" de la tabla.'
      ], true)
    ], [{ texto: 'Ir a Registrar producto', clic: () => irA(RUTAS.registrar, 'Te llevo a Registrar producto.') }]);
  }

  function preguntasFrecuentes() {
    botDice(p('¿Cuál es tu duda?'));
    mostrarGrupo([
      { texto: 'No puedo iniciar sesión', clic: faqNoPuedoIniciar },
      { texto: 'Se me cerró la sesión sola', clic: faqSesionCerrada },
      { texto: '¿Qué es "bajo stock"?', clic: faqBajoStock }
    ]);
  }

  function faqNoPuedoIniciar() {
    responder([
      p(fuerte('No puedo iniciar sesión')),
      lista([
        'Revisa que el usuario y la contraseña estén bien escritos.',
        'Cada usuario solo puede tener una sesión abierta a la vez. Si aparece el aviso de que ya tiene una sesión activa en otro dispositivo o pestaña, ciérrala con "Cerrar Sesion" en ese lugar.',
        'Si cerraste la pestaña de golpe, la sesión se libera sola en cerca de un minuto.'
      ])
    ]);
  }

  function faqSesionCerrada() {
    responder([
      p(fuerte('Se me cerró la sesión sola')),
      p('Por seguridad, la sesión se cierra cuando no hay actividad: a los 15 minutos para el Administrador y a los 5 minutos para el Empleado. Solo tienes que iniciar sesión de nuevo.')
    ]);
  }

  function faqBajoStock() {
    responder([
      p(fuerte('¿Qué es "bajo stock"?')),
      p('Un producto aparece con bajo stock cuando quedan ' + UMBRAL_STOCK_BAJO + ' unidades (o ' + UMBRAL_STOCK_BAJO + ' kg, si se vende por peso) o menos. Es el número que ves en la tarjeta de Inicio.')
    ], [{ texto: 'Ver productos con bajo stock', clic: productosBajoStock }]);
  }

  // ══════════════════════════════════════════════════════════════
  // ARRANQUE
  // ══════════════════════════════════════════════════════════════
  function montar() {
    const estilos = document.createElement('link');
    estilos.rel = 'stylesheet';
    estilos.href = '/frontend/assets/css/asistente.css';
    document.head.appendChild(estilos);

    document.body.appendChild(panel);
    document.body.appendChild(lanzador);
  }

  if (document.body) montar();
  else document.addEventListener('DOMContentLoaded', montar);
})();
