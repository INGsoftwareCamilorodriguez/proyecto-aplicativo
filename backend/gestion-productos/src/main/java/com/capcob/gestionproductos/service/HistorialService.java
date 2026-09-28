package com.capcob.gestionproductos.service;

import com.capcob.gestionproductos.dto.ProductoResponse;
import com.capcob.gestionproductos.model.HistorialProducto;
import com.capcob.gestionproductos.model.Producto;
import com.capcob.gestionproductos.repository.HistorialProductoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.text.NumberFormat;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class HistorialService {

    private static final Logger log = LoggerFactory.getLogger(HistorialService.class);

    private final HistorialProductoRepository historialRepository;

    public HistorialService(HistorialProductoRepository historialRepository) {
        this.historialRepository = historialRepository;
    }

    public List<HistorialProducto> listarRecientes() {
        return historialRepository.findTop50ByOrderByFechaDescIdDesc();
    }

    public void registrarProducto(String accion, ProductoResponse p) {
        guardar(accion, p.getId(), p.getPaqueteId(), p.getNombre(), p.getPaqueteNombre(), describir(p));
    }

    public void registrarPaquete(String accion, Integer paqueteId, String nombre, String detalle) {
        guardar(accion, null, paqueteId, nombre, nombre, detalle);
    }

    // El historial nunca debe impedir que el producto o el paquete se guarden:
    // si algo falla aquí (por ejemplo, la tabla aún no existe), solo se avisa en el log.
    private void guardar(String accion, Integer productoId, Integer paqueteId,
                         String productoNombre, String paqueteNombre, String detalle) {
        try {
            HistorialProducto h = new HistorialProducto();
            h.setAccion(accion);
            h.setProductoId(productoId);
            h.setPaqueteId(paqueteId);
            h.setProductoNombre(recortar(productoNombre, 150));
            h.setPaqueteNombre(recortar(paqueteNombre, 100));
            h.setDetalle(recortar(detalle, 255));
            h.setUsuario(usuarioActual());
            h.setFecha(LocalDateTime.now());
            historialRepository.save(h);
        } catch (Exception e) {
            log.warn("No se pudo registrar el historial ({}): {}", accion, e.getMessage());
        }
    }

    // El frontend manda el nombre de usuario en el encabezado X-Usuario (codificado en URL).
    private String usuarioActual() {
        try {
            if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
                String header = attrs.getRequest().getHeader("X-Usuario");
                if (header != null && !header.isBlank()) {
                    return recortar(URLDecoder.decode(header, StandardCharsets.UTF_8), 100);
                }
            }
        } catch (Exception e) {
            // encabezado mal formado: se guarda sin usuario
        }
        return null;
    }

    private String describir(ProductoResponse p) {
        NumberFormat nf = NumberFormat.getNumberInstance(Locale.forLanguageTag("es-CO"));
        nf.setMaximumFractionDigits(2);

        if (p.getTipoPrecio() == Producto.TipoPrecio.PESO) {
            return p.getPrecio() != null ? "$" + nf.format(p.getPrecio()) + " / kg" : "";
        }

        List<String> partes = new ArrayList<>();
        if (Boolean.TRUE.equals(p.getVentaPorUnidad()) && p.getPrecio() != null) {
            partes.add("$" + nf.format(p.getPrecio()) + " / und");
        }
        if (Boolean.TRUE.equals(p.getVentaPorPaquete()) && p.getPrecioPaquete() != null) {
            partes.add("$" + nf.format(p.getPrecioPaquete()) + " / paq (" + p.getUnidadesPorPaquete() + " und)");
        }
        return String.join(" · ", partes);
    }

    private String recortar(String texto, int max) {
        if (texto == null) return null;
        return texto.length() <= max ? texto : texto.substring(0, max);
    }
}
