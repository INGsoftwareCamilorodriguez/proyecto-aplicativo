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

    // Producto FIJO -> EAN-13 (prefijo "77" + 10 dígitos random + verificador), único.
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

    // Producto PESO -> PLU de 6 dígitos con prefijo "2", único.
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