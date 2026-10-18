// ══════════════════════════════════════════════════════════════
// IMAGEN DEL CÓDIGO DE BARRAS EAN-13 — CAPCOB
// ══════════════════════════════════════════════════════════════
// Dibuja las barras del código a partir del número (13 dígitos), con el número
// escrito debajo. No necesita base de datos ni librerías: la imagen se calcula
// siempre desde el campo "codigoBarras" del producto, así que nunca queda
// desactualizada y no hay que guardarla.
//
// Funciones (todas en el objeto global CapcobBarras):
//   CapcobBarras.esEAN13(codigo)          -> true si son 13 dígitos con verificador correcto
//   CapcobBarras.svg(codigo)              -> texto SVG de la imagen ('' si no es EAN-13 válido)
//   CapcobBarras.descargarPNG(codigo, n)  -> descarga la imagen como PNG
//   CapcobBarras.descargarHoja(items, n)  -> descarga UNA imagen con varios códigos [{codigo, nombre}]
//   CapcobBarras.imprimir(codigo, n)      -> abre la ventana de impresión
// ══════════════════════════════════════════════════════════════

const CapcobBarras = (function () {
  // Patrones de 7 módulos por dígito (1 = barra, 0 = espacio).
  const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
  const R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
  // El primer dígito decide si cada uno de los 6 dígitos de la izquierda usa L o G.
  const PARIDAD = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];

  const ZONA_IZQ = 11;   // margen blanco a la izquierda (en módulos)
  const ZONA_DER = 7;    // margen blanco a la derecha
  const ANCHO = ZONA_IZQ + 95 + ZONA_DER;   // 113 módulos
  const ALTO = 80;

  function esEAN13(codigo) {
    if (typeof codigo !== 'string' || !/^\d{13}$/.test(codigo)) return false;
    let suma = 0;
    for (let i = 0; i < 12; i++) suma += Number(codigo[i]) * (i % 2 === 0 ? 1 : 3);
    return (10 - (suma % 10)) % 10 === Number(codigo[12]);
  }

  // Cadena de 95 módulos: guarda(3) + 6 dígitos + centro(5) + 6 dígitos + guarda(3).
  function modulos(codigo) {
    const d = codigo.split('').map(Number);
    const paridad = PARIDAD[d[0]];
    let m = '101';
    for (let i = 0; i < 6; i++) m += (paridad[i] === 'L' ? L : G)[d[i + 1]];
    m += '01010';
    for (let i = 0; i < 6; i++) m += R[d[i + 7]];
    m += '101';
    return m;
  }

  function svg(codigo) {
    if (!esEAN13(codigo)) return '';
    const m = modulos(codigo);
    const ALTO_BARRA = 60;       // barras normales
    const ALTO_GUARDA = 66;      // las barras de los extremos y del centro bajan un poco más
    let barras = '';
    let i = 0;
    while (i < m.length) {
      if (m[i] === '1') {
        let j = i;
        while (j < m.length && m[j] === '1') j++;      // junta módulos negros seguidos
        const esGuarda = i < 3 || (i >= 45 && i < 50) || i >= 92;
        barras += '<rect x="' + (ZONA_IZQ + i) + '" y="0" width="' + (j - i) + '" height="' +
                  (esGuarda ? ALTO_GUARDA : ALTO_BARRA) + '"/>';
        i = j;
      } else {
        i++;
      }
    }

    let textos = '<text x="' + (ZONA_IZQ - 6) + '" y="76">' + codigo[0] + '</text>';
    for (let k = 0; k < 6; k++) {
      textos += '<text x="' + (ZONA_IZQ + 3 + 7 * k + 3.5) + '" y="76">' + codigo[k + 1] + '</text>';
      textos += '<text x="' + (ZONA_IZQ + 50 + 7 * k + 3.5) + '" y="76">' + codigo[k + 7] + '</text>';
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + ANCHO + ' ' + ALTO +
           '" role="img" aria-label="Código de barras ' + codigo + '">' +
           '<rect width="' + ANCHO + '" height="' + ALTO + '" fill="#fff"/>' +
           '<g fill="#000">' + barras + '</g>' +
           '<g fill="#000" font-family="Arial, Helvetica, sans-serif" font-size="10" text-anchor="middle">' + textos + '</g>' +
           '</svg>';
  }

  function nombreArchivo(codigo, nombre) {
    const limpio = (nombre || '').trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
    return 'codigo-barras-' + (limpio ? limpio + '-' : '') + codigo + '.png';
  }

  function descargarPNG(codigo, nombre) {
    const texto = svg(codigo);
    if (!texto) return;
    const escala = 6;                                   // 113*6 x 80*6 px: nítido al imprimir
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = ANCHO * escala;
      canvas.height = ALTO * escala;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = nombreArchivo(codigo, nombre);
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(texto);
  }


  // Descarga UNA imagen PNG (hoja) con los códigos de varios productos:
  // nombre arriba, barras y número debajo. items = [{ codigo, nombre }]
  // Solo se incluyen los EAN-13 válidos. Devuelve cuántos códigos se dibujaron.
  function descargarHoja(items, nombreArchivoHoja) {
    const validos = (items || []).filter(function (it) { return esEAN13(it.codigo); });
    if (validos.length === 0) return Promise.resolve(0);

    const escala = 3;
    const cols = Math.min(3, validos.length);
    const filas = Math.ceil(validos.length / cols);
    const anchoCod = ANCHO * escala, altoCod = ALTO * escala;
    const margen = 30, hueco = 24, altoTitulo = 34;
    const celdaAncho = anchoCod, celdaAlto = altoTitulo + altoCod;
    const canvas = document.createElement('canvas');
    canvas.width = margen * 2 + cols * celdaAncho + (cols - 1) * hueco;
    canvas.height = margen * 2 + filas * celdaAlto + (filas - 1) * hueco;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cargar = function (it) {
      return new Promise(function (resolve) {
        const img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { resolve(null); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(it.codigo));
      });
    };

    return Promise.all(validos.map(cargar)).then(function (imgs) {
      imgs.forEach(function (img, i) {
        if (!img) return;
        const x = margen + (i % cols) * (celdaAncho + hueco);
        const y = margen + Math.floor(i / cols) * (celdaAlto + hueco);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 20px Arial, Helvetica, sans-serif';
        ctx.textAlign = 'center';
        let titulo = String(validos[i].nombre || '');
        while (titulo.length > 1 && ctx.measureText(titulo).width > celdaAncho - 10) titulo = titulo.slice(0, -1);
        if (titulo !== String(validos[i].nombre || '')) titulo += '…';
        ctx.fillText(titulo, x + celdaAncho / 2, y + 22);
        ctx.drawImage(img, x, y + altoTitulo, anchoCod, altoCod);
      });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = nombreArchivoHoja || 'codigos-de-barras.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return validos.length;
    });
  }

  function imprimir(codigo, nombre) {
    const texto = svg(codigo);
    if (!texto) return;
    const w = window.open('', '_blank', 'width=480,height=360');
    if (!w) { alert('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes e inténtalo de nuevo.'); return; }
    const titulo = String(nombre || '').replace(/[<>&"]/g, '');
    w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + titulo + '</title>' +
      '<style>body{margin:0;display:flex;flex-direction:column;align-items:center;font-family:Arial,sans-serif}' +
      'svg{width:320px;height:auto;margin-top:16px}p{margin:6px 0 0;font-size:14px}</style></head><body>' +
      texto + (titulo ? '<p>' + titulo + '</p>' : '') + '</body></html>');
    w.document.close();
    w.focus();
    setTimeout(function () { w.print(); }, 250);
  }

  return { esEAN13: esEAN13, svg: svg, descargarPNG: descargarPNG, descargarHoja: descargarHoja, imprimir: imprimir };
})();