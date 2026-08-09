package com.capcob.gestionproductos.dto;

import com.capcob.gestionproductos.model.Producto;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProductoResponse {
    private Integer id;
    private Integer paqueteId;
    private String paqueteNombre;
    private String nombre;
    private Producto.TipoPrecio tipoPrecio;
    private BigDecimal precio;
    private BigDecimal cantidad;
    private String codigoBarras;
}