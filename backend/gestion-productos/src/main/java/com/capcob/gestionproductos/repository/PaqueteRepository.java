package com.capcob.gestionproductos.repository;

import com.capcob.gestionproductos.model.Paquete;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PaqueteRepository extends JpaRepository<Paquete, Integer> {
    Optional<Paquete> findByNombre(String nombre);
    Optional<Paquete> findByNombreAndActivoTrue(String nombre);
    List<Paquete> findByActivoTrue();
}