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
    private final HistorialService historialService;

    public ProductoService(ProductoRepository productoRepository, PaqueteService paqueteService,
                           BarcodeService barcodeService, HistorialService historialService) {
        this.productoRepository = productoRepository;
        this.paqueteService = paqueteService;
        this.barcodeService = barcodeService;
        this.historialService = historialService;
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
        validarModalidadVenta(request);

        Producto producto = new Producto();
        producto.setPaquete(paquete);
        producto.setNombre(request.getNombre());
        producto.setTipoPrecio(request.getTipoPrecio());
        aplicarModalidadVenta(producto, request);
        producto.setCantidad(request.getCantidad());
        producto.setCodigoBarras(barcodeService.generarCodigo(request.getTipoPrecio()));
        producto.setImagen(normalizarImagen(request.getImagen()));
        producto.setActivo(true);

        ProductoResponse response = toResponse(productoRepository.save(producto));
        historialService.registrarProducto("CREADO", response);
        return response;
    }

    public ProductoResponse actualizar(Integer id, ProductoRequest request) {
        Producto producto = obtenerActivo(id);
        validarModalidadVenta(request);

        // Si cambia de paquete, se valida que el nuevo paquete exista
        if (!producto.getPaquete().getId().equals(request.getPaqueteId())) {
            Paquete nuevoPaquete = paqueteService.obtenerActivo(request.getPaqueteId());
            producto.setPaquete(nuevoPaquete);
        }

        producto.setNombre(request.getNombre());
        aplicarModalidadVenta(producto, request);
        producto.setCantidad(request.getCantidad());
        producto.setImagen(normalizarImagen(request.getImagen()));

        // El código de barras solo se regenera si cambió el tipo de precio
        // (un producto FIJO no puede quedarse con un código de PESO y viceversa)
        if (producto.getTipoPrecio() != request.getTipoPrecio()) {
            producto.setTipoPrecio(request.getTipoPrecio());
            producto.setCodigoBarras(barcodeService.generarCodigo(request.getTipoPrecio()));
        }

        ProductoResponse response = toResponse(productoRepository.save(producto));
        historialService.registrarProducto("EDITADO", response);
        return response;
    }

    // La imagen es opcional. Si viene, debe ser una imagen en formato data URL y no pasar de ~1.5 MB.
    private String normalizarImagen(String imagen) {
        if (imagen == null || imagen.isBlank()) {
            return null;
        }
        if (!imagen.startsWith("data:image/")) {
            throw new IllegalArgumentException("La imagen no tiene un formato válido");
        }
        if (imagen.length() > 2_000_000) {
            throw new IllegalArgumentException("La imagen es demasiado pesada");
        }
        return imagen;
    }

    // Valida que la combinación de modalidad de venta tenga sentido antes de guardar.
    private void validarModalidadVenta(ProductoRequest request) {
        if (request.getTipoPrecio() == Producto.TipoPrecio.PESO) {
            if (request.getPrecio() == null) {
                throw new IllegalArgumentException("Debe indicar el precio por kilo");
            }
            return;
        }

        boolean porUnidad = Boolean.TRUE.equals(request.getVentaPorUnidad());
        boolean porPaquete = Boolean.TRUE.equals(request.getVentaPorPaquete());

        if (!porUnidad && !porPaquete) {
            throw new IllegalArgumentException("Selecciona si el producto se vende por unidad, por paquete, o ambas");
        }
        if (porUnidad && request.getPrecio() == null) {
            throw new IllegalArgumentException("Debe indicar el precio por unidad");
        }
        if (porPaquete && (request.getPrecioPaquete() == null || request.getUnidadesPorPaquete() == null)) {
            throw new IllegalArgumentException("Debe indicar el precio del paquete y cuántas unidades trae");
        }
        if (porPaquete && request.getUnidadesPorPaquete() != null && request.getUnidadesPorPaquete() <= 0) {
            throw new IllegalArgumentException("Las unidades por paquete deben ser mayores a 0");
        }
    }

    // Copia al producto los campos de precio/modalidad según el tipoPrecio elegido.
    private void aplicarModalidadVenta(Producto producto, ProductoRequest request) {
        if (request.getTipoPrecio() == Producto.TipoPrecio.PESO) {
            producto.setPrecio(request.getPrecio());
            producto.setVentaPorUnidad(false);
            producto.setVentaPorPaquete(false);
            producto.setPrecioPaquete(null);
            producto.setUnidadesPorPaquete(null);
            return;
        }

        boolean porUnidad = Boolean.TRUE.equals(request.getVentaPorUnidad());
        boolean porPaquete = Boolean.TRUE.equals(request.getVentaPorPaquete());

        producto.setVentaPorUnidad(porUnidad);
        producto.setPrecio(porUnidad ? request.getPrecio() : null);

        producto.setVentaPorPaquete(porPaquete);
        producto.setPrecioPaquete(porPaquete ? request.getPrecioPaquete() : null);
        producto.setUnidadesPorPaquete(porPaquete ? request.getUnidadesPorPaquete() : null);
    }

    // Usado por la caja: busca un producto activo por su código de barras
    // escaneado (lector físico, cámara o tecleado manual).
    public ProductoResponse buscarPorCodigoBarras(String codigoBarras) {
        Producto producto = productoRepository.findByCodigoBarras(codigoBarras)
                .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado"));
        if (!producto.getActivo()) {
            throw new IllegalArgumentException("El producto no está activo");
        }
        return toResponse(producto);
    }

    public void eliminar(Integer id) {
        Producto producto = obtenerActivo(id);
        producto.setActivo(false);
        productoRepository.save(producto);
        historialService.registrarProducto("ELIMINADO", toResponse(producto));
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
                producto.getVentaPorUnidad(),
                producto.getVentaPorPaquete(),
                producto.getPrecioPaquete(),
                producto.getUnidadesPorPaquete(),
                producto.getCodigoBarras(),
                producto.getImagen()
        );
    }
}