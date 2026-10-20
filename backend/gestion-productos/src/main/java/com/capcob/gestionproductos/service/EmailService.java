package com.capcob.gestionproductos.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String remitente;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void enviarTexto(String para, String asunto, String texto, String responderA)
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
}