package com.capcob.gestionproductos.repository;

import com.capcob.gestionproductos.model.Producto;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ProductoRepository extends JpaRepository<Producto, Integer> {
    List<Producto> findByPaqueteIdAndActivoTrue(Integer paqueteId);
    List<Producto> findByActivoTrue();
    Optional<Producto> findByCodigoBarras(String codigoBarras);
    boolean existsByCodigoBarras(String codigoBarras);
}