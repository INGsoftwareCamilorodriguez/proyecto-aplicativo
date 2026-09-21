package com.capcob.gestionproductos.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {

    @NotBlank(message = "El usuario es obligatorio")
    private String usuario;

    @NotBlank(message = "La contraseña es obligatoria")
    private String password;

    // Identificador de este navegador (lo genera el frontend y lo guarda en localStorage).
    // Sirve para saber si una sesión activa fue abierta por este mismo navegador.
    private String dispositivoId;

    // true = el frontend confirma que ya no queda ninguna pestaña viva de la sesión
    // anterior de este navegador (se cerró de golpe, se fue la luz, etc.), así que
    // se puede tomar esa sesión de inmediato.
    private Boolean tomarSesion;
}