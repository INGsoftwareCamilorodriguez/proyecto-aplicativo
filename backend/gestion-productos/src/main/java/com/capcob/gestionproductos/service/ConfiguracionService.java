package com.capcob.gestionproductos.service;

import com.capcob.gestionproductos.dto.ConfiguracionRequest;
import com.capcob.gestionproductos.dto.ConfiguracionResponse;
import com.capcob.gestionproductos.model.ConfiguracionSistema;
import com.capcob.gestionproductos.model.Usuario;
import com.capcob.gestionproductos.repository.ConfiguracionRepository;
import com.capcob.gestionproductos.repository.UsuarioRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

// Hay UNA fila de configuración por administrador: su id es el id del admin dueño.
// El tema, el logo y el nombre de la empresa se aplican a todo su panel
// (y a sus empleados), pero nunca se mezclan con los de otro administrador.
@Service
public class ConfiguracionService {

    private static final List<String> TEMAS_VALIDOS = List.of("claro", "oscuro");

    private final ConfiguracionRepository configuracionRepository;
    private final UsuarioRepository usuarioRepository;
    private final ContextoUsuario contexto;

    public ConfiguracionService(ConfiguracionRepository configuracionRepository,
                                UsuarioRepository usuarioRepository,
                                ContextoUsuario contexto) {
        this.configuracionRepository = configuracionRepository;
        this.usuarioRepository = usuarioRepository;
        this.contexto = contexto;
    }

    public ConfiguracionResponse obtener() {
        return toResponse(obtenerOCrear());
    }

    public ConfiguracionResponse actualizar(ConfiguracionRequest request) {
        ConfiguracionSistema config = obtenerOCrear();

        if (request.getTema() != null) {
            String tema = request.getTema().trim().toLowerCase();
            if (!TEMAS_VALIDOS.contains(tema)) {
                throw new IllegalArgumentException("El tema debe ser 'claro' u 'oscuro'");
            }
            config.setTema(tema);
        }

        if (request.getNombreEmpresa() != null) {
            String nombre = request.getNombreEmpresa().trim();
            if (nombre.isBlank()) {
                throw new IllegalArgumentException("El nombre no puede estar vacío");
            }
            config.setNombreEmpresa(nombre);
        }

        // Cadena vacía = quitar el logo actual
        if (request.getLogoUrl() != null) {
            config.setLogoUrl(request.getLogoUrl().isBlank() ? null : request.getLogoUrl());
        }

        config.setFechaActualizacion(LocalDateTime.now());
        return toResponse(configuracionRepository.save(config));
    }

    private ConfiguracionSistema obtenerOCrear() {
        Integer duenoId = contexto.duenoId();
        return configuracionRepository.findById(duenoId).orElseGet(() -> {
            Usuario dueno = usuarioRepository.findById(duenoId).orElseThrow();
            ConfiguracionSistema nueva = new ConfiguracionSistema();
            nueva.setId(duenoId);
            nueva.setTema("claro");
            nueva.setNombreEmpresa(dueno.getEmpresaNombre() != null ? dueno.getEmpresaNombre() : "CAPCOB");
            nueva.setLogoUrl(dueno.getEmpresaLogo());
            return configuracionRepository.save(nueva);
        });
    }

    private ConfiguracionResponse toResponse(ConfiguracionSistema config) {
        return new ConfiguracionResponse(config.getTema(), config.getNombreEmpresa(), config.getLogoUrl());
    }
}