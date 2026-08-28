package com.capcob.gestionproductos.service;

import com.capcob.gestionproductos.dto.ConfiguracionRequest;
import com.capcob.gestionproductos.dto.ConfiguracionResponse;
import com.capcob.gestionproductos.model.ConfiguracionSistema;
import com.capcob.gestionproductos.repository.ConfiguracionRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

// La configuración del sistema es una SOLA fila (id = 1): el tema,
// el logo y el nombre de la empresa se aplican de forma uniforme a
// todo el panel, no por usuario.
@Service
public class ConfiguracionService {

    private static final Integer ID_UNICO = 1;
    private static final List<String> TEMAS_VALIDOS = List.of("claro", "oscuro");

    private final ConfiguracionRepository configuracionRepository;

    public ConfiguracionService(ConfiguracionRepository configuracionRepository) {
        this.configuracionRepository = configuracionRepository;
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
        return configuracionRepository.findById(ID_UNICO).orElseGet(() -> {
            ConfiguracionSistema nueva = new ConfiguracionSistema();
            nueva.setId(ID_UNICO);
            nueva.setTema("claro");
            nueva.setNombreEmpresa("CAPCOB");
            return configuracionRepository.save(nueva);
        });
    }

    private ConfiguracionResponse toResponse(ConfiguracionSistema config) {
        return new ConfiguracionResponse(config.getTema(), config.getNombreEmpresa(), config.getLogoUrl());
    }
}
