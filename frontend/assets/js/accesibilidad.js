/*!
 * CAPCOB — Widget de accesibilidad (vanilla JS, sin dependencias)
 * Opciones: Aumentar letra · Disminuir letra · Dislexia · Lector · Restablecer
 *
 * Cómo escala: cambia SOLO el tamaño base de la página (html { font-size: X% }).
 * Todo el CSS del proyecto usa rem, así que el cambio es inmediato, no recorre
 * elementos y no rompe el diseño. Tiene un límite: 90 % a 120 %.
 *
 * Uso: <script src="/frontend/assets/js/accesibilidad.js" defer></script>
 */
(function () {
  if (window.__widgetAccesibilidad) return;
  window.__widgetAccesibilidad = true;

  var KEY = 'capcob-a11y';
  var PCT_MIN = 90, PCT_MAX = 120, PCT_PASO = 5;   // límites del tamaño de letra
  var BONO_DISLEXIA = 1.05;                         // la dislexia agranda un poco la letra
  var TOPE_TOTAL = 1.25;                            // nunca pasa de 125 % en total

  var prefs = { pct: 100, dislexia: false };
  var lector = false;

  try {
    var g = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (typeof g.pct === 'number') prefs.pct = Math.min(PCT_MAX, Math.max(PCT_MIN, Math.round(g.pct / PCT_PASO) * PCT_PASO));
    if (typeof g.dislexia === 'boolean') prefs.dislexia = g.dislexia;
  } catch (e) {}

  /* ---------- Estilos ---------- */
  var css = `
  #a11y-root{
    --a11y-fondo:var(--dev-accent,#1c7c2b); --a11y-acento:#ffd54a; --a11y-texto:#ffffff;
    /* Posición: abajo a la derecha. Cambia --a11y-abajo para subirlo o bajarlo. */
    --a11y-derecha:31px; --a11y-abajo:24px;
    position:fixed; right:var(--a11y-derecha); bottom:var(--a11y-abajo); z-index:40;
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
    font-size:16px; /* el widget NO cambia de tamaño con el resto de la página */
  }
  #a11y-root *{box-sizing:border-box; font-family:inherit; font-size:inherit; letter-spacing:normal; word-spacing:normal; line-height:1.2; margin:0}
  #a11y-fab{
    position:relative; width:52px; height:52px; border-radius:50%;
    border:3px solid var(--a11y-fondo); cursor:pointer; background:#fff; color:var(--a11y-fondo);
    display:grid; place-items:center; box-shadow:0 4px 14px rgba(0,0,0,.3); padding:0;
  }
  #a11y-fab svg{width:28px; height:28px}
  #a11y-fab.a11y-on::after{
    content:""; position:absolute; top:-4px; right:-4px; width:14px; height:14px;
    border-radius:50%; background:var(--a11y-acento); border:2px solid var(--a11y-fondo);
  }
  #a11y-panel{
    position:absolute; right:0; bottom:62px; width:232px; padding:14px;
    background:var(--a11y-fondo); color:var(--a11y-texto); border-radius:18px;
    box-shadow:0 10px 30px rgba(0,0,0,.35);
    display:none; grid-template-columns:1fr 1fr; gap:12px;
  }
  #a11y-panel.abierto{display:grid}
  #a11y-panel .tit{grid-column:1/-1; text-align:center; font-size:14px; font-weight:600}
  #a11y-nivel{grid-column:1/-1; text-align:center; font-size:12px; opacity:.9; margin-top:-6px}
  .a11y-op{
    background:none; border:0; color:var(--a11y-texto); cursor:pointer; padding:2px; border-radius:12px;
    display:flex; flex-direction:column; align-items:center; gap:6px; font-size:12px;
  }
  .a11y-op .ico{
    width:62px; height:62px; border-radius:14px; background:#fff; color:var(--a11y-fondo);
    display:grid; place-items:center; font-weight:700; font-size:24px; border:3px solid transparent;
  }
  .a11y-op .ico svg{width:34px; height:34px}
  .a11y-op[aria-pressed="true"] .ico{border-color:var(--a11y-acento); background:#d9f2dc}
  .a11y-op[aria-disabled="true"]{opacity:.4; cursor:not-allowed}
  .a11y-op.ancho{grid-column:1/-1; flex-direction:row; justify-content:center; gap:8px; font-size:13px; padding:6px}
  .a11y-op.ancho .ico{width:auto; height:auto; background:none; color:var(--a11y-texto); border:0}
  .a11y-op.ancho .ico svg{width:20px; height:20px}
  #a11y-root button:focus-visible{outline:3px solid var(--a11y-acento); outline-offset:3px}
  #a11y-msg{grid-column:1/-1; font-size:11px; text-align:center; opacity:.95}
  #a11y-msg:empty{display:none}

  /* Con el botón de la IA (66px, abajo a la derecha) este va encima, con espacio */
  body:has(.asistente-lanzador) #a11y-root{--a11y-abajo:140px}
  /* Con el chat de la IA abierto se oculta para no taparlo */
  body:has(.asistente-panel.abierto) #a11y-root{display:none}
  @media (max-width:520px){
    #a11y-root{--a11y-derecha:21px}
    body:has(.asistente-lanzador) #a11y-root{--a11y-abajo:120px}
    #a11y-panel{width:212px}
  }

  /* Lector activo: los clics solo leen */
  html.a11y-lector body{cursor:help}
  html.a11y-lector #a11y-root, html.a11y-lector #a11y-root *{cursor:pointer}

  /* Menú lateral: si el texto crece, que baje de línea en vez de salirse */
  .sidebar a, .sidebar button{overflow-wrap:anywhere}

  /* Modo dislexia: fuente legible y un poco más de aire, sin romper el diseño */
  html.a11y-dislexia body :not(#a11y-root):not(#a11y-root *):not(i):not(svg):not(svg *):not(canvas):not([class*="icon"]):not([class*="fa-"]){
    font-family:"Lexend","OpenDyslexic","Comic Sans MS","Verdana",sans-serif !important;
    letter-spacing:.02em !important;
    word-spacing:.08em !important;
  }
  html.a11y-dislexia body :is(p,li,dd,blockquote):not(#a11y-root *){line-height:1.55 !important}
  `;
  var estilo = document.createElement('style');
  estilo.id = 'a11y-estilos';
  estilo.textContent = css;
  document.head.appendChild(estilo);

  /* ---------- HTML ---------- */
  var icoAcc = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="4" r="2.2"/><path d="M4 8.2c0-.7.6-1.2 1.3-1.1 2.2.4 4.6.6 6.7.6s4.5-.2 6.7-.6c.7-.1 1.3.4 1.3 1.1 0 .6-.4 1.1-1 1.2-1.6.3-3.2.5-4.7.6v3.2l2.1 6.1c.2.6-.1 1.3-.7 1.5-.6.2-1.3-.1-1.5-.7L12 15.5l-1.7 4.5c-.2.6-.9.9-1.5.7-.6-.2-.9-.9-.7-1.5l2.1-6.1V10c-1.5-.1-3.1-.3-4.7-.6-.6-.1-1-.6-1-1.2z"/></svg>';
  var icoLector = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
  var icoReset = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';

  var root = document.createElement('div');
  root.id = 'a11y-root';
  root.innerHTML =
    '<button id="a11y-fab" type="button" aria-label="Abrir opciones de accesibilidad" aria-expanded="false" aria-controls="a11y-panel">' + icoAcc + '</button>' +
    '<div id="a11y-panel" role="dialog" aria-label="Opciones de accesibilidad">' +
      '<div class="tit">Accesibilidad</div>' +
      '<div id="a11y-nivel" aria-live="polite"></div>' +
      '<button class="a11y-op" type="button" data-accion="mas"><span class="ico">A+</span>Aumentar letra</button>' +
      '<button class="a11y-op" type="button" data-accion="menos"><span class="ico">A&minus;</span>Disminuir letra</button>' +
      '<button class="a11y-op" type="button" data-accion="dislexia" aria-pressed="false"><span class="ico">Ab</span>Dislexia</button>' +
      '<button class="a11y-op" type="button" data-accion="lector" aria-pressed="false"><span class="ico">' + icoLector + '</span>Lector</button>' +
      '<button class="a11y-op ancho" type="button" data-accion="reset"><span class="ico">' + icoReset + '</span>Restablecer</button>' +
      '<div id="a11y-msg" role="status" aria-live="polite"></div>' +
    '</div>';
  document.body.appendChild(root);

  var fab = root.querySelector('#a11y-fab');
  var panel = root.querySelector('#a11y-panel');
  var msg = root.querySelector('#a11y-msg');
  var nivel = root.querySelector('#a11y-nivel');
  var btnMas = root.querySelector('[data-accion="mas"]');
  var btnMenos = root.querySelector('[data-accion="menos"]');
  var btnDislexia = root.querySelector('[data-accion="dislexia"]');
  var btnLector = root.querySelector('[data-accion="lector"]');

  /* ---------- Tamaño de letra (instantáneo) ---------- */
  function aplicarTamano() {
    var f = prefs.pct / 100;
    if (prefs.dislexia) f = Math.min(TOPE_TOTAL, f * BONO_DISLEXIA);
    // Solo se toca el tamaño base: todo el diseño (en rem) se ajusta en el mismo instante.
    document.documentElement.style.fontSize = (Math.abs(f - 1) < 0.001) ? '' : (f * 100).toFixed(1) + '%';

    var tope = prefs.pct >= PCT_MAX, piso = prefs.pct <= PCT_MIN;
    btnMas.setAttribute('aria-disabled', String(tope));
    btnMenos.setAttribute('aria-disabled', String(piso));
    nivel.textContent = 'Letra: ' + prefs.pct + ' %' + (tope ? ' (máximo)' : piso ? ' (mínimo)' : '');
  }

  /* ---------- Dislexia ---------- */
  function cargarFuenteDislexia() {
    if (document.getElementById('a11y-lexend')) return;
    var l = document.createElement('link');
    l.id = 'a11y-lexend';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;600&display=swap';
    document.head.appendChild(l);
  }

  function aplicarDislexia() {
    document.documentElement.classList.toggle('a11y-dislexia', prefs.dislexia);
    if (prefs.dislexia) cargarFuenteDislexia();
    btnDislexia.setAttribute('aria-pressed', String(prefs.dislexia));
  }

  /* ---------- Lector (voz del navegador) ---------- */
  var hayVoz = 'speechSynthesis' in window;

  function hablar(texto) {
    if (!hayVoz || !texto) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(texto.replace(/\s+/g, ' ').trim().slice(0, 800));
    u.lang = document.documentElement.lang || 'es';
    u.rate = 0.95;
    speechSynthesis.speak(u);
  }

  function aplicarLector() {
    document.documentElement.classList.toggle('a11y-lector', lector);
    btnLector.setAttribute('aria-pressed', String(lector));
    fab.classList.toggle('a11y-on', lector);
    msg.textContent = lector ? 'Lector activo: los clics solo leen el texto. Desactívalo para usar los botones.' : '';
    if (!lector && hayVoz) speechSynthesis.cancel();
  }

  // Mientras el lector está activo, el clic SOLO lee: no ejecuta botones ni enlaces (sin clics fantasma).
  document.addEventListener('click', function (e) {
    if (!lector || root.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    var sel = String(window.getSelection ? window.getSelection() : '').trim();
    var el = e.target.closest ? e.target.closest('h1,h2,h3,h4,h5,h6,p,li,a,button,label,td,th,figcaption,legend') : null;
    el = el || e.target;
    hablar(sel || el.getAttribute('aria-label') || el.getAttribute('alt') || el.innerText || el.textContent || el.value || '');
  }, true);

  window.addEventListener('pagehide', function () { if (hayVoz) speechSynthesis.cancel(); });

  /* ---------- Acciones ---------- */
  function guardar() {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {}
  }

  function abrir(abierto) {
    panel.classList.toggle('abierto', abierto);
    fab.setAttribute('aria-expanded', String(abierto));
    if (abierto) btnMas.focus();
  }

  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-accion]');
    if (!b || b.getAttribute('aria-disabled') === 'true') return;
    switch (b.dataset.accion) {
      case 'mas':
        prefs.pct = Math.min(PCT_MAX, prefs.pct + PCT_PASO); aplicarTamano(); break;
      case 'menos':
        prefs.pct = Math.max(PCT_MIN, prefs.pct - PCT_PASO); aplicarTamano(); break;
      case 'dislexia':
        prefs.dislexia = !prefs.dislexia; aplicarDislexia(); aplicarTamano(); break;
      case 'lector':
        if (!hayVoz) { msg.textContent = 'Tu navegador no soporta lectura en voz alta.'; return; }
        lector = !lector; aplicarLector(); break;
      case 'reset':
        prefs = { pct: 100, dislexia: false }; lector = false;
        aplicarDislexia(); aplicarLector(); aplicarTamano(); break;
    }
    guardar();
  });

  fab.addEventListener('click', function () { abrir(!panel.classList.contains('abierto')); });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (panel.classList.contains('abierto')) { abrir(false); fab.focus(); }
    if (hayVoz) speechSynthesis.cancel();
  });

  document.addEventListener('click', function (e) {
    if (!root.contains(e.target) && panel.classList.contains('abierto')) abrir(false);
  });

  /* ---------- Inicio ---------- */
  aplicarDislexia();
  aplicarTamano();
})();