package com.capcob.gestionproductos.dto;

import lombok.Data;

@Data
public class LogoutRequest {
    private Integer id;
    private String token;

    // Solo lo manda el latido: segundos que lleva la persona sin interactuar. Opcional.
    private Integer segundosInactivo;
}
