package com.capcob.gestionproductos.service;

import com.capcob.gestionproductos.model.Producto;
import com.capcob.gestionproductos.repository.ProductoRepository;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;

@Service
public class BarcodeService {

    private final ProductoRepository productoRepository;
    private static final SecureRandom RANDOM = new SecureRandom();

    public BarcodeService(ProductoRepository productoRepository) {
        this.productoRepository = productoRepository;
    }

    public String generarCodigo(Producto.TipoPrecio tipoPrecio) {
        return tipoPrecio == Producto.TipoPrecio.PESO
                ? generarCodigoPeso()
                : generarCodigoFijo();
    }

    /**
     * Producto FIJO -> código EAN-13 completo (13 dígitos), único.
     * Prefijo "77" (uso interno) + 10 dígitos random + dígito verificador.
     * Este código no cambia nunca: el empleado lo escanea y el backend
     * responde con el precio guardado en la BD.
     */
    private String generarCodigoFijo() {
        String codigo;
        do {
            StringBuilder base = new StringBuilder("77");
            for (int i = 0; i < 10; i++) {
                base.append(RANDOM.nextInt(10));
            }
            String doceDigitos = base.toString();
            int verificador = calcularDigitoVerificadorEAN13(doceDigitos);
            codigo = doceDigitos + verificador;
        } while (productoRepository.existsByCodigoBarras(codigo));
        return codigo;
    }

    /**
     * Producto PESO -> PLU corto (6 dígitos), único, prefijo "2" que
     * indica "venta por peso" (convención estándar de supermercados).
     * Este código NO lleva el precio: solo identifica el producto.
     * El precio real ($) se calcula en el punto de venta (precio_kg × peso)
     * cuando lleguemos al módulo de registro de venta.
     */
    private String generarCodigoPeso() {
        String codigo;
        do {
            StringBuilder base = new StringBuilder("2");
            for (int i = 0; i < 5; i++) {
                base.append(RANDOM.nextInt(10));
            }
            codigo = base.toString();
        } while (productoRepository.existsByCodigoBarras(codigo));
        return codigo;
    }

    private int calcularDigitoVerificadorEAN13(String doceDigitos) {
        int suma = 0;
        for (int i = 0; i < 12; i++) {
            int digito = Character.getNumericValue(doceDigitos.charAt(i));
            suma += (i % 2 == 0) ? digito : digito * 3;
        }
        int resto = suma % 10;
        return (resto == 0) ? 0 : 10 - resto;
    }
}