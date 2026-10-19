package com.capcob.gestionproductos.service;

import com.capcob.gestionproductos.dto.ProductoRequest;
import com.capcob.gestionproductos.dto.ProductoResponse;
import com.capcob.gestionproductos.model.Paquete;
import com.capcob.gestionproductos.model.Producto;
import com.capcob.gestionproductos.repository.ProductoRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
public class ProductoService {

    // Código que ya trae el producto de fábrica (EAN-13, EAN-8, UPC-A/E, Code 128...).
    // La columna codigo_barras mide 20 caracteres.
    private static final Pattern CODIGO_PROPIO = Pattern.compile("^[0-9A-Za-z\\-._]{6,20}$");

    private final ProductoRepository productoRepository;
    private final PaqueteService paqueteService;
    private final BarcodeService barcodeService;
    private final HistorialService historialService;
    private final ContextoUsuario contexto;

    public ProductoService(ProductoRepository productoRepository, PaqueteService paqueteService,
                           BarcodeService barcodeService, HistorialService historialService,
                           ContextoUsuario contexto) {
        this.productoRepository = productoRepository;
        this.paqueteService = paqueteService;
        this.barcodeService = barcodeService;
        this.historialService = historialService;
        this.contexto = contexto;
    }

    public List<ProductoResponse> listarTodos() {
        return productoRepository.findByActivoTrue(contexto.duenoId()).stream().map(this::toResponse).toList();
    }

    public List<ProductoResponse> listarPorPaquete(Integer paqueteId) {
        return productoRepository.findByPaqueteIdAndActivoTrue(paqueteId, contexto.duenoId()).stream()
                .map(this::toResponse).toList();
    }

    public ProductoResponse crear(ProductoRequest request) {
        Paquete paquete = paqueteService.obtenerActivo(request.getPaqueteId());
        validarModalidadVenta(request);

        // Si el producto ya trae código de barras (escaneado), se usa ese; si no, se genera uno.
        String codigoPropio = normalizarCodigoPropio(request);

        Producto producto = new Producto();
        if (codigoPropio != null) {
            Optional<Producto> existente =
                    productoRepository.findByCodigoBarrasAndAdminId(codigoPropio, contexto.duenoId());
            if (existente.isPresent()) {
                if (existente.get().getActivo()) {
                    throw new IllegalArgumentException(
                            "Ese código de barras ya está registrado en \"" + existente.get().getNombre() + "\"");
                }
                // Estaba eliminado (borrado lógico): se reactiva esa misma fila para no chocar con el índice único.
                producto = existente.get();
            }
        }

        producto.setPaquete(paquete);
        producto.setNombre(request.getNombre());
        producto.setTipoPrecio(request.getTipoPrecio());
        aplicarModalidadVenta(producto, request);
        producto.setCantidad(request.getCantidad());
        producto.setCodigoBarras(codigoPropio != null
                ? codigoPropio
                : barcodeService.generarCodigo(request.getTipoPrecio()));
        producto.setImagen(normalizarImagen(request.getImagen()));
        producto.setActivo(true);
        producto.setAdminId(contexto.duenoId());

        Producto guardado;
        try {
            guardado = productoRepository.save(producto);
        } catch (DataIntegrityViolationException e) {
            if (codigoPropio != null) {
                // Pasa si la base de datos aún tiene el índice único global sobre codigo_barras.
                throw new IllegalArgumentException("Ese código de barras ya está en uso en el sistema");
            }
            throw e;
        }

        ProductoResponse response = toResponse(guardado);
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

        // Si viene un código escaneado, reemplaza al actual (validando que no sea de otro producto).
        String codigoPropio = normalizarCodigoPropio(request);
        if (codigoPropio != null) {
            if (!codigoPropio.equals(producto.getCodigoBarras())) {
                Optional<Producto> otro = productoRepository
                        .findByCodigoBarrasAndAdminId(codigoPropio, contexto.duenoId())
                        .filter(p -> !p.getId().equals(producto.getId()));
                if (otro.isPresent()) {
                    throw new IllegalArgumentException(otro.get().getActivo()
                            ? "Ese código de barras ya está registrado en \"" + otro.get().getNombre() + "\""
                            : "Ese código de barras pertenece a un producto eliminado");
                }
            }
            producto.setTipoPrecio(request.getTipoPrecio());
            producto.setCodigoBarras(codigoPropio);
        } else if (producto.getTipoPrecio() != request.getTipoPrecio()) {
            // Sin código escaneado: el código solo se regenera si cambió el tipo de precio
            // (un producto FIJO no puede quedarse con un código de PESO y viceversa)
            producto.setTipoPrecio(request.getTipoPrecio());
            producto.setCodigoBarras(barcodeService.generarCodigo(request.getTipoPrecio()));
        }

        Producto guardado;
        try {
            guardado = productoRepository.save(producto);
        } catch (DataIntegrityViolationException e) {
            if (codigoPropio != null) {
                throw new IllegalArgumentException("Ese código de barras ya está en uso en el sistema");
            }
            throw e;
        }
        ProductoResponse response = toResponse(guardado);
        historialService.registrarProducto("EDITADO", response);
        return response;
    }

    // Devuelve el código escaneado/tecleado ya limpio, o null si el producto no trae uno
    // (en ese caso el sistema genera el código). Solo se permite en productos de precio FIJO.
    private String normalizarCodigoPropio(ProductoRequest request) {
        String codigo = request.getCodigoBarras();
        if (codigo == null || codigo.isBlank()) {
            return null;
        }
        if (request.getTipoPrecio() == Producto.TipoPrecio.PESO) {
            throw new IllegalArgumentException("Los productos por peso usan un código propio del sistema; escanear solo aplica a productos de precio fijo");
        }
        codigo = codigo.trim();
        if (!CODIGO_PROPIO.matcher(codigo).matches() || codigo.chars().noneMatch(Character::isDigit)) {
            throw new IllegalArgumentException("El código de barras no es válido (6 a 20 caracteres: números, letras o guiones)");
        }
        return codigo;
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
        Producto producto = buscarConVariantes(codigoBarras)
                .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado"));
        if (!producto.getActivo()) {
            throw new IllegalArgumentException("El producto no está activo");
        }
        return toResponse(producto);
    }

    // Un mismo UPC-A puede llegar de 12 dígitos o de 13 con un 0 delante (según el lector o la cámara).
    // Si no se encuentra tal cual, se prueba con la otra forma.
    private Optional<Producto> buscarConVariantes(String codigo) {
        Integer dueno = contexto.duenoId();
        Optional<Producto> directo = productoRepository.findByCodigoBarrasAndAdminId(codigo, dueno);
        if (directo.isPresent() || !codigo.chars().allMatch(Character::isDigit)) {
            return directo;
        }
        if (codigo.length() == 13 && codigo.startsWith("0")) {
            return productoRepository.findByCodigoBarrasAndAdminId(codigo.substring(1), dueno);
        }
        if (codigo.length() == 12) {
            return productoRepository.findByCodigoBarrasAndAdminId("0" + codigo, dueno);
        }
        return Optional.empty();
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
        if (!contexto.duenoId().equals(producto.getAdminId())) {
            throw new IllegalArgumentException("Producto no encontrado");
        }
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