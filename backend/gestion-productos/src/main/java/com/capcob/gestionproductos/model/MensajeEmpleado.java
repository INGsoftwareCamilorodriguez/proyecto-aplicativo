package com.capcob.gestionproductos.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

// Mensaje que un Administrador le envía a un empleado desde la pantalla "Anuncios".
// fechaEntrega = null significa que el empleado todavía no lo ha recibido en pantalla.
@Entity
@Table(name = "mensajes_empleado")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MensajeEmpleado {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "destinatario_id", nullable = false)
    private Integer destinatarioId;

    @Column(name = "remitente_id", nullable = false)
    private Integer remitenteId;

    @Column(nullable = false, length = 500)
    private String texto;

    // Todas las horas se guardan en UTC, igual que la lógica de sesión.
    @Column(name = "fecha_envio", nullable = false)
    private LocalDateTime fechaEnvio;

    @Column(name = "fecha_entrega")
    private LocalDateTime fechaEntrega;
}
