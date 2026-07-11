package com.capcob.gestionproductos.controller;

import com.capcob.gestionproductos.dto.LoginRequest;
import com.capcob.gestionproductos.dto.LoginResponse;
import com.capcob.gestionproductos.model.Usuario;
import com.capcob.gestionproductos.repository.UsuarioRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthController(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        Usuario usuario = usuarioRepository.findByUsuario(request.getUsuario())
                .orElse(null);

        if (usuario == null || !usuario.getActivo()) {
            return ResponseEntity.status(401).body(Map.of("mensaje", "Usuario o contraseña incorrectos"));
        }

        if (!passwordEncoder.matches(request.getPassword(), usuario.getPasswordHash())) {
            return ResponseEntity.status(401).body(Map.of("mensaje", "Usuario o contraseña incorrectos"));
        }

        LoginResponse response = new LoginResponse(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getUsuario(),
                usuario.getRol().name()
        );

        return ResponseEntity.ok(response);
    }
}