package com.capcob.gestionproductos.controller;

import com.capcob.gestionproductos.dto.LogoutRequest;
import com.capcob.gestionproductos.model.MensajeEmpleado;
import com.capcob.gestionproductos.model.Usuario;
import com.capcob.gestionproductos.repository.MensajeEmpleadoRepository;
import com.capcob.gestionproductos.repository.UsuarioRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

// Pantalla "Anuncios" del Administrador:
//  - /conectados : empleados con sesión abierta ahora mismo + cuánto llevan sin interactuar.
//  - /enviar     : el Administrador le manda un mensaje a un empleado conectado.
//  - /pendientes : el empleado (su caja) pregunta si tiene mensajes nuevos.
//
// Todas son POST y reciben id + token de la sesión en el cuerpo (igual que el latido),
// así el token no queda en la URL ni en el historial del navegador.
@RestController
@RequestMapping("/api/anuncios")
public class AnunciosController {

    private static final int MAX_TEXTO = 500;

    private final UsuarioRepository usuarioRepository;
    private final MensajeEmpleadoRepository mensajeRepository;

    public AnunciosController(UsuarioRepository usuarioRepository,
                              MensajeEmpleadoRepository mensajeRepository) {
        this.usuarioRepository = usuarioRepository;
        this.mensajeRepository = mensajeRepository;
    }

    // Misma hora de referencia (UTC) que AuthController.
    private static LocalDateTime ahoraUtc() {
        return LocalDateTime.now(ZoneOffset.UTC);
    }

    // Devuelve el Administrador dueño de esa sesión, o null si el id/token no son válidos,
    // la sesión ya venció o el usuario no es Administrador.
    private Usuario adminAutenticado(Integer id, String token) {
        if (id == null || token == null) return null;
        Usuario u = usuarioRepository.findById(id).orElse(null);
        if (u == null || u.getRol() != Usuario.Rol.ADMIN) return null;
        if (!token.equals(u.getSesionToken())) return null;
        if (u.getSesionExpiraEn() == null || !ahoraUtc().isBefore(u.getSesionExpiraEn())) return null;
        return u;
    }

    @PostMapping("/conectados")
    public ResponseEntity<?> conectados(@RequestBody LogoutRequest request) {
        if (adminAutenticado(request.getId(), request.getToken()) == null) {
            return ResponseEntity.status(401).body(Map.of("mensaje", "Sesión no válida."));
        }

        LocalDateTime ahora = ahoraUtc();
        List<Map<String, Object>> lista = usuarioRepository
                .findByRolAndSesionTokenIsNotNullAndSesionExpiraEnAfterOrderByNombreAsc(Usuario.Rol.EMPLEADO, ahora)
                .stream()
                .map(e -> {
                    // Segundos sin interactuar, calculados AQUÍ con la hora del servidor
                    // para no depender del reloj ni de la zona horaria de cada PC.
                    long segundos = e.getUltimaActividad() == null
                            ? 0
                            : Math.max(0, Duration.between(e.getUltimaActividad(), ahora).getSeconds());
                    return Map.<String, Object>of(
                            "id", e.getId(),
                            "nombre", e.getNombre(),
                            "segundosInactivo", segundos,
                            "mensajesSinEntregar", mensajeRepository.countByDestinatarioIdAndFechaEntregaIsNull(e.getId())
                    );
                })
                .toList();

        return ResponseEntity.ok(lista);
    }

    public record EnviarRequest(Integer id, String token, Integer destinatarioId, String texto) {}

    @PostMapping("/enviar")
    public ResponseEntity<?> enviar(@RequestBody EnviarRequest request) {
        Usuario admin = adminAutenticado(request.id(), request.token());
        if (admin == null) {
            return ResponseEntity.status(401).body(Map.of("mensaje", "Sesión no válida."));
        }

        String texto = request.texto() == null ? "" : request.texto().trim();
        if (texto.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", "Escribe un mensaje antes de enviar."));
        }
        if (texto.length() > MAX_TEXTO) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", "El mensaje no puede pasar de " + MAX_TEXTO + " caracteres."));
        }
        if (request.destinatarioId() == null) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", "Falta el empleado destinatario."));
        }

        LocalDateTime ahora = ahoraUtc();
        Usuario empleado = usuarioRepository.findById(request.destinatarioId()).orElse(null);
        boolean conectado = empleado != null
                && empleado.getRol() == Usuario.Rol.EMPLEADO
                && empleado.getSesionToken() != null
                && empleado.getSesionExpiraEn() != null
                && ahora.isBefore(empleado.getSesionExpiraEn());
        if (!conectado) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", "Ese empleado ya no está conectado."));
        }

        MensajeEmpleado mensaje = new MensajeEmpleado();
        mensaje.setDestinatarioId(empleado.getId());
        mensaje.setRemitenteId(admin.getId());
        mensaje.setTexto(texto);
        mensaje.setFechaEnvio(ahora);
        mensajeRepository.save(mensaje);

        return ResponseEntity.ok(Map.of("mensaje", "Mensaje enviado a " + empleado.getNombre()));
    }

    // La caja del empleado pregunta cada pocos segundos si tiene mensajes nuevos.
    // Al entregarlos los marca como recibidos, así no vuelven a salir.
    @PostMapping("/pendientes")
    public ResponseEntity<?> pendientes(@RequestBody LogoutRequest request) {
        Usuario usuario = request.getId() == null ? null : usuarioRepository.findById(request.getId()).orElse(null);
        boolean tokenValido = usuario != null
                && request.getToken() != null
                && request.getToken().equals(usuario.getSesionToken());
        if (!tokenValido) {
            return ResponseEntity.status(409).body(Map.of("mensaje", "Tu sesión ya no está activa."));
        }

        List<MensajeEmpleado> nuevos = mensajeRepository
                .findByDestinatarioIdAndFechaEntregaIsNullOrderByFechaEnvioAsc(usuario.getId());
        if (nuevos.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        LocalDateTime ahora = ahoraUtc();
        nuevos.forEach(m -> m.setFechaEntrega(ahora));
        mensajeRepository.saveAll(nuevos);

        List<Map<String, Object>> respuesta = nuevos.stream()
                .map(m -> Map.<String, Object>of(
                        "id", m.getId(),
                        "texto", m.getTexto(),
                        "remitente", usuarioRepository.findById(m.getRemitenteId())
                                .map(Usuario::getNombre).orElse("Administrador")))
                .toList();
        return ResponseEntity.ok(respuesta);
    }
}
