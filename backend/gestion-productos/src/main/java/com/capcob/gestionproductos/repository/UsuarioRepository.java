package com.capcob.gestionproductos.repository;

import com.capcob.gestionproductos.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Integer> {
    Optional<Usuario> findByUsuario(String usuario);
    List<Usuario> findByRolOrderByNombreAsc(Usuario.Rol rol);

    // Usuarios de un rol con sesión vigente (token guardado y aún sin vencer): los "conectados".
    List<Usuario> findByRolAndSesionTokenIsNotNullAndSesionExpiraEnAfterOrderByNombreAsc(
            Usuario.Rol rol, LocalDateTime ahora);

    // Empleados que pertenecen a un administrador concreto.
    List<Usuario> findByRolAndAdminIdOrderByNombreAsc(Usuario.Rol rol, Integer adminId);

    // Empleados de un administrador con sesión vigente: los "conectados" de ese admin.
    List<Usuario> findByRolAndAdminIdAndSesionTokenIsNotNullAndSesionExpiraEnAfterOrderByNombreAsc(
            Usuario.Rol rol, Integer adminId, LocalDateTime ahora);
}