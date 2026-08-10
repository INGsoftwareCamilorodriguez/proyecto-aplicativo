package com.capcob.gestionproductos.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UsuarioRequest {

    @NotBlank(message = "El nombre es obligatorio")
    private String nombre;

    @NotBlank(message = "El correo (usuario) es obligatorio")
    private String usuario;

    // Obligatoria al crear. Al editar, si viene vacía/nula se conserva la actual.
    private String password;

    // Al crear siempre queda true por defecto; al editar permite activar/inactivar.
    private Boolean activo;
}