package com.capcob.gestionproductos.controller;

import com.capcob.gestionproductos.dto.PerfilRequest;
import com.capcob.gestionproductos.dto.UsuarioRequest;
import com.capcob.gestionproductos.service.UsuarioService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

    private final UsuarioService usuarioService;

    public UsuarioController(UsuarioService usuarioService) {
        this.usuarioService = usuarioService;
    }

    @GetMapping
    public ResponseEntity<?> listar() {
        return ResponseEntity.ok(usuarioService.listarEmpleados());
    }

    @PostMapping
    public ResponseEntity<?> crear(@Valid @RequestBody UsuarioRequest request) {
        try {
            return ResponseEntity.ok(usuarioService.crearEmpleado(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable Integer id, @Valid @RequestBody UsuarioRequest request) {
        try {
            return ResponseEntity.ok(usuarioService.actualizarEmpleado(id, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Integer id) {
        try {
            usuarioService.eliminarEmpleado(id);
            return ResponseEntity.ok(Map.of("mensaje", "Usuario eliminado"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
        }
    }

    // ── Perfil (autoservicio: el propio usuario logueado, cualquier rol) ──

    @GetMapping("/perfil/{id}")
    public ResponseEntity<?> obtenerPerfil(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(usuarioService.obtenerPerfil(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
        }
    }

    @PutMapping("/perfil/{id}")
    public ResponseEntity<?> actualizarPerfil(@PathVariable Integer id, @RequestBody PerfilRequest request) {
        try {
            return ResponseEntity.ok(usuarioService.actualizarPerfil(id, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
        }
    }
}
