package com.capcob.gestionproductos.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PaqueteResponse {
    private Integer id;
    private String nombre;
    private String descripcion;
    private long totalProductos;
}