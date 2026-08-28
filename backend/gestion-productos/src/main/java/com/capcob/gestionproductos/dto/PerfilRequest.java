package com.capcob.gestionproductos.dto;

import lombok.Data;

@Data
public class PerfilRequest {

    // Opcionales: solo se actualiza lo que venga distinto de null.
    // Para quitar la foto, se manda fotoPerfil como "".
    private String nombre;
    private String fotoPerfil; // imagen en base64
}
