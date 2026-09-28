package com.capcob.gestionproductos.controller;

import com.capcob.gestionproductos.service.HistorialService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/historial-productos")
public class HistorialController {

    private final HistorialService historialService;

    public HistorialController(HistorialService historialService) {
        this.historialService = historialService;
    }

    // Últimos movimientos (registrar, editar, eliminar) de productos y paquetes.
    @GetMapping
    public ResponseEntity<?> listar() {
        return ResponseEntity.ok(historialService.listarRecientes());
    }
}
