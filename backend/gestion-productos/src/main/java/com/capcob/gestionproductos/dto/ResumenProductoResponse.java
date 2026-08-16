package com.capcob.gestionproductos.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResumenProductoResponse {
    private Integer productoId;
    private String nombreProducto;
    private BigDecimal cantidadVendida;
    private BigDecimal totalVendido;
    // % que representa este producto sobre el total vendido en el rango consultado
    private BigDecimal porcentajeDelTotal;
}