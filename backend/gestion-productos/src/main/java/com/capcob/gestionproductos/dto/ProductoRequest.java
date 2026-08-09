package com.capcob.gestionproductos.dto;

import com.capcob.gestionproductos.model.Producto;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ProductoRequest {
    @NotNull(message = "Debe indicar el paquete")
    private Integer paqueteId;

    @NotBlank(message = "El nombre del producto es obligatorio")
    private String nombre;

    @NotNull(message = "Debe indicar el tipo de precio (FIJO o PESO)")
    private Producto.TipoPrecio tipoPrecio;

    @NotNull
    @DecimalMin(value = "0.0", inclusive = false, message = "El precio debe ser mayor a 0")
    private BigDecimal precio;

    @NotNull
    @DecimalMin(value = "0.0", message = "La cantidad no puede ser negativa")
    private BigDecimal cantidad;
}