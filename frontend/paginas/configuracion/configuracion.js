// ══════════════════════════════════════════════════════════════
// CONFIGURACIÓN — CAPCOB
// ══════════════════════════════════════════════════════════════
const MAX_IMG_BYTES = 1.5 * 1024 * 1024; // 1.5 MB, límite razonable para guardar como base64

const userId = sessionStorage.getItem("userId");

let temaSeleccionado = "claro";
let nuevaFotoPerfil = undefined; // undefined = sin cambios, "" = quitar, "data:..." = nueva
let nuevoLogo = undefined;       // igual que arriba

// ── Utilidades ──
function mostrarAlerta(texto, tipo) {
  const box = document.getElementById("alertBox");
  box.textContent = texto;
  box.className = "alert-box show " + (tipo === "error" ? "error" : "ok");
  setTimeout(() => { box.className = "alert-box"; }, 3500);
}

function archivoABase64(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_IMG_BYTES) {
      reject(new Error("La imagen pesa demasiado. Usa una de máximo 1.5 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

// ── Cargar datos actuales al abrir la página ──
async function cargarConfiguracionActual() {
  // Perfil del usuario logueado
  try {
    const res = await fetch(API_BASE_URL + "/usuarios/perfil/" + userId);
    const data = await res.json();
    if (res.ok) {
      document.getElementById("perfilNombre").value = data.nombre || "";
      if (data.fotoPerfil) {
        pintarPreview("perfilPreviewWrap", "perfilPreview", "perfilPlaceholder", data.fotoPerfil);
        document.getElementById("btnQuitarFoto").style.display = "inline-flex";
      }
    }
  } catch (e) {
    mostrarAlerta("No se pudo cargar tu perfil. Revisa la conexión con el servidor.", "error");
  }

  // Configuración global (tema + marca)
  try {
    const res = await fetch(API_BASE_URL + "/configuracion");
    const data = await res.json();
    if (res.ok) {
      temaSeleccionado = data.tema || "claro";
      marcarSwatchSeleccionado(temaSeleccionado);

      document.getElementById("marcaNombre").value = data.nombreEmpresa || "CAPCOB";
      if (data.logoUrl) {
        document.getElementById("logoPreview").src = data.logoUrl;
        document.getElementById("btnQuitarLogo").style.display = "inline-flex";
      }
    }
  } catch (e) {
    mostrarAlerta("No se pudo cargar la configuración del sistema.", "error");
  }
}

function pintarPreview(wrapId, imgId, placeholderId, src) {
  const wrap = document.getElementById(wrapId);
  const img = document.getElementById(imgId);
  img.src = src;
  img.style.display = "block";
  wrap.classList.add("has-image");
  const placeholder = placeholderId ? document.getElementById(placeholderId) : null;
  if (placeholder) placeholder.style.display = "none";
}

// ── Apariencia ──
function marcarSwatchSeleccionado(tema) {
  document.getElementById("swatchClaro").classList.toggle("selected", tema === "claro");
  document.getElementById("swatchOscuro").classList.toggle("selected", tema === "oscuro");
}

function seleccionarTema(tema) {
  temaSeleccionado = tema;
  marcarSwatchSeleccionado(tema);
  aplicarTema(tema); // vista previa inmediata en esta misma página
}

async function guardarApariencia() {
  const btn = document.getElementById("btnGuardarTema");
  btn.disabled = true;
  btn.textContent = "Guardando...";
  try {
    const res = await fetch(API_BASE_URL + "/configuracion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tema: temaSeleccionado })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.mensaje || "No se pudo guardar el tema.");

    localStorage.setItem("temaSistema", data.tema);
    aplicarTema(data.tema);
    mostrarAlerta("Apariencia actualizada para todo el panel.", "ok");
  } catch (e) {
    mostrarAlerta(e.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar apariencia";
  }
}

// ── Perfil ──
async function onPerfilFileChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const base64 = await archivoABase64(file);
    nuevaFotoPerfil = base64;
    pintarPreview("perfilPreviewWrap", "perfilPreview", "perfilPlaceholder", base64);
    document.getElementById("btnQuitarFoto").style.display = "inline-flex";
  } catch (e) {
    mostrarAlerta(e.message, "error");
  }
}

function quitarFotoPerfil() {
  nuevaFotoPerfil = "";
  const wrap = document.getElementById("perfilPreviewWrap");
  const img = document.getElementById("perfilPreview");
  wrap.classList.remove("has-image");
  img.style.display = "none";
  img.src = "";
  document.getElementById("perfilPlaceholder").style.display = "block";
  document.getElementById("btnQuitarFoto").style.display = "none";
}

async function guardarPerfil() {
  const nombre = document.getElementById("perfilNombre").value.trim();
  if (!nombre) {
    mostrarAlerta("El nombre no puede estar vacío.", "error");
    return;
  }

  const btn = document.getElementById("btnGuardarPerfil");
  btn.disabled = true;
  btn.textContent = "Guardando...";
  try {
    const body = { nombre };
    if (nuevaFotoPerfil !== undefined) body.fotoPerfil = nuevaFotoPerfil;

    const res = await fetch(API_BASE_URL + "/usuarios/perfil/" + userId, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.mensaje || "No se pudo guardar el perfil.");

    // Actualizar sesión local para que el nombre/foto se vean en el sidebar de inmediato
    sessionStorage.setItem("username", data.nombre);
    if (data.fotoPerfil) {
      sessionStorage.setItem("fotoPerfil", data.fotoPerfil);
    } else {
      sessionStorage.removeItem("fotoPerfil");
    }
    nuevaFotoPerfil = undefined;
    if (typeof renderSidebar === "function") renderSidebar();

    mostrarAlerta("Perfil actualizado.", "ok");
  } catch (e) {
    mostrarAlerta(e.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar perfil";
  }
}

// ── Marca del sistema (logo + nombre de la empresa) ──
async function onLogoFileChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const base64 = await archivoABase64(file);
    nuevoLogo = base64;
    document.getElementById("logoPreview").src = base64;
    document.getElementById("btnQuitarLogo").style.display = "inline-flex";
  } catch (e) {
    mostrarAlerta(e.message, "error");
  }
}

function quitarLogo() {
  nuevoLogo = "";
  document.getElementById("logoPreview").src = "/frontend/assets/imagenes/logo-capcob.png";
  document.getElementById("btnQuitarLogo").style.display = "none";
}

async function guardarMarca() {
  const nombreEmpresa = document.getElementById("marcaNombre").value.trim();
  if (!nombreEmpresa) {
    mostrarAlerta("El nombre de la empresa no puede estar vacío.", "error");
    return;
  }

  const btn = document.getElementById("btnGuardarMarca");
  btn.disabled = true;
  btn.textContent = "Guardando...";
  try {
    const body = { nombreEmpresa };
    if (nuevoLogo !== undefined) body.logoUrl = nuevoLogo;

    const res = await fetch(API_BASE_URL + "/configuracion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.mensaje || "No se pudo guardar la marca.");

    localStorage.setItem("nombreEmpresa", data.nombreEmpresa);
    if (data.logoUrl) {
      localStorage.setItem("logoEmpresa", data.logoUrl);
    } else {
      localStorage.removeItem("logoEmpresa");
    }
    nuevoLogo = undefined;
    aplicarMarca(data.nombreEmpresa, data.logoUrl);

    mostrarAlerta("Marca actualizada para todo el panel.", "ok");
  } catch (e) {
    mostrarAlerta(e.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar marca";
  }
}

document.addEventListener("DOMContentLoaded", cargarConfiguracionActual);
