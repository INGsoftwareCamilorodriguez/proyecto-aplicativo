package com.capcob.gestionproductos.controller;

import com.capcob.gestionproductos.dto.ContactoRequest;
import com.capcob.gestionproductos.service.EmailService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/contacto")
public class ContactoController {

    private static final Logger log = LoggerFactory.getLogger(ContactoController.class);

    private static final Pattern CORREO = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Set<String> MOTIVOS = Set.of(
            "Soporte con el escaneo", "Problema con mi cuenta",
            "Producto o inventario", "Sugerencia", "Otro");

    // Límite simple: máximo 5 mensajes por IP cada 10 minutos
    private static final int MAX_ENVIOS = 5;
    private static final long VENTANA_MS = 10 * 60 * 1000L;
    private final Map<String, Deque<Long>> envios = new ConcurrentHashMap<>();

    private final EmailService emailService;

    @Value("${app.contacto.destino}")
    private String destino;

    public ContactoController(EmailService emailService) {
        this.emailService = emailService;
    }

    @PostMapping
    public ResponseEntity<?> enviar(@RequestBody ContactoRequest req, HttpServletRequest http) {
        String nombre = limpiar(req.getNombre());
        String correo = limpiar(req.getCorreo());
        String motivo = limpiar(req.getMotivo());
        String mensaje = req.getMensaje() == null ? "" : req.getMensaje().trim();

        if (nombre.isEmpty() || correo.isEmpty() || motivo.isEmpty() || mensaje.isEmpty()) {
            return error(HttpStatus.BAD_REQUEST, "Por favor completa todos los campos.");
        }
        if (!CORREO.matcher(correo).matches()) {
            return error(HttpStatus.BAD_REQUEST, "Ingresa un correo electrónico válido.");
        }
        if (!MOTIVOS.contains(motivo)) {
            return error(HttpStatus.BAD_REQUEST, "Motivo de contacto no válido.");
        }
        if (nombre.length() > 100 || correo.length() > 150 || mensaje.length() > 2000) {
            return error(HttpStatus.BAD_REQUEST, "Alguno de los campos es demasiado largo.");
        }
        if (!permitido(http.getRemoteAddr())) {
            return error(HttpStatus.TOO_MANY_REQUESTS,
                    "Has enviado varios mensajes seguidos. Intenta de nuevo en unos minutos.");
        }

        String texto = "Nombre: " + nombre + "\n"
                + "Correo: " + correo + "\n"
                + "Motivo: " + motivo + "\n\n"
                + "Mensaje:\n" + mensaje;

        try {
            emailService.enviarTexto(destino, "[CAPCOB] " + motivo + " - " + nombre, texto, correo);
            return ResponseEntity.ok(Map.of("mensaje", "Mensaje enviado"));
        } catch (Exception e) {
            log.error("No se pudo enviar el correo de contacto", e);
            return error(HttpStatus.INTERNAL_SERVER_ERROR,
                    "No pudimos enviar tu mensaje. Intenta de nuevo en unos minutos.");
        }
    }

    private boolean permitido(String ip) {
        long ahora = System.currentTimeMillis();
        Deque<Long> intentos = envios.computeIfAbsent(ip, k -> new ArrayDeque<>());
        synchronized (intentos) {
            while (!intentos.isEmpty() && ahora - intentos.peekFirst() > VENTANA_MS) {
                intentos.pollFirst();
            }
            if (intentos.size() >= MAX_ENVIOS) return false;
            intentos.addLast(ahora);
            return true;
        }
    }

    // Quita saltos de línea para que nadie pueda inyectar cabeceras falsas en el correo
    private String limpiar(String s) {
        return s == null ? "" : s.replaceAll("[\\r\\n]+", " ").trim();
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String mensaje) {
        return ResponseEntity.status(status).body(Map.of("mensaje", mensaje));
    }
}