package com.capcob.gestionproductos.repository;

import com.capcob.gestionproductos.model.HistorialProducto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HistorialProductoRepository extends JpaRepository<HistorialProducto, Integer> {

    List<HistorialProducto> findTop50ByOrderByFechaDescIdDesc();
}
