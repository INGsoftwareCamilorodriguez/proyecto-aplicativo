package com.capcob.gestionproductos.repository;

import com.capcob.gestionproductos.model.ConfiguracionSistema;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConfiguracionRepository extends JpaRepository<ConfiguracionSistema, Integer> {
}
