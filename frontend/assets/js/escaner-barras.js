// ══════════════════════════════════════════════════════════════
// LECTOR DE CÓDIGOS DE BARRAS POR CÁMARA — CAPCOB
// ══════════════════════════════════════════════════════════════
// · Lee TODA la imagen de la cámara (ya no solo la franja del centro): el código puede
//   estar en cualquier parte del cuadro y en cualquier orientación (horizontal o vertical).
// · Tolera códigos borrosos o con poco contraste: por cada cuadro prueba varias
//   "versiones" de la imagen (original, contraste + nitidez, reducida a la mitad,
//   binarizador global, girada 90°). Recuerda cuál funcionó y la prueba primero, así que
//   lo normal es leer en el primer intento.
// · RÁPIDO: primero UBICA el código en una miniatura (zona con muchas rayas paralelas), lo recorta
//   del video a máxima resolución y decodifica solo ese recorte. Si no lo ubica, prueba el cuadro completo.
// · Usa el BarcodeDetector nativo (Chrome/Edge Android, Mac) si existe, y ZXing como respaldo.
// · Analiza cada cuadro nuevo de video apenas llega (requestVideoFrameCallback), sin esperas fijas.
// · Toca el video para volver a enfocar (cámaras que lo permiten).
//
// API (sin cambios, compatible con las pantallas actuales):
//   CapcobEscaner.disponible()                    -> true si hay un decodificador cargado
//   await CapcobEscaner.listarCamaras()           -> [{ id, label }]
//   const lector = new CapcobEscaner.Lector('idContenedor');
//   await lector.start(camaraId | {facingMode}, onCodigo)
//   await lector.stop(); lector.clear();
// ══════════════════════════════════════════════════════════════

const CapcobEscaner = (function () {
  const FORMATOS_NATIVOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];
  const SIN_DIGITO_CONTROL = ['code_39', 'itf'];   // formatos sin checksum: se confirman con 2 lecturas iguales
  const ANCHO_MAX = 1280;                          // ancho máximo del cuadro completo que se le pasa a ZXing
  const LOC_ANCHO = 640;                           // ancho de la miniatura donde se ubica el código
  const BLOQUE = 16;                               // tamaño de bloque (en la miniatura) del localizador
  const UMBRAL_LOC = 12;                           // intensidad mínima de "rayas" para considerar una zona
  const CADA_N_CUADROS_ZXING_CON_NATIVO = 3;       // si hay detector nativo, ZXing solo apoya cada N cuadros

  // Versiones de la imagen que se prueban (el orden se reajusta solo según cuál funciona)
  const ESTRATEGIAS = {
    normal:  { escala: 1,   mejora: false, global: false, rotar: false },
    nitida:  { escala: 1,   mejora: true,  global: false, rotar: false },
    global:  { escala: 1,   mejora: true,  global: true,  rotar: false },
    mitad:   { escala: 0.5, mejora: true,  global: false, rotar: false },   // ayuda con el desenfoque
    vertical:{ escala: 1,   mejora: true,  global: false, rotar: true  }
  };

  function disponible() {
    return ('BarcodeDetector' in window) || (typeof ZXing !== 'undefined');
  }

  // Pide permiso (sin él el navegador oculta los nombres) y lista las cámaras
  async function listarCamaras() {
    const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
    tmp.getTracks().forEach(t => t.stop());
    const dispositivos = await navigator.mediaDevices.enumerateDevices();
    return dispositivos
      .filter(d => d.kind === 'videoinput')
      .map(d => ({ id: d.deviceId, label: d.label }));
  }

  // ── Procesado de imagen (sobre arreglos de luminancia) ─────────────────────
  // Estira el contraste usando los percentiles 2 y 98 del histograma
  function estirarContraste(lum) {
    const hist = new Uint32Array(256);
    for (let i = 0; i < lum.length; i++) hist[lum[i]]++;
    const total = lum.length;
    let acum = 0, bajo = 0, alto = 255;
    for (let v = 0; v < 256; v++) { acum += hist[v]; if (acum >= total * 0.02) { bajo = v; break; } }
    acum = 0;
    for (let v = 255; v >= 0; v--) { acum += hist[v]; if (acum >= total * 0.02) { alto = v; break; } }
    if (alto - bajo < 12 || (alto - bajo) > 235) return lum;   // sin rango útil o ya tiene buen contraste
    const k = 255 / (alto - bajo);
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = (v - bajo) * k;
    const out = new Uint8ClampedArray(lum.length);
    for (let i = 0; i < lum.length; i++) out[i] = lut[lum[i]];
    return out;
  }

  // Máscara de nitidez 3x3 (cruz): realza los bordes de las barras borrosas
  function afilar(lum, w, h) {
    const out = new Uint8ClampedArray(lum.length);
    out.set(lum);
    for (let y = 1; y < h - 1; y++) {
      let i = y * w + 1;
      for (let x = 1; x < w - 1; x++, i++) {
        out[i] = 5 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - w] - lum[i + w];
      }
    }
    return out;
  }

  // Gira 90° (para códigos que están en vertical)
  function girar90(lum, w, h) {
    const out = new Uint8ClampedArray(lum.length);
    for (let y = 0; y < h; y++) {
      const fila = y * w;
      for (let x = 0; x < w; x++) out[x * h + (h - 1 - y)] = lum[fila + x];
    }
    return out;
  }

  // ── Localizador: busca en la miniatura la zona con muchas rayas paralelas (= código de barras) ──
  // Devuelve hasta 2 zonas (código horizontal y/o girado 90°), la más probable primero.
  function localizar(lum, w, h) {
    const bw = Math.floor(w / BLOQUE), bh = Math.floor(h / BLOQUE);
    if (bw < 4 || bh < 4) return [];
    const A = new Float32Array(bw * bh);   // rayas verticales  (código horizontal)
    const B = new Float32Array(bw * bh);   // rayas horizontales (código girado 90°)
    const maxY = bh * BLOQUE - 1, maxX = bw * BLOQUE - 1;
    for (let y = 0; y < maxY; y++) {
      const fila = y * w, by = ((y / BLOQUE) | 0) * bw;
      for (let x = 0; x < maxX; x++) {
        const i = fila + x;
        const gx = Math.abs(lum[i + 1] - lum[i]);
        const gy = Math.abs(lum[i + w] - lum[i]);
        const b = by + ((x / BLOQUE) | 0);
        if (gx > gy) A[b] += gx - gy; else B[b] += gy - gx;
      }
    }
    const area = BLOQUE * BLOQUE;
    for (let i = 0; i < A.length; i++) { A[i] /= area; B[i] /= area; }

    const zonas = [];
    [[A, false], [B, true]].forEach(function (par) {
      const z = mejorZona(par[0], bw, bh, par[1]);
      if (z) zonas.push(z);
    });
    zonas.sort(function (a, b) { return b.score - a.score; });
    // descarta zonas mucho más débiles que la mejor (vigas, rayas del fondo)
    return zonas.filter(function (z) { return z.score >= zonas[0].score * 0.3; });
  }

  // Suaviza el mapa, toma el bloque más "rayado" y crece por los bloques vecinos parecidos
  function mejorZona(M, bw, bh, giro) {
    const S = new Float32Array(bw * bh);
    let max = 0, mi = -1;
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        let suma = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= bh) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= bw) continue;
            suma += M[yy * bw + xx]; n++;
          }
        }
        const v = suma / n;
        S[y * bw + x] = v;
        if (v > max) { max = v; mi = y * bw + x; }
      }
    }
    if (mi < 0 || max < UMBRAL_LOC) return null;
    const umbral = Math.max(max * 0.4, UMBRAL_LOC * 0.6);
    const visto = new Uint8Array(bw * bh);
    const pila = [mi]; visto[mi] = 1;
    let x0 = bw, y0 = bh, x1 = 0, y1 = 0;
    while (pila.length) {
      const c = pila.pop(), cx = c % bw, cy = (c / bw) | 0;
      if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
      if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
      const vecinos = [cx > 0 ? c - 1 : -1, cx < bw - 1 ? c + 1 : -1, cy > 0 ? c - bw : -1, cy < bh - 1 ? c + bw : -1];
      for (let k = 0; k < 4; k++) {
        const n = vecinos[k];
        if (n >= 0 && !visto[n] && S[n] >= umbral) { visto[n] = 1; pila.push(n); }
      }
    }
    const ancho = x1 - x0 + 1, alto = y1 - y0 + 1;
    const largo = giro ? alto : ancho, corto = giro ? ancho : alto;
    if (largo < 3 || corto < 2) return null;   // demasiado pequeña para ser un código
    return { x0: x0, y0: y0, x1: x1, y1: y1, giro: giro, score: max };
  }

  function nombreFormatoZXing(f) {
    try { return String(ZXing.BarcodeFormat[f] || f).toLowerCase(); } catch (e) { return ''; }
  }

  const pausa = () => new Promise(function (r) { setTimeout(r, 0); });

  function Lector(idContenedor) {
    this.contenedor = document.getElementById(idContenedor);
    this.video = null;
    this.stream = null;
    this.timer = null;
    this.activo = false;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.detectorNativo = null;
    this.lectorZXing = null;
    this.callback = null;
    this.orden = ['normal', 'nitida', 'global', 'mitad', 'vertical'];
    this.contador = 0;
    this.pendiente = null;   // lectura por confirmar (formatos sin checksum)
    this.cloc = document.createElement('canvas');   // miniatura para ubicar el código
    this.cloctx = this.cloc.getContext('2d', { willReadFrequently: true });
    this.ordenZona = ['nitida', 'normal', 'global', 'mitad'];   // versiones que se prueban sobre el recorte
    this._idxFull = 0;
    this.overlay = null;
  }

  // camara: id de dispositivo (string) o { facingMode: 'environment' | 'user' }
  Lector.prototype.start = async function (camara, onCodigo) {
    if (!disponible()) throw new Error('No se pudo cargar el lector de códigos de barras.');
    this.callback = onCodigo;

    const base = { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } };
    let video;
    if (typeof camara === 'string' && camara) {
      video = Object.assign({ deviceId: { exact: camara } }, base);
    } else {
      const modo = (camara && camara.facingMode) || 'environment';
      video = Object.assign({ facingMode: { ideal: modo } }, base);
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ video: video, audio: false });
    this._enfocar(false);

    // Vista previa
    this.contenedor.innerHTML = '';
    this.contenedor.style.position = 'relative';
    const v = document.createElement('video');
    v.setAttribute('playsinline', '');
    v.muted = true;
    v.autoplay = true;
    v.style.cssText = 'width:100%;display:block;background:#000;cursor:pointer;';
    v.srcObject = this.stream;
    this.contenedor.appendChild(v);

    // Guía visual: marco con esquinas que abarca casi toda la imagen (se lee todo el cuadro)
    const guia = document.createElement('div');
    guia.style.cssText = 'position:absolute;left:3%;right:3%;top:4%;bottom:4%;pointer-events:none;' +
      'border:2px dashed rgba(255,255,255,.55);border-radius:12px;';
    this.contenedor.appendChild(guia);
    // Recuadro que sigue al código ubicado (naranja = ubicado, verde = leído)
    const ov = document.createElement('canvas');
    ov.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
    this.contenedor.appendChild(ov);
    this.overlay = ov;
    this.video = v;

    // Tocar el video = volver a enfocar
    const self = this;
    v.addEventListener('click', function () { self._enfocar(true); });
    await v.play();

    // Decodificador nativo
    this.detectorNativo = null;
    if ('BarcodeDetector' in window) {
      try {
        const soportados = await window.BarcodeDetector.getSupportedFormats();
        const formatos = FORMATOS_NATIVOS.filter(function (f) { return soportados.indexOf(f) !== -1; });
        if (formatos.length) this.detectorNativo = new window.BarcodeDetector({ formats: formatos });
      } catch (e) { this.detectorNativo = null; }
    }
    // ZXing (respaldo o apoyo)
    if (typeof ZXing !== 'undefined') {
      const hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
        ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A,
        ZXing.BarcodeFormat.UPC_E, ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.ITF
      ]);
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      this.lectorZXing = new ZXing.MultiFormatReader();
      this.lectorZXing.setHints(hints);
    }

    this.activo = true;
    this._ciclo();
  };

  // Enfoque continuo; con "forzar" hace un enfoque puntual y vuelve a continuo
  Lector.prototype._enfocar = async function (forzar) {
    try {
      const pista = this.stream && this.stream.getVideoTracks()[0];
      if (!pista || !pista.getCapabilities) return;
      const cap = pista.getCapabilities();
      const modos = cap.focusMode || [];
      if (forzar && modos.indexOf('single-shot') !== -1) {
        await pista.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] });
        await new Promise(function (r) { setTimeout(r, 700); });
      }
      if (modos.indexOf('continuous') !== -1) {
        await pista.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
      }
    } catch (e) { /* cámara sin controles de enfoque */ }
  };

  // Bucle: procesa cada cuadro nuevo apenas llega
  Lector.prototype._ciclo = async function () {
    if (!this.activo) return;
    let lectura = null;
    try { lectura = await this._leerCuadro(); } catch (e) { /* un cuadro fallido no detiene el escaneo */ }
    if (!this.activo) return;
    if (lectura && this._confirmar(lectura) && this.callback) this.callback(lectura.texto);
    this._siguienteCuadro();
  };

  Lector.prototype._siguienteCuadro = function () {
    if (!this.activo || this._programado) return;
    this._programado = true;
    const self = this;
    const v = this.video;
    // se ejecuta una sola vez: lo que llegue primero (cuadro nuevo o respaldo por tiempo)
    const lanzar = function () {
      if (!self._programado) return;
      self._programado = false;
      clearTimeout(self.timer);
      self._ciclo();
    };
    if (v && typeof v.requestVideoFrameCallback === 'function') {
      v.requestVideoFrameCallback(lanzar);
      this.timer = setTimeout(lanzar, 500);
    } else {
      this.timer = setTimeout(lanzar, 40);
    }
  };

  // EAN/UPC/Code128 tienen dígito de control: se aceptan al instante.
  // Code39/ITF no lo tienen: se piden dos lecturas iguales seguidas para evitar falsos positivos.
  Lector.prototype._confirmar = function (lectura) {
    if (SIN_DIGITO_CONTROL.indexOf(lectura.formato) === -1) return true;
    const ahora = Date.now();
    const p = this.pendiente;
    if (p && p.texto === lectura.texto && (ahora - p.ts) < 1500) { this.pendiente = null; return true; }
    this.pendiente = { texto: lectura.texto, ts: ahora };
    return false;
  };

  Lector.prototype._leerCuadro = async function () {
    const v = this.video;
    if (!v || v.readyState < 2 || !v.videoWidth) return null;
    this.contador++;

    // 1) Detector nativo sobre el cuadro COMPLETO
    if (this.detectorNativo) {
      try {
        const r = await this.detectorNativo.detect(v);
        if (r && r.length) return { texto: r[0].rawValue, formato: String(r[0].format || '') };
      } catch (e) { /* se sigue con ZXing */ }
      if (!this.lectorZXing || (this.contador % CADA_N_CUADROS_ZXING_CON_NATIVO) !== 0) return null;
    }
    if (!this.lectorZXing) return null;

    // 2) Ubica la(s) zona(s) con aspecto de código y lee solo ese recorte a máxima resolución
    const zonas = this._localizar();
    this._marcar(zonas.length ? zonas[0] : null, false);
    for (let k = 0; k < zonas.length; k++) {
      if (!this.activo) return null;
      const res = this._leerOrden(this.ordenZona, zonas[k]);
      if (res) { this._marcar(zonas[k], true); return res; }
      await pausa();
    }

    // 3) Respaldo: una versión del cuadro completo por turno (si el localizador no lo ubicó)
    const n = this.orden.length;
    const id = this.orden[this._idxFull % n];
    this._idxFull++;
    const res = this._probar(ESTRATEGIAS[id], null);
    if (res) {
      if (this.orden[0] !== id) { this.orden.splice(this.orden.indexOf(id), 1); this.orden.unshift(id); }
      return res;
    }
    return null;
  };

  // Prueba las versiones en orden; la que funciona pasa al frente para la próxima vez
  Lector.prototype._leerOrden = function (orden, zona) {
    for (let k = 0; k < orden.length; k++) {
      const id = orden[k];
      const res = this._probar(ESTRATEGIAS[id], zona);
      if (res) {
        if (k > 0) { orden.splice(k, 1); orden.unshift(id); }
        return res;
      }
    }
    return null;
  };

  // Miniatura del cuadro -> zonas candidatas en coordenadas del video
  Lector.prototype._localizar = function () {
    const v = this.video, W = v.videoWidth, H = v.videoHeight;
    const lw = Math.min(LOC_ANCHO, W), lh = Math.max(32, Math.round(H * lw / W));
    if (this.cloc.width !== lw) this.cloc.width = lw;
    if (this.cloc.height !== lh) this.cloc.height = lh;
    this.cloctx.drawImage(v, 0, 0, lw, lh);
    const datos = this.cloctx.getImageData(0, 0, lw, lh).data;
    const lum = new Uint8ClampedArray(lw * lh);
    for (let i = 0, j = 0; i < datos.length; i += 4, j++) {
      lum[j] = (datos[i] * 77 + datos[i + 1] * 150 + datos[i + 2] * 29) >> 8;
    }
    const f = W / lw;
    return localizar(lum, lw, lh).map(function (z) {
      let sx = z.x0 * BLOQUE * f, sy = z.y0 * BLOQUE * f;
      let sw = (z.x1 - z.x0 + 1) * BLOQUE * f, sh = (z.y1 - z.y0 + 1) * BLOQUE * f;
      const mx = sw * 0.2 + BLOQUE * f * 0.5, my = sh * 0.2 + BLOQUE * f * 0.5;   // margen (zona de silencio)
      sx = Math.max(0, sx - mx); sy = Math.max(0, sy - my);
      sw = Math.min(W - sx, sw + 2 * mx); sh = Math.min(H - sy, sh + 2 * my);
      const esc = Math.min(2, Math.max(0.5, 800 / Math.max(sw, sh)));   // deja el recorte en un tamaño cómodo
      return { sx: sx, sy: sy, sw: sw, sh: sh, esc: esc, giro: z.giro };
    });
  };

  // Dibuja el recuadro que sigue al código
  Lector.prototype._marcar = function (zona, leido) {
    const ov = this.overlay, v = this.video;
    if (!ov || !v || !v.videoWidth) return;
    const cw = ov.clientWidth, ch = ov.clientHeight;
    if (ov.width !== cw) ov.width = cw;
    if (ov.height !== ch) ov.height = ch;
    const c = ov.getContext('2d');
    c.clearRect(0, 0, cw, ch);
    if (!zona) return;
    const kx = cw / v.videoWidth, ky = ch / v.videoHeight;
    c.lineWidth = 3;
    c.strokeStyle = leido ? '#22c55e' : '#f59e0b';
    c.strokeRect(zona.sx * kx, zona.sy * ky, zona.sw * kx, zona.sh * ky);
  };

  // zona (opcional): recorte del video a leer; sin zona se usa el cuadro completo
  Lector.prototype._probar = function (est, zona) {
    const v = this.video;
    const W = v.videoWidth, H = v.videoHeight;
    let sx = 0, sy = 0, sw = W, sh = H, esc;
    if (zona) { sx = zona.sx; sy = zona.sy; sw = zona.sw; sh = zona.sh; esc = zona.esc * est.escala; }
    else esc = Math.min(1, ANCHO_MAX / W) * est.escala;
    let w = Math.max(32, Math.round(sw * esc));
    let h = Math.max(32, Math.round(sh * esc));

    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.ctx.drawImage(v, sx, sy, sw, sh, 0, 0, w, h);
    const datos = this.ctx.getImageData(0, 0, w, h).data;

    let lum = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < datos.length; i += 4, j++) {
      lum[j] = (datos[i] * 77 + datos[i + 1] * 150 + datos[i + 2] * 29) >> 8;
    }
    if (est.mejora) { lum = estirarContraste(lum); lum = afilar(lum, w, h); }
    if (est.rotar || (zona && zona.giro)) { lum = girar90(lum, w, h); const t = w; w = h; h = t; }

    try {
      const fuente = new ZXing.RGBLuminanceSource(lum, w, h);
      const bin = est.global ? new ZXing.GlobalHistogramBinarizer(fuente) : new ZXing.HybridBinarizer(fuente);
      const r = this.lectorZXing.decode(new ZXing.BinaryBitmap(bin));
      return { texto: r.getText(), formato: nombreFormatoZXing(r.getBarcodeFormat()) };
    } catch (e) {
      return null;   // no hay código legible en esta versión
    }
  };

  Lector.prototype.stop = async function () {
    this.activo = false;
    this._programado = false;
    clearTimeout(this.timer);
    if (this.stream) this.stream.getTracks().forEach(function (t) { t.stop(); });
    this.stream = null;
    if (this.video) { try { this.video.srcObject = null; } catch (e) {} }
    if (this.overlay) { const c = this.overlay.getContext('2d'); c.clearRect(0, 0, this.overlay.width, this.overlay.height); }
  };

  Lector.prototype.clear = function () {
    if (this.contenedor) this.contenedor.innerHTML = '';
    this.video = null;
  };

  return { disponible: disponible, listarCamaras: listarCamaras, Lector: Lector };
})();