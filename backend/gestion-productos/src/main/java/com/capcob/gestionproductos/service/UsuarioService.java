package com.capcob.gestionproductos.service;

import com.capcob.gestionproductos.dto.AdministradorRequest;
import com.capcob.gestionproductos.dto.AdministradorResponse;
import com.capcob.gestionproductos.dto.PerfilRequest;
import com.capcob.gestionproductos.dto.PerfilResponse;
import com.capcob.gestionproductos.dto.UsuarioRequest;
import com.capcob.gestionproductos.dto.UsuarioResponse;
import com.capcob.gestionproductos.model.Usuario;
import com.capcob.gestionproductos.repository.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

// Este servicio administra usuarios con rol EMPLEADO (gestion-usuario, uso
// del Administrador) y usuarios con rol ADMIN (gestion-administradores, uso
// exclusivo del Desarrollador). La gestión de un tercer rol/Auditor queda
// pendiente de definir con el equipo.
//
// Los métodos de "perfil" (obtenerPerfil/actualizarPerfil) son la
// excepción: son de autoservicio (cualquier usuario, sin importar el
// rol, edita SU PROPIO nombre y foto desde Configuración), por eso no
// pasan por obtenerEmpleado() ni están restringidos a EMPLEADO.
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

    // ── Administradores (uso exclusivo del Desarrollador) ─────────

    public List<AdministradorResponse> listarAdministradores() {
        return usuarioRepository.findByRolOrderByNombreAsc(Usuario.Rol.ADMIN)
                .stream().map(this::toAdministradorResponse).toList();
    }

    public AdministradorResponse crearAdministrador(AdministradorRequest request) {
        String usuarioLogin = normalizar(request.getUsuario());

        if (usuarioLogin.isBlank()) {
            throw new IllegalArgumentException("El correo (usuario) es obligatorio");
        }
        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new IllegalArgumentException("La contraseña es obligatoria");
        }
        if (request.getEmpresaNombre() == null || request.getEmpresaNombre().isBlank()) {
            throw new IllegalArgumentException("El nombre de la empresa es obligatorio");
        }
        if (usuarioRepository.findByUsuario(usuarioLogin).isPresent()) {
            throw new IllegalArgumentException("Ya existe un usuario con ese correo");
        }

        Usuario usuario = new Usuario();
        usuario.setNombre(request.getNombre());
        usuario.setUsuario(usuarioLogin);
        usuario.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        usuario.setRol(Usuario.Rol.ADMIN);
        usuario.setActivo(request.getActivo() == null ? true : request.getActivo());
        usuario.setTelefono(request.getTelefono());
        usuario.setEmpresaNombre(request.getEmpresaNombre().trim());
        usuario.setEmpresaIdentidad(request.getEmpresaIdentidad());
        if (request.getEmpresaLogo() != null && !request.getEmpresaLogo().isBlank()) {
            usuario.setEmpresaLogo(request.getEmpresaLogo());
        }

        return toAdministradorResponse(usuarioRepository.save(usuario));
    }

    public AdministradorResponse actualizarAdministrador(Integer id, AdministradorRequest request) {
        Usuario usuario = obtenerAdministrador(id);
        String usuarioLogin = normalizar(request.getUsuario());

        if (usuarioLogin.isBlank()) {
            throw new IllegalArgumentException("El correo (usuario) es obligatorio");
        }
        if (request.getEmpresaNombre() == null || request.getEmpresaNombre().isBlank()) {
            throw new IllegalArgumentException("El nombre de la empresa es obligatorio");
        }
        if (!usuarioLogin.equals(usuario.getUsuario())) {
            usuarioRepository.findByUsuario(usuarioLogin).ifPresent(existente -> {
                throw new IllegalArgumentException("Ya existe un usuario con ese correo");
            });
        }

        usuario.setNombre(request.getNombre());
        usuario.setUsuario(usuarioLogin);
        usuario.setTelefono(request.getTelefono());
        usuario.setEmpresaNombre(request.getEmpresaNombre().trim());
        usuario.setEmpresaIdentidad(request.getEmpresaIdentidad());
        if (request.getActivo() != null) {
            usuario.setActivo(request.getActivo());
        }
        // Cadena vacía = quitar el logo actual
        if (request.getEmpresaLogo() != null) {
            usuario.setEmpresaLogo(request.getEmpresaLogo().isBlank() ? null : request.getEmpresaLogo());
        }
        // La contraseña solo se cambia si mandan una nueva
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            usuario.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        }

        return toAdministradorResponse(usuarioRepository.save(usuario));
    }

    public void eliminarAdministrador(Integer id) {
        Usuario usuario = obtenerAdministrador(id);
        usuarioRepository.delete(usuario);
    }

    private Usuario obtenerAdministrador(Integer id) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        if (usuario.getRol() != Usuario.Rol.ADMIN) {
            throw new IllegalArgumentException("Este usuario no se puede administrar desde aquí");
        }
        return usuario;
    }

    private AdministradorResponse toAdministradorResponse(Usuario usuario) {
        return new AdministradorResponse(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getUsuario(),
                usuario.getTelefono(),
                usuario.getEmpresaNombre(),
                usuario.getEmpresaIdentidad(),
                usuario.getEmpresaLogo(),
                usuario.getActivo()
        );
    }

    // ── Perfil (autoservicio, cualquier rol) ──────────────────────

    public PerfilResponse obtenerPerfil(Integer id) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        return toPerfilResponse(usuario);
    }

    public PerfilResponse actualizarPerfil(Integer id, PerfilRequest request) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        if (request.getNombre() != null) {
            String nombre = request.getNombre().trim();
            if (nombre.isBlank()) {
                throw new IllegalArgumentException("El nombre no puede estar vacío");
            }
            usuario.setNombre(nombre);
        }

        // Cadena vacía = quitar la foto actual
        if (request.getFotoPerfil() != null) {
            usuario.setFotoPerfil(request.getFotoPerfil().isBlank() ? null : request.getFotoPerfil());
        }

        return toPerfilResponse(usuarioRepository.save(usuario));
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

    private PerfilResponse toPerfilResponse(Usuario usuario) {
        return new PerfilResponse(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getUsuario(),
                usuario.getRol().name(),
                usuario.getFotoPerfil()
        );
    }
}