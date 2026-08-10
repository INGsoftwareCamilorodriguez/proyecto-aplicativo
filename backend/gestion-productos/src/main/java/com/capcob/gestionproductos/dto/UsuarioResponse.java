package com.capcob.gestionproductos.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class UsuarioResponse {
    private Integer id;
    private String nombre;
    private String usuario;
    private String rol;
    private Boolean activo;
}