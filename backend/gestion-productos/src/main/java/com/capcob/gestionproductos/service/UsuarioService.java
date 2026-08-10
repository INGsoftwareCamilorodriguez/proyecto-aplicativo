package com.capcob.gestionproductos.service;

import com.capcob.gestionproductos.dto.UsuarioRequest;
import com.capcob.gestionproductos.dto.UsuarioResponse;
import com.capcob.gestionproductos.model.Usuario;
import com.capcob.gestionproductos.repository.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

// Por ahora este servicio SOLO administra usuarios con rol EMPLEADO.
// La gestión de Administrador/Auditor queda pendiente de definir con
// el equipo, así que ni el listado ni la creación/edición tocan esos roles.
@Service
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public UsuarioService(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public List<UsuarioResponse> listarEmpleados() {
        return usuarioRepository.findByRolOrderByNombreAsc(Usuario.Rol.EMPLEADO)
                .stream().map(this::toResponse).toList();
    }

    public UsuarioResponse crearEmpleado(UsuarioRequest request) {
        String usuarioLogin = normalizar(request.getUsuario());

        if (usuarioLogin.isBlank()) {
            throw new IllegalArgumentException("El correo (usuario) es obligatorio");
        }
        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new IllegalArgumentException("La contraseña es obligatoria");
        }
        if (usuarioRepository.findByUsuario(usuarioLogin).isPresent()) {
            throw new IllegalArgumentException("Ya existe un usuario con ese correo");
        }

        Usuario usuario = new Usuario();
        usuario.setNombre(request.getNombre());
        usuario.setUsuario(usuarioLogin);
        usuario.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        usuario.setRol(Usuario.Rol.EMPLEADO);
        usuario.setActivo(request.getActivo() == null ? true : request.getActivo());

        return toResponse(usuarioRepository.save(usuario));
    }

    public UsuarioResponse actualizarEmpleado(Integer id, UsuarioRequest request) {
        Usuario usuario = obtenerEmpleado(id);
        String usuarioLogin = normalizar(request.getUsuario());

        if (usuarioLogin.isBlank()) {
            throw new IllegalArgumentException("El correo (usuario) es obligatorio");
        }
        if (!usuarioLogin.equals(usuario.getUsuario())) {
            usuarioRepository.findByUsuario(usuarioLogin).ifPresent(existente -> {
                throw new IllegalArgumentException("Ya existe un usuario con ese correo");
            });
        }

        usuario.setNombre(request.getNombre());
        usuario.setUsuario(usuarioLogin);
        if (request.getActivo() != null) {
            usuario.setActivo(request.getActivo());
        }
        // La contraseña solo se cambia si mandan una nueva
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            usuario.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        }

        return toResponse(usuarioRepository.save(usuario));
    }

    public void eliminarEmpleado(Integer id) {
        Usuario usuario = obtenerEmpleado(id);
        usuarioRepository.delete(usuario);
    }

    private Usuario obtenerEmpleado(Integer id) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        if (usuario.getRol() != Usuario.Rol.EMPLEADO) {
            throw new IllegalArgumentException("Este usuario no se puede administrar desde aquí");
        }
        return usuario;
    }

    private String normalizar(String usuario) {
        return usuario == null ? "" : usuario.trim().toLowerCase();
    }

    private UsuarioResponse toResponse(Usuario usuario) {
        return new UsuarioResponse(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getUsuario(),
                usuario.getRol().name(),
                usuario.getActivo()
        );
    }
}