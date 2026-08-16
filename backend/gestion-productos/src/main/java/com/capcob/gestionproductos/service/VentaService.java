package com.capcob.gestionproductos.service;

import com.capcob.gestionproductos.dto.*;
import com.capcob.gestionproductos.model.DetalleVenta;
import com.capcob.gestionproductos.model.Producto;
import com.capcob.gestionproductos.model.Usuario;
import com.capcob.gestionproductos.model.Venta;
import com.capcob.gestionproductos.repository.DetalleVentaRepository;
import com.capcob.gestionproductos.repository.ProductoRepository;
import com.capcob.gestionproductos.repository.UsuarioRepository;
import com.capcob.gestionproductos.repository.VentaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class VentaService {

    private static final BigDecimal IVA_PORCENTAJE = new BigDecimal("0.19");
    private static final String[] NOMBRES_MES = {
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    };

    private final VentaRepository ventaRepository;
    private final DetalleVentaRepository detalleVentaRepository;
    private final ProductoRepository productoRepository;
    private final UsuarioRepository usuarioRepository;

    public VentaService(VentaRepository ventaRepository,
                         DetalleVentaRepository detalleVentaRepository,
                         ProductoRepository productoRepository,
                         UsuarioRepository usuarioRepository) {
        this.ventaRepository = ventaRepository;
        this.detalleVentaRepository = detalleVentaRepository;
        this.productoRepository = productoRepository;
        this.usuarioRepository = usuarioRepository;
    }

    // Registra la venta completa: valida stock, descuenta inventario y
    // guarda la cabecera + el detalle en una sola transacción.
    @Transactional
    public VentaResponse registrar(VentaRequest request) {
        Usuario empleado = usuarioRepository.findById(request.getUsuarioId())
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        Venta venta = new Venta();
        venta.setEmpleado(empleado);
        venta.setFechaHora(LocalDateTime.now());

        List<DetalleVenta> detalles = new ArrayList<>();
        BigDecimal subtotalVenta = BigDecimal.ZERO;

        for (VentaItemRequest item : request.getItems()) {
            Producto producto = productoRepository.findById(item.getProductoId())
                    .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado: id " + item.getProductoId()));

            if (!producto.getActivo()) {
                throw new IllegalArgumentException("El producto \"" + producto.getNombre() + "\" no está activo");
            }
            if (producto.getCantidad().compareTo(item.getCantidad()) < 0) {
                throw new IllegalArgumentException(
                        "Stock insuficiente para \"" + producto.getNombre() + "\". Disponible: " + producto.getCantidad());
            }

            BigDecimal subtotalItem = producto.getPrecio()
                    .multiply(item.getCantidad())
                    .setScale(2, RoundingMode.HALF_UP);

            DetalleVenta detalle = new DetalleVenta();
            detalle.setVenta(venta);
            detalle.setProducto(producto);
            detalle.setCantidad(item.getCantidad());
            detalle.setPrecioUnitario(producto.getPrecio());
            detalle.setSubtotal(subtotalItem);
            detalles.add(detalle);

            subtotalVenta = subtotalVenta.add(subtotalItem);

            // descuenta el stock vendido
            producto.setCantidad(producto.getCantidad().subtract(item.getCantidad()));
            productoRepository.save(producto);
        }

        BigDecimal ivaVenta = subtotalVenta.multiply(IVA_PORCENTAJE).setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalVenta = subtotalVenta.add(ivaVenta);

        // la tabla "ventas" solo tiene columna "total" (ya con IVA incluido)
        venta.setTotal(totalVenta);
        venta.setDetalles(detalles);

        Venta guardada = ventaRepository.save(venta);
        return toResponse(guardada, subtotalVenta, ivaVenta);
    }

    @Transactional(readOnly = true)
    public List<VentaResponse> listar(LocalDateTime inicio, LocalDateTime fin) {
        return ventaRepository.findByFechaBetweenOrderByFechaDesc(inicio, fin).stream()
                .map(this::toResponseCalculado)
                .toList();
    }

    // Total vendido mes a mes de un año (usado por la tabla de Registro de ventas Anuales)
    public List<ResumenMensualResponse> resumenMensual(int anio) {
        LocalDateTime inicio = LocalDateTime.of(anio, 1, 1, 0, 0);
        LocalDateTime fin = LocalDateTime.of(anio, 12, 31, 23, 59, 59);

        BigDecimal[] totalesPorMes = new BigDecimal[12];
        Arrays.fill(totalesPorMes, BigDecimal.ZERO);

        ventaRepository.findByFechaBetweenOrderByFechaDesc(inicio, fin).forEach(v -> {
            int idx = v.getFechaHora().getMonthValue() - 1;
            totalesPorMes[idx] = totalesPorMes[idx].add(v.getTotal());
        });

        List<ResumenMensualResponse> resultado = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            resultado.add(new ResumenMensualResponse(i + 1, NOMBRES_MES[i], totalesPorMes[i]));
        }
        return resultado;
    }

    // Cantidad y monto vendido por producto en un rango de fechas
    // (usado por las tarjetas y la gráfica de pastel de "producto de ventas")
    public List<ResumenProductoResponse> resumenPorProducto(LocalDateTime inicio, LocalDateTime fin) {
        List<DetalleVenta> detalles = detalleVentaRepository.findDetallesEnRango(inicio, fin);

        Map<Integer, ResumenProductoResponse> acumulado = new LinkedHashMap<>();
        BigDecimal totalGeneral = BigDecimal.ZERO;

        for (DetalleVenta d : detalles) {
            totalGeneral = totalGeneral.add(d.getSubtotal());
            Integer productoId = d.getProducto().getId();
            ResumenProductoResponse r = acumulado.get(productoId);
            if (r == null) {
                r = new ResumenProductoResponse(productoId, d.getProducto().getNombre(),
                        BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
                acumulado.put(productoId, r);
            }
            r.setCantidadVendida(r.getCantidadVendida().add(d.getCantidad()));
            r.setTotalVendido(r.getTotalVendido().add(d.getSubtotal()));
        }

        BigDecimal totalFinal = totalGeneral;
        List<ResumenProductoResponse> resultado = new ArrayList<>(acumulado.values());
        resultado.forEach(r -> {
            if (totalFinal.compareTo(BigDecimal.ZERO) > 0) {
                r.setPorcentajeDelTotal(r.getTotalVendido()
                        .multiply(BigDecimal.valueOf(100))
                        .divide(totalFinal, 1, RoundingMode.HALF_UP));
            } else {
                r.setPorcentajeDelTotal(BigDecimal.ZERO);
            }
        });

        resultado.sort(Comparator.comparing(ResumenProductoResponse::getTotalVendido).reversed());
        return resultado;
    }

    // Usado justo después de registrar(): ya tenemos subtotal/iva calculados en memoria
    private VentaResponse toResponse(Venta venta, BigDecimal subtotal, BigDecimal iva) {
        List<DetalleVentaResponse> detalles = venta.getDetalles().stream()
                .map(d -> new DetalleVentaResponse(
                        d.getId(),
                        d.getProducto().getId(),
                        d.getProducto().getNombre(),
                        d.getCantidad(),
                        d.getPrecioUnitario(),
                        d.getSubtotal()))
                .toList();

        return new VentaResponse(
                venta.getId(),
                venta.getEmpleado().getId(),
                venta.getEmpleado().getNombre(),
                venta.getFechaHora(),
                subtotal,
                iva,
                venta.getTotal(),
                detalles
        );
    }

    // Usado al listar ventas ya guardadas: el subtotal/iva se recalculan
    // sumando el detalle, porque la tabla "ventas" no los guarda por separado.
    private VentaResponse toResponseCalculado(Venta venta) {
        BigDecimal subtotal = venta.getDetalles().stream()
                .map(DetalleVenta::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal iva = venta.getTotal().subtract(subtotal);
        return toResponse(venta, subtotal, iva);
    }
}