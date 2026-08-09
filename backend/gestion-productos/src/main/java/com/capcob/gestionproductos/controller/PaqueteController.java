package com.capcob.gestionproductos.controller;

import com.capcob.gestionproductos.dto.PaqueteRequest;
import com.capcob.gestionproductos.service.PaqueteService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/paquetes")
public class PaqueteController {

    private final PaqueteService paqueteService;

    public PaqueteController(PaqueteService paqueteService) {
        this.paqueteService = paqueteService;
    }

    @GetMapping
    public ResponseEntity<?> listar() {
        return ResponseEntity.ok(paqueteService.listar());
    }

    @PostMapping
    public ResponseEntity<?> crear(@Valid @RequestBody PaqueteRequest request) {
        try {
            return ResponseEntity.ok(paqueteService.crear(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable Integer id, @Valid @RequestBody PaqueteRequest request) {
        try {
            return ResponseEntity.ok(paqueteService.actualizar(id, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Integer id) {
        try {
            paqueteService.eliminar(id);
            return ResponseEntity.ok(Map.of("mensaje", "Paquete eliminado junto con sus productos"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
        }
    }
}