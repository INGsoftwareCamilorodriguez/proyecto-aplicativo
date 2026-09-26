package com.capcob.gestionproductos.herramientas;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

// Utilidad manual: solo sirve para generar un hash BCrypt para insertarlo
// a mano en la base de datos (por ejemplo al sembrar los usuarios del rol
// DESARROLLADOR, ver script SQL de la migración).
// No tiene ninguna relación con el resto de la app ni la ejecuta Spring:
// se corre aparte, cambiando "passwordPlano" y ejecutando el main(), o
// pasando la contraseña como argumento: mvn compile exec:java
// -Dexec.mainClass=com.capcob.gestionproductos.herramientas.GenerarContrasena
// -Dexec.args="miContrasenaAqui"
public class GenerarContrasena {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        // Si se pasa un argumento por línea de comandos se usa ese; si no,
        // se usa el valor de abajo (cámbialo por la contraseña que quieras).
        String passwordPlano = args.length > 0 ? args[0] : "elingeniero";
        String hash = encoder.encode(passwordPlano);
        System.out.println("Contraseña: " + passwordPlano);
        System.out.println("Hash generado: " + hash);
    }
}


