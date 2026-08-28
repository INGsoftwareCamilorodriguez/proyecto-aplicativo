package com.capcob.gestionproductos.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

// Tabla de UNA sola fila (id = 1). Guarda el tema, el logo y el
// nombre de la empresa que se aplican de forma uniforme a TODO
// el panel — no es una configuración por usuario.
@Entity
@Table(name = "configuracion_sistema")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConfiguracionSistema {

    @Id
    private Integer id;

    // "claro" o "oscuro"
    @Column(nullable = false, length = 10)
    private String tema = "claro";

    @Column(name = "nombre_empresa", nullable = false, length = 100)
    private String nombreEmpresa = "CAPCOB";

    // Imagen del logo en base64 (data:image/...;base64,....). Puede ser null.
    @Lob
    @Column(name = "logo_url", columnDefinition = "LONGTEXT")
    private String logoUrl;

    @Column(name = "fecha_actualizacion")
    private LocalDateTime fechaActualizacion;
}
