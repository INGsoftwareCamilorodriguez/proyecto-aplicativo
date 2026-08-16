package com.capcob.gestionproductos.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResumenMensualResponse {
    private Integer mes;       // 1-12
    private String nombreMes;  // "Enero", "Febrero"...
    private BigDecimal total;  // total vendido ese mes
}