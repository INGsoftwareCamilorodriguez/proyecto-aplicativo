package com.capcob.gestionproductos.repository;

import com.capcob.gestionproductos.model.MensajeEmpleado;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MensajeEmpleadoRepository extends JpaRepository<MensajeEmpleado, Integer> {

    // Mensajes que el empleado aún no ha recibido, del más viejo al más nuevo.
    List<MensajeEmpleado> findByDestinatarioIdAndFechaEntregaIsNullOrderByFechaEnvioAsc(Integer destinatarioId);

    // Cuántos mensajes le faltan por llegar a un empleado (para mostrarlo al Administrador).
    long countByDestinatarioIdAndFechaEntregaIsNull(Integer destinatarioId);
}
