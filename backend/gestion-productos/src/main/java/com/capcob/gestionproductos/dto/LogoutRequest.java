package com.capcob.gestionproductos.dto;

import lombok.Data;

@Data
public class LogoutRequest {
    private Integer id;
    private String token;
}
