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

    // Si tipoPrecio = FIJO -> precio de venta por unidad (si ventaPorUnidad = true)
    // Si tipoPrecio = PESO -> precio por kilogramo
    @Column(precision = 12, scale = 2)
    private BigDecimal precio;

    // Si tipoPrecio = FIJO -> unidades en stock (siempre en unidades, sin importar si se vende por paquete)
    // Si tipoPrecio = PESO -> kilogramos disponibles
    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal cantidad;

    // Solo aplica cuando tipoPrecio = FIJO: indica si el producto se vende por unidad individual.
    @Column(name = "venta_por_unidad", nullable = false)
    private Boolean ventaPorUnidad = true;

    // Solo aplica cuando tipoPrecio = FIJO: indica si el producto también se vende por paquete completo.
    @Column(name = "venta_por_paquete", nullable = false)
    private Boolean ventaPorPaquete = false;

    // Precio del paquete completo cuando ventaPorPaquete = true.
    @Column(name = "precio_paquete", precision = 12, scale = 2)
    private BigDecimal precioPaquete;

    // Cuántas unidades trae cada paquete cuando ventaPorPaquete = true (para descontar el stock correctamente).
    @Column(name = "unidades_por_paquete")
    private Integer unidadesPorPaquete;

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