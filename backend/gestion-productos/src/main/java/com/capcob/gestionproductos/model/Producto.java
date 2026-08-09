package com.capcob.gestionproductos.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "producto")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Producto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "paquete_id", nullable = false)
    private Paquete paquete;

    @Column(nullable = false, length = 150)
    private String nombre;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_precio", nullable = false, length = 10)
    private TipoPrecio tipoPrecio;

    // Si tipoPrecio = FIJO -> precio de venta normal
    // Si tipoPrecio = PESO -> precio por kilogramo
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal precio;

    // Si tipoPrecio = FIJO -> unidades en stock
    // Si tipoPrecio = PESO -> kilogramos disponibles
    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal cantidad;

    @Column(name = "codigo_barras", nullable = false, unique = true, length = 20)
    private String codigoBarras;

    @Column(nullable = false)
    private Boolean activo = true;

    @Column(name = "fecha_creacion", updatable = false, insertable = false)
    private LocalDateTime fechaCreacion;

    public enum TipoPrecio {
        FIJO, PESO
    }
}