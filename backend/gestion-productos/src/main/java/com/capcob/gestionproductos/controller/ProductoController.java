package com.capcob.gestionproductos.controller;

import com.capcob.gestionproductos.dto.ProductoRequest;
import com.capcob.gestionproductos.service.ProductoService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/productos")
public class ProductoController {

    private final ProductoService productoService;

    public ProductoController(ProductoService productoService) {
        this.productoService = productoService;
    }

    @GetMapping
    public ResponseEntity<?> listar(@RequestParam(required = false) Integer paqueteId) {
        if (paqueteId != null) {
            return ResponseEntity.ok(productoService.listarPorPaquete(paqueteId));
        }
        return ResponseEntity.ok(productoService.listarTodos());
    }

    // Usado por la pantalla de caja (escanear-codigo-barras) para buscar
    // el producto justo al escanear el código, con precio y stock actuales.
    @GetMapping("/codigo/{codigoBarras}")
    public ResponseEntity<?> buscarPorCodigo(@PathVariable String codigoBarras) {
        try {
            return ResponseEntity.ok(productoService.buscarPorCodigoBarras(codigoBarras));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("mensaje", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> crear(@Valid @RequestBody ProductoRequest request) {
        try {
            return ResponseEntity.ok(productoService.crear(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable Integer id, @Valid @RequestBody ProductoRequest request) {
        try {
            return ResponseEntity.ok(productoService.actualizar(id, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Integer id) {
        try {
            productoService.eliminar(id);
            return ResponseEntity.ok(Map.of("mensaje", "Producto eliminado"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
        }
    }
}