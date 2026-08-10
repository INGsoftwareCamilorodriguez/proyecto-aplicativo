package com.capcob.gestionproductos;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class GenerarContrasena {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String passwordPlano = "admin1234"; // <- cambia esto por la contraseña que quieras usar
        String hash = encoder.encode(passwordPlano);
        System.out.println("Hash generado: " + hash);
    }
}

// esta parte del codigo solo sirve para crear hash para la base de datos nada mas, no tiene inguna influencia en el resto de codigo 
