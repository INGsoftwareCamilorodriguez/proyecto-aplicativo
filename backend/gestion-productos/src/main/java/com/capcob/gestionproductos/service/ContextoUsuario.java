package com.capcob.gestionproductos.service;

import com.capcob.gestionproductos.model.Usuario;
import com.capcob.gestionproductos.repository.UsuarioRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

// Dice quién hace la petición actual (según los encabezados X-User-Id y X-Token)
// y de qué administrador son los datos que puede ver.
@Component
public class ContextoUsuario {

    private static final String ATRIBUTO = "capcob.usuarioActual";

    private final UsuarioRepository usuarioRepository;

    public ContextoUsuario(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    // Usuario con la sesión abierta en esta petición.
    public Usuario actual() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)) {
            throw noAutenticado();
        }
        HttpServletRequest request = attrs.getRequest();

        Object guardado = request.getAttribute(ATRIBUTO);
        if (guardado instanceof Usuario u) {
            return u;
        }

        String idHeader = request.getHeader("X-User-Id");
        String token = request.getHeader("X-Token");
        if (idHeader == null || idHeader.isBlank() || token == null || token.isBlank()) {
            throw noAutenticado();
        }

        Integer id;
        try {
            id = Integer.valueOf(idHeader.trim());
        } catch (NumberFormatException e) {
            throw noAutenticado();
        }

        Usuario usuario = usuarioRepository.findById(id).orElseThrow(this::noAutenticado);
        if (!token.equals(usuario.getSesionToken())
                || usuario.getSesionExpiraEn() == null
                || !LocalDateTime.now(ZoneOffset.UTC).isBefore(usuario.getSesionExpiraEn())) {
            throw noAutenticado();
        }

        request.setAttribute(ATRIBUTO, usuario);
        return usuario;
    }

    // Id del administrador dueño de los datos:
    // si eres ADMIN es tu propio id; si eres EMPLEADO, el de tu administrador.
    public Integer duenoId() {
        Usuario u = actual();
        if (u.getRol() == Usuario.Rol.ADMIN) {
            return u.getId();
        }
        if (u.getRol() == Usuario.Rol.EMPLEADO && u.getAdminId() != null) {
            return u.getAdminId();
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tu usuario no tiene un administrador asignado.");
    }

    private ResponseStatusException noAutenticado() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sesión no válida.");
    }
}