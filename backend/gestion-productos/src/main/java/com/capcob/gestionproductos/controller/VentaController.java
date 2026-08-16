package com.capcob.gestionproductos.controller;

import com.capcob.gestionproductos.dto.VentaRequest;
import com.capcob.gestionproductos.service.VentaService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.Year;
import java.util.Map;

@RestController
@RequestMapping("/api/ventas")
public class VentaController {

    private final VentaService ventaService;

    public VentaController(VentaService ventaService) {
        this.ventaService = ventaService;
    }

    // Registra una venta desde la pantalla de caja (escanear-codigo-barras).
    // Descuenta el stock de cada producto vendido.
    @PostMapping
    public ResponseEntity<?> registrar(@Valid @RequestBody VentaRequest request) {
        try {
            return ResponseEntity.ok(ventaService.registrar(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
        }
    }

    // Lista las ventas dentro de un rango de fechas.
    // Si no se envían fechas, trae "todas las ventas" (desde el año 2000 hasta ahora).
    @GetMapping
    public ResponseEntity<?> listar(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fin) {
        LocalDateTime desde = inicio != null ? inicio : LocalDateTime.of(2000, 1, 1, 0, 0);
        LocalDateTime hasta = fin != null ? fin : LocalDateTime.now();
        return ResponseEntity.ok(ventaService.listar(desde, hasta));
    }

    // Total vendido mes a mes de un año (para la tabla "Registro de ventas Anuales")
    @GetMapping("/resumen-mensual")
    public ResponseEntity<?> resumenMensual(@RequestParam(required = false) Integer anio) {
        int anioConsulta = anio != null ? anio : Year.now().getValue();
        return ResponseEntity.ok(ventaService.resumenMensual(anioConsulta));
    }

    // Cantidad y monto vendido por producto en un rango (para tarjetas y gráfica de pastel)
    @GetMapping("/resumen-productos")
    public ResponseEntity<?> resumenProductos(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fin) {
        LocalDateTime desde = inicio != null ? inicio : LocalDateTime.of(2000, 1, 1, 0, 0);
        LocalDateTime hasta = fin != null ? fin : LocalDateTime.now();
        return ResponseEntity.ok(ventaService.resumenPorProducto(desde, hasta));
    }
}