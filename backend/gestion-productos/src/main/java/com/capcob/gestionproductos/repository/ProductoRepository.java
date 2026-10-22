package com.capcob.gestionproductos.repository;

import com.capcob.gestionproductos.model.Producto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductoRepository extends JpaRepository<Producto, Integer> {

    @Query("SELECT p FROM Producto p JOIN FETCH p.paquete WHERE p.activo = true AND p.adminId = :adminId")
    List<Producto> findByActivoTrue(@Param("adminId") Integer adminId);

    @Query("SELECT p FROM Producto p JOIN FETCH p.paquete WHERE p.paquete.id = :paqueteId AND p.activo = true AND p.adminId = :adminId")
    List<Producto> findByPaqueteIdAndActivoTrue(@Param("paqueteId") Integer paqueteId,
                                                @Param("adminId") Integer adminId);

    Optional<Producto> findByCodigoBarrasAndAdminId(String codigoBarras, Integer adminId);

    // Usado por BarcodeService para garantizar códigos únicos (globales, no por admin,
    // porque la columna codigo_barras tiene índice único en toda la tabla).
    // Cuenta sin traer los productos (ni sus imágenes) a memoria.
    long countByPaqueteIdAndActivoTrueAndAdminId(Integer paqueteId, Integer adminId);

    boolean existsByCodigoBarras(String codigoBarras);
}