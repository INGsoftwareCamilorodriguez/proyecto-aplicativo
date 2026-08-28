package com.capcob.gestionproductos.dto;

import lombok.Data;

@Data
public class ConfiguracionRequest {

    // Todos los campos son opcionales: solo se actualiza lo que venga
    // distinto de null. Para quitar el logo, se manda logoUrl como "".
    private String tema;          // "claro" o "oscuro"
    private String nombreEmpresa; // nombre que se muestra en todo el panel
    private String logoUrl;       // logo en base64
}
