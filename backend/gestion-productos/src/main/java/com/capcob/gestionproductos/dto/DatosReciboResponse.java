package com.capcob.gestionproductos.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// Datos que se imprimen en el recibo de la caja: quién atendió (empleado)
// y el negocio al que pertenece (su administrador).
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DatosReciboResponse {
    // Quien atiende la caja
    private String empleadoNombre;
    private String empleadoCorreo;
    private String empleadoIdentidad;
    private String empleadoTelefono;

    // Administrador dueño del negocio
    private String adminNombre;
    private String adminCorreo;
    private String empresaNombre;
    private String empresaIdentidad;   // NIT
    private String empresaTelefono;
}
