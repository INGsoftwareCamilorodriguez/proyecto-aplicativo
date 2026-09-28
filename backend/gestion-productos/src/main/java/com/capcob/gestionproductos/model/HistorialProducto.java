package com.capcob.gestionproductos.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

// Bitácora de movimientos de la pantalla "Registrar producto".
// No lleva llaves foráneas a propósito: el registro debe conservarse
// aunque el producto o el paquete se eliminen después.
@Entity
@Table(name = "historial_producto")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HistorialProducto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    // CREADO, EDITADO, ELIMINADO, PAQUETE_CREADO, PAQUETE_ELIMINADO
    @Column(nullable = false, length = 30)
    private String accion;

    @Column(name = "producto_id")
    private Integer productoId;

    @Column(name = "paquete_id")
    private Integer paqueteId;

    @Column(name = "producto_nombre", nullable = false, length = 150)
    private String productoNombre;

    @Column(name = "paquete_nombre", length = 100)
    private String paqueteNombre;

    @Column(length = 255)
    private String detalle;

    @Column(length = 100)
    private String usuario;

    @Column(nullable = false)
    private LocalDateTime fecha;
}
