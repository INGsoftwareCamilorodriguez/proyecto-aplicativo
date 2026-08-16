package com.capcob.gestionproductos.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.List;

@Data
public class VentaRequest {

    @NotNull(message = "El usuario (cajero) es obligatorio")
    private Integer usuarioId;

    @NotEmpty(message = "La venta debe tener al menos un producto")
    @Valid
    private List<VentaItemRequest> items;
}