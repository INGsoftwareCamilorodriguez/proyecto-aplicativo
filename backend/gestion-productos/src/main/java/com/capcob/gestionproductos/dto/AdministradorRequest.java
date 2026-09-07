package com.capcob.gestionproductos.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

// Datos que solicita el Desarrollador al crear o editar la cuenta de un
// Administrador (una empresa cliente). Incluye tanto las credenciales de
// acceso como los datos de la empresa que representa ese administrador.
@Data
public class AdministradorRequest {

    @NotBlank(message = "El nombre es obligatorio")
    private String nombre;

    @NotBlank(message = "El correo (usuario) es obligatorio")
    private String usuario;

    // Obligatoria al crear. Al editar, si viene vacía/nula se conserva la actual.
    private String password;

    private String telefono;

    @NotBlank(message = "El nombre de la empresa es obligatorio")
    private String empresaNombre;

    // Identificación / NIT de la empresa. Opcional.
    private String empresaIdentidad;

    // Logo de la empresa en base64. Cadena vacía = quitar el logo actual.
    private String empresaLogo;

    // Al crear siempre queda true por defecto; al editar permite activar/inactivar.
    private Boolean activo;
}
