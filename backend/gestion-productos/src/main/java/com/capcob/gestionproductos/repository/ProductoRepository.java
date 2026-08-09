package com.capcob.gestionproductos.repository;

import com.capcob.gestionproductos.model.Producto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ProductoRepository extends JpaRepository<Producto, Integer> {

    // JOIN FETCH: trae el producto y su paquete en UNA sola consulta,
    // en vez de disparar una consulta extra a la nube por cada paquete distinto
    // (lazy loading) cada vez que se arma la respuesta.
    @Query("SELECT p FROM Producto p JOIN FETCH p.paquete WHERE p.paquete.id = :paqueteId AND p.activo = true")
    List<Producto> findByPaqueteIdAndActivoTrue(@Param("paqueteId") Integer paqueteId);

    @Query("SELECT p FROM Producto p JOIN FETCH p.paquete WHERE p.activo = true")
    List<Producto> findByActivoTrue();

    // Contar sin traer todas las filas: evita cargar la lista completa solo
    // para saber cuántos productos tiene un paquete (se usaba en cada pill).
    long countByPaqueteIdAndActivoTrue(Integer paqueteId);

    // Desactiva todos los productos de un paquete en UNA sola sentencia,
    // en vez de un save() por producto (round trip por cada uno a la nube).
    @Modifying
    @Query("UPDATE Producto p SET p.activo = false WHERE p.paquete.id = :paqueteId AND p.activo = true")
    void desactivarTodosDelPaquete(@Param("paqueteId") Integer paqueteId);

    Optional<Producto> findByCodigoBarras(String codigoBarras);
    boolean existsByCodigoBarras(String codigoBarras);
}