package com.capcob.gestionproductos.dto;

import lombok.Data;

@Data
public class ContactoRequest {
    private String nombre;
    private String correo;
    private String motivo;
    private String mensaje;
}