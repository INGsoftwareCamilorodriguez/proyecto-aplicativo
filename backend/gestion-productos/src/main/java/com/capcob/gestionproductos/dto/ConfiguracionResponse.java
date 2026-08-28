package com.capcob.gestionproductos.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConfiguracionResponse {
    private String tema;
    private String nombreEmpresa;
    private String logoUrl;
}
