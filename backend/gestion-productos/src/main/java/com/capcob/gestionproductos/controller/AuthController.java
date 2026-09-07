package com.capcob.gestionproductos.controller;

import com.capcob.gestionproductos.dto.LoginRequest;
import com.capcob.gestionproductos.dto.LoginResponse;
import com.capcob.gestionproductos.dto.LogoutRequest;
import com.capcob.gestionproductos.model.Usuario;
import com.capcob.gestionproductos.repository.UsuarioRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    // Tiempo sin "latido" (heartbeat) tras el cual una sesión se considera abandonada.
    private static final int SESION_TIMEOUT_MINUTOS = 15;

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

        // Ya hay una sesión abierta en otro lado con este usuario: se rechaza el nuevo login,
        // a menos que esa sesión ya haya expirado (nadie mandó un "latido" a tiempo).
        LocalDateTime ahora = LocalDateTime.now();
        boolean haySesionVigente = usuario.getSesionToken() != null
                && usuario.getSesionExpiraEn() != null
                && ahora.isBefore(usuario.getSesionExpiraEn());

        if (haySesionVigente) {
            return ResponseEntity.status(409).body(Map.of(
                    "mensaje", "Este usuario ya tiene una sesión activa en otro dispositivo o pestaña. Cierra esa sesión antes de continuar."
            ));
        }

        String token = UUID.randomUUID().toString();
        usuario.setSesionToken(token);
        usuario.setSesionExpiraEn(ahora.plusMinutes(SESION_TIMEOUT_MINUTOS));
        usuarioRepository.save(usuario);

        LoginResponse response = new LoginResponse(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getUsuario(),
                usuario.getRol().name(),
                token
        );

        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestBody LogoutRequest request) {
        if (request.getId() == null) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", "Falta el id del usuario"));
        }

        Usuario usuario = usuarioRepository.findById(request.getId()).orElse(null);
        if (usuario == null) {
            return ResponseEntity.ok().build(); // ya no existe, nada que cerrar
        }

        // Solo libera la sesión si el token coincide (evita que una sesión vieja/caducada
        // cierre por error la sesión nueva de ese mismo usuario).
        if (request.getToken() == null || request.getToken().equals(usuario.getSesionToken())) {
            usuario.setSesionToken(null);
            usuario.setSesionExpiraEn(null);
            usuarioRepository.save(usuario);
        }

        return ResponseEntity.ok().build();
    }

    // Llamado periódicamente por el frontend mientras la pestaña sigue abierta,
    // para "renovar" la sesión y que no expire mientras se está usando de verdad.
    @PostMapping("/heartbeat")
    public ResponseEntity<?> heartbeat(@RequestBody LogoutRequest request) {
        if (request.getId() == null) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", "Falta el id del usuario"));
        }

        Usuario usuario = usuarioRepository.findById(request.getId()).orElse(null);

        boolean tokenValido = usuario != null
                && request.getToken() != null
                && request.getToken().equals(usuario.getSesionToken());

        if (!tokenValido) {
            // Esta sesión ya no es la vigente (expiró y otro usuario entró, o fue cerrada).
            return ResponseEntity.status(409).body(Map.of("mensaje", "Tu sesión ya no está activa."));
        }

        usuario.setSesionExpiraEn(LocalDateTime.now().plusMinutes(SESION_TIMEOUT_MINUTOS));
        usuarioRepository.save(usuario);

        return ResponseEntity.ok().build();
    }
}