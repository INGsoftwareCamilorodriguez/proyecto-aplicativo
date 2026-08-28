package com.capcob.gestionproductos.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PerfilResponse {
    private Integer id;
    private String nombre;
    private String usuario;
    private String rol;
    private String fotoPerfil;
}
