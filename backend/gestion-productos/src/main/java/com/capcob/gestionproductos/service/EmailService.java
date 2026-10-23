package com.capcob.gestionproductos.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

// Envía los correos del sistema.
//  - En Render (plan gratis) los puertos SMTP están bloqueados, así que si existe la
//    variable BREVO_API_KEY el correo se manda por la API de Brevo (HTTPS).
//  - En tu computador, donde no existe esa variable, sigue usando Gmail por SMTP como siempre.
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String BREVO_URL = "https://api.brevo.com/v3/smtp/email";

    private final JavaMailSender mailSender;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Value("${spring.mail.username}")
    private String remitente;

    // Vacía en tu PC (usa Gmail). Con valor en Render (usa Brevo).
    @Value("${brevo.api.key:}")
    private String brevoApiKey;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void enviarTexto(String para, String asunto, String texto, String responderA)
            throws MessagingException {
        if (brevoApiKey != null && !brevoApiKey.isBlank()) {
            enviarPorBrevo(para, asunto, texto, responderA);
        } else {
            enviarPorGmail(para, asunto, texto, responderA);
        }
    }

    private void enviarPorGmail(String para, String asunto, String texto, String responderA)
            throws MessagingException {
        MimeMessage mensaje = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(mensaje, "UTF-8");
        helper.setFrom(remitente);
        helper.setTo(para);
        helper.setSubject(asunto);
        helper.setText(texto, false);
        if (responderA != null && !responderA.isBlank()) {
            helper.setReplyTo(responderA);
        }
        mailSender.send(mensaje);
    }

    private void enviarPorBrevo(String para, String asunto, String texto, String responderA)
            throws MessagingException {
        StringBuilder json = new StringBuilder();
        json.append("{\"sender\":{\"name\":\"CAPCOB\",\"email\":").append(js(remitente)).append("},");
        json.append("\"to\":[{\"email\":").append(js(para)).append("}],");
        if (responderA != null && !responderA.isBlank()) {
            json.append("\"replyTo\":{\"email\":").append(js(responderA)).append("},");
        }
        json.append("\"subject\":").append(js(asunto)).append(",");
        json.append("\"textContent\":").append(js(texto)).append("}");

        HttpRequest peticion = HttpRequest.newBuilder(URI.create(BREVO_URL))
                .timeout(Duration.ofSeconds(15))
                .header("api-key", brevoApiKey.trim())
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.toString()))
                .build();

        try {
            HttpResponse<String> respuesta = http.send(peticion, HttpResponse.BodyHandlers.ofString());
            int codigo = respuesta.statusCode();
            if (codigo < 200 || codigo >= 300) {
                log.error("Brevo rechazó el correo. Código {} - {}", codigo, respuesta.body());
                throw new MessagingException("Brevo respondió con código " + codigo);
            }
        } catch (IOException e) {
            throw new MessagingException("No se pudo conectar con Brevo", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new MessagingException("Envío por Brevo interrumpido", e);
        }
    }

    // Convierte un texto en un valor JSON válido (con comillas y caracteres escapados).
    private static String js(String valor) {
        if (valor == null) {
            return "\"\"";
        }
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < valor.length(); i++) {
            char c = valor.charAt(i);
            switch (c) {
                case '"':  sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n");  break;
                case '\r': sb.append("\\r");  break;
                case '\t': sb.append("\\t");  break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        return sb.append('"').toString();
    }
}