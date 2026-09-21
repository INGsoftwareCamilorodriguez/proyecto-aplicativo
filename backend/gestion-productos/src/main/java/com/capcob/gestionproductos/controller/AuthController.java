package com.capcob.gestionproductos.controller;

import com.capcob.gestionproductos.dto.LoginRequest;
import com.capcob.gestionproductos.dto.LoginResponse;
import com.capcob.gestionproductos.dto.LogoutRequest;
import com.capcob.gestionproductos.model.Usuario;
import com.capcob.gestionproductos.repository.UsuarioRepository;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    // Tiempo sin "latido" (heartbeat) tras el cual una sesión se considera abandonada.
    // Solo importa cuando alguien intenta entrar desde OTRO navegador/dispositivo después
    // de una caída (luz, apagón del PC...): desde el MISMO navegador se entra al instante
    // (ver login). Debe ser mayor que el intervalo de latido del frontend
    // (session-heartbeat.js, HEARTBEAT_INTERVALO_MS = 20 s) para que una sesión viva
    // nunca expire por error.
    private static final int SESION_TIMEOUT_SEGUNDOS = 60;

    // Cuando la pestaña avisa que se está cerrando, la sesión queda liberada pasados
    // estos segundos. 0 = al instante (si era solo un cambio de pantalla, el latido
    // inmediato de la página nueva la renueva enseguida con el mismo token).
    private static final int GRACIA_CIERRE_SEGUNDOS = 0;

    // Formato válido del id de navegador (el frontend manda un UUID).
    private static final java.util.regex.Pattern DISPOSITIVO_VALIDO =
            java.util.regex.Pattern.compile("^[A-Za-z0-9-]{8,50}$");

    private static String dispositivoValido(String dispositivoId) {
        return (dispositivoId != null && DISPOSITIVO_VALIDO.matcher(dispositivoId).matches())
                ? dispositivoId : null;
    }

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

        // Solo se permite UNA sesión activa por usuario. Hay sesión vigente si hay token
        // guardado y todavía no venció (no ha dejado de llegar el latido).
        LocalDateTime ahora = LocalDateTime.now();
        boolean haySesionVigente = usuario.getSesionToken() != null
                && usuario.getSesionExpiraEn() != null
                && ahora.isBefore(usuario.getSesionExpiraEn());

        String dispositivoId = dispositivoValido(request.getDispositivoId());

        if (haySesionVigente) {
            // ¿La sesión activa la abrió ESTE mismo navegador? El token guarda el id del
            // navegador que la abrió: "<dispositivoId>.<uuid>".
            boolean mismoDispositivo = dispositivoId != null
                    && usuario.getSesionToken().startsWith(dispositivoId + ".");

            // Solo se deja pasar si es el mismo navegador Y el frontend confirmó que ya no
            // queda ninguna pestaña viva de esa sesión (cerraron de golpe, se fue la luz,
            // se apagó el PC...). Otro navegador o dispositivo sigue bloqueado.
            boolean puedeTomarla = mismoDispositivo && Boolean.TRUE.equals(request.getTomarSesion());

            if (!puedeTomarla) {
                log.info("[LOGIN RECHAZADO] usuario={} mismoDispositivo={} ahora={} sesionExpiraEn={}",
                        usuario.getUsuario(), mismoDispositivo, ahora, usuario.getSesionExpiraEn());

                Map<String, Object> cuerpo = new java.util.HashMap<>();
                cuerpo.put("mensaje", "Este usuario ya tiene una sesión activa en otro dispositivo o pestaña. Cierra esa sesión antes de continuar.");
                cuerpo.put("mismoDispositivo", mismoDispositivo);
                cuerpo.put("usuarioId", usuario.getId());
                return ResponseEntity.status(409).body(cuerpo);
            }

            log.info("[LOGIN] sesión abandonada tomada por el mismo navegador: usuario={}", usuario.getUsuario());
        }

        String token = (dispositivoId != null ? dispositivoId : "sin-dispositivo") + "." + UUID.randomUUID();
        usuario.setSesionToken(token);
        usuario.setSesionExpiraEn(ahora.plusSeconds(SESION_TIMEOUT_SEGUNDOS));
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

    // Llamado por el frontend cuando la pestaña se está cerrando o se está navegando
    // a otra página (evento "pagehide"). NO borra el token: solo acorta la vida de la
    // sesión a GRACIA_CIERRE_SEGUNDOS, así:
    //  - si la persona cerró la pestaña de golpe, puede volver a iniciar sesión pasados
    //    esos segundos;
    //  - si solo estaba cambiando de pantalla, el latido inmediato de la página nueva
    //    (mismo token) vuelve a renovar la sesión y no pasa nada.
    // Recibe id y token como parámetros de formulario (no JSON) a propósito: así el
    // navegador lo manda como petición "simple", sin la consulta previa (preflight) de
    // CORS, que es lo que más se pierde cuando la pestaña se cierra.
    @PostMapping("/cerrando")
    public ResponseEntity<?> cerrando(@RequestParam("id") Integer id,
                                      @RequestParam("token") String token) {
        Usuario usuario = usuarioRepository.findById(id).orElse(null);
        log.info("[CERRANDO] llegó el aviso de cierre: id={} tokenCoincide={}",
                id, usuario != null && token.equals(usuario.getSesionToken()));
        if (usuario != null && token.equals(usuario.getSesionToken())) {
            LocalDateTime nuevoVencimiento = LocalDateTime.now().plusSeconds(GRACIA_CIERRE_SEGUNDOS);
            // Solo se acorta, nunca se alarga.
            if (usuario.getSesionExpiraEn() == null || nuevoVencimiento.isBefore(usuario.getSesionExpiraEn())) {
                usuario.setSesionExpiraEn(nuevoVencimiento);
                usuarioRepository.save(usuario);
            }
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

        usuario.setSesionExpiraEn(LocalDateTime.now().plusSeconds(SESION_TIMEOUT_SEGUNDOS));
        usuarioRepository.save(usuario);

        return ResponseEntity.ok().build();
    }
}