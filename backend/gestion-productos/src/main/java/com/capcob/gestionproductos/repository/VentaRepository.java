package com.capcob.gestionproductos.repository;

import com.capcob.gestionproductos.model.Venta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

public interface VentaRepository extends JpaRepository<Venta, Integer> {

    // JOIN FETCH para traer el empleado junto con la venta en una sola consulta
    @Query("SELECT v FROM Venta v JOIN FETCH v.empleado WHERE v.fechaHora BETWEEN :inicio AND :fin ORDER BY v.fechaHora DESC")
    List<Venta> findByFechaBetweenOrderByFechaDesc(@Param("inicio") LocalDateTime inicio,
                                                     @Param("fin") LocalDateTime fin);
}