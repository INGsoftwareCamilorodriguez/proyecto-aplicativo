package com.capcob.gestionproductos.dto;

import com.capcob.gestionproductos.model.Producto;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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

    @DecimalMin(value = "0.0", inclusive = false, message = "El precio debe ser mayor a 0")
    private BigDecimal precio;

    @NotNull
    @DecimalMin(value = "0.0", message = "La cantidad no puede ser negativa")
    private BigDecimal cantidad;

    // Solo relevante cuando tipoPrecio = FIJO
    private Boolean ventaPorUnidad;
    private Boolean ventaPorPaquete;

    @DecimalMin(value = "0.0", inclusive = false, message = "El precio del paquete debe ser mayor a 0")
    private BigDecimal precioPaquete;

    private Integer unidadesPorPaquete;

    // Foto opcional como data URL; null o vacío = sin imagen
    private String imagen;

    // Opcional. Código de barras que YA trae el producto (el del fabricante, leído con
    // cámara o lector). Si viene, se usa este en lugar de generar uno nuevo.
    // Solo aplica a productos de precio FIJO.
    @Size(max = 20, message = "El código de barras no puede pasar de 20 caracteres")
    private String codigoBarras;
}