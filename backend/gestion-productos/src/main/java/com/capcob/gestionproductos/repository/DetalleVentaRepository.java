package com.capcob.gestionproductos.repository;

import com.capcob.gestionproductos.model.DetalleVenta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

public interface DetalleVentaRepository extends JpaRepository<DetalleVenta, Integer> {

    // JOIN FETCH del producto (de ahí se saca el nombre, ya que detalle_venta no lo guarda)
    @Query("SELECT d FROM DetalleVenta d JOIN FETCH d.producto WHERE d.venta.fechaHora BETWEEN :inicio AND :fin")
    List<DetalleVenta> findDetallesEnRango(@Param("inicio") LocalDateTime inicio,
                                            @Param("fin") LocalDateTime fin);
}