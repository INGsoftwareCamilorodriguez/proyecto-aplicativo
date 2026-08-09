package com.capcob.gestionproductos.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PaqueteRequest {
    @NotBlank(message = "El nombre del paquete es obligatorio")
    private String nombre;
    private String descripcion;
}