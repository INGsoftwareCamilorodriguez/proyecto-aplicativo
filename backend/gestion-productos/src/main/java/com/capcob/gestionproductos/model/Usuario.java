package com.capcob.gestionproductos.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "usuarios")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 100)
    private String nombre;

    // Foto de perfil en base64 (data:image/...;base64,....). Puede ser null.
    @Lob
    @Column(name = "foto_perfil", columnDefinition = "LONGTEXT")
    private String fotoPerfil;

    @Column(nullable = false, unique = true, length = 50)
    private String usuario;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Rol rol;

    @Column(nullable = false)
    private Boolean activo = true;

    // Token de la sesión activa. Null = sin sesión abierta en ningún lado.
    // Mientras tenga un valor Y no haya expirado, un nuevo login para este usuario es rechazado.
    @Column(name = "sesion_token", length = 100)
    private String sesionToken;

    // Momento en que la sesión actual deja de considerarse activa si no llega
    // otro "latido" (heartbeat) antes. Así, si alguien cierra la pestaña sin
    // usar "Cerrar Sesión", el token queda libre solo cuando pasa este tiempo.
    @Column(name = "sesion_expira_en")
    private LocalDateTime sesionExpiraEn;

    @Column(name = "fecha_creacion", updatable = false, insertable = false)
    private LocalDateTime fechaCreacion;

    // ── Datos de la empresa cliente (solo aplican a usuarios con rol ADMIN,
    // capturados por el Desarrollador al crear la cuenta del administrador).
    // Quedan en null para EMPLEADO y DESARROLLADOR. ──
    @Column(name = "telefono", length = 30)
    private String telefono;

    @Column(name = "empresa_nombre", length = 150)
    private String empresaNombre;

    // Identificación / NIT de la empresa cliente.
    @Column(name = "empresa_identidad", length = 50)
    private String empresaIdentidad;

    // Logo de la empresa cliente en base64 (data:image/...;base64,....).
    @Lob
    @Column(name = "empresa_logo", columnDefinition = "LONGTEXT")
    private String empresaLogo;

    public enum Rol {
        ADMIN, EMPLEADO, DESARROLLADOR
    }
}