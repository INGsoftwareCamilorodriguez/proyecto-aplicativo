package com.capcob.gestionproductos.herramientas;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

// Utilidad manual: solo sirve para generar un hash BCrypt para insertarlo
// a mano en la base de datos (por ejemplo al sembrar un usuario admin).
// No tiene ninguna relación con el resto de la app ni la ejecuta Spring:
// se corre aparte, cambiando "passwordPlano" y ejecutando el main().
public class GenerarContrasena {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String passwordPlano = "admin1234"; // <- cambia esto por la contraseña que quieras usar
        String hash = encoder.encode(passwordPlano);
        System.out.println("Hash generado: " + hash);
    }
}

