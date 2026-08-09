package com.capcob.gestionproductos.service;

import com.capcob.gestionproductos.dto.ProductoRequest;
import com.capcob.gestionproductos.dto.ProductoResponse;
import com.capcob.gestionproductos.model.Paquete;
import com.capcob.gestionproductos.model.Producto;
import com.capcob.gestionproductos.repository.ProductoRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ProductoService {

    private final ProductoRepository productoRepository;
    private final PaqueteService paqueteService;
    private final BarcodeService barcodeService;

    public ProductoService(ProductoRepository productoRepository, PaqueteService paqueteService, BarcodeService barcodeService) {
        this.productoRepository = productoRepository;
        this.paqueteService = paqueteService;
        this.barcodeService = barcodeService;
    }

    public List<ProductoResponse> listarTodos() {
        return productoRepository.findByActivoTrue().stream().map(this::toResponse).toList();
    }

    public List<ProductoResponse> listarPorPaquete(Integer paqueteId) {
        return productoRepository.findByPaqueteIdAndActivoTrue(paqueteId).stream()
                .map(this::toResponse).toList();
    }

    public ProductoResponse crear(ProductoRequest request) {
        Paquete paquete = paqueteService.obtenerActivo(request.getPaqueteId());

        Producto producto = new Producto();
        producto.setPaquete(paquete);
        producto.setNombre(request.getNombre());
        producto.setTipoPrecio(request.getTipoPrecio());
        producto.setPrecio(request.getPrecio());
        producto.setCantidad(request.getCantidad());
        producto.setCodigoBarras(barcodeService.generarCodigo(request.getTipoPrecio()));
        producto.setActivo(true);

        return toResponse(productoRepository.save(producto));
    }

    public ProductoResponse actualizar(Integer id, ProductoRequest request) {
        Producto producto = obtenerActivo(id);

        // Si cambia de paquete, se valida que el nuevo paquete exista
        if (!producto.getPaquete().getId().equals(request.getPaqueteId())) {
            Paquete nuevoPaquete = paqueteService.obtenerActivo(request.getPaqueteId());
            producto.setPaquete(nuevoPaquete);
        }

        producto.setNombre(request.getNombre());
        producto.setPrecio(request.getPrecio());
        producto.setCantidad(request.getCantidad());

        // El código de barras solo se regenera si cambió el tipo de precio
        // (un producto FIJO no puede quedarse con un código de PESO y viceversa)
        if (producto.getTipoPrecio() != request.getTipoPrecio()) {
            producto.setTipoPrecio(request.getTipoPrecio());
            producto.setCodigoBarras(barcodeService.generarCodigo(request.getTipoPrecio()));
        }

        return toResponse(productoRepository.save(producto));
    }

    public void eliminar(Integer id) {
        Producto producto = obtenerActivo(id);
        producto.setActivo(false);
        productoRepository.save(producto);
    }

    private Producto obtenerActivo(Integer id) {
        Producto producto = productoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado"));
        if (!producto.getActivo()) {
            throw new IllegalArgumentException("El producto no está activo");
        }
        return producto;
    }

    private ProductoResponse toResponse(Producto producto) {
        return new ProductoResponse(
                producto.getId(),
                producto.getPaquete().getId(),
                producto.getPaquete().getNombre(),
                producto.getNombre(),
                producto.getTipoPrecio(),
                producto.getPrecio(),
                producto.getCantidad(),
                producto.getCodigoBarras()
        );
    }
}