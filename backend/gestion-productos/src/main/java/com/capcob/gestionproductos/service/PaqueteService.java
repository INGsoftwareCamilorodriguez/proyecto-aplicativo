package com.capcob.gestionproductos.service;

import com.capcob.gestionproductos.dto.PaqueteRequest;
import com.capcob.gestionproductos.dto.PaqueteResponse;
import com.capcob.gestionproductos.model.Paquete;
import com.capcob.gestionproductos.repository.PaqueteRepository;
import com.capcob.gestionproductos.repository.ProductoRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PaqueteService {

    private final PaqueteRepository paqueteRepository;
    private final ProductoRepository productoRepository;

    public PaqueteService(PaqueteRepository paqueteRepository, ProductoRepository productoRepository) {
        this.paqueteRepository = paqueteRepository;
        this.productoRepository = productoRepository;
    }

    public List<PaqueteResponse> listar() {
        return paqueteRepository.findByActivoTrue().stream()
                .map(this::toResponse)
                .toList();
    }

    public Paquete obtenerActivo(Integer id) {
        Paquete paquete = paqueteRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Paquete no encontrado"));
        if (!paquete.getActivo()) {
            throw new IllegalArgumentException("El paquete no está activo");
        }
        return paquete;
    }

    public PaqueteResponse crear(PaqueteRequest request) {
        if (paqueteRepository.findByNombre(request.getNombre()).isPresent()) {
            throw new IllegalArgumentException("Ya existe un paquete con ese nombre");
        }
        Paquete paquete = new Paquete();
        paquete.setNombre(request.getNombre());
        paquete.setDescripcion(request.getDescripcion());
        paquete.setActivo(true);
        return toResponse(paqueteRepository.save(paquete));
    }

    public PaqueteResponse actualizar(Integer id, PaqueteRequest request) {
        Paquete paquete = obtenerActivo(id);
        paquete.setNombre(request.getNombre());
        paquete.setDescripcion(request.getDescripcion());
        return toResponse(paqueteRepository.save(paquete));
    }

    // Eliminar paquete = desactivarlo a él y a todos sus productos (soft delete)
    public void eliminar(Integer id) {
        Paquete paquete = obtenerActivo(id);
        paquete.setActivo(false);
        paqueteRepository.save(paquete);

        productoRepository.findByPaqueteIdAndActivoTrue(id)
                .forEach(producto -> {
                    producto.setActivo(false);
                    productoRepository.save(producto);
                });
    }

    private PaqueteResponse toResponse(Paquete paquete) {
        long total = productoRepository.findByPaqueteIdAndActivoTrue(paquete.getId()).size();
        return new PaqueteResponse(paquete.getId(), paquete.getNombre(), paquete.getDescripcion(), total);
    }
}