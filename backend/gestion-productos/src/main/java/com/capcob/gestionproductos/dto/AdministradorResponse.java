package com.capcob.gestionproductos.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdministradorResponse {
    private Integer id;
    private String nombre;
    private String usuario;
    private String telefono;
    private String empresaNombre;
    private String empresaIdentidad;
    private String empresaLogo;
    private Boolean activo;
}
