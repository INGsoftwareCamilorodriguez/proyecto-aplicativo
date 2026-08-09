package com.capcob.gestionproductos.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DbMigrationRunner implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    public DbMigrationRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        eliminarIndiceUniqueSiExiste();
    }

    private void eliminarIndiceUniqueSiExiste() {
        String sql = """
                SELECT INDEX_NAME
                FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'paquete'
                  AND COLUMN_NAME = 'nombre'
                  AND NON_UNIQUE = 0
                  AND INDEX_NAME != 'PRIMARY'
                """;

        List<String> indices = jdbcTemplate.queryForList(sql, String.class);

        for (String indexName : indices) {
            System.out.println(">> Eliminando índice único obsoleto: " + indexName);
            jdbcTemplate.execute("ALTER TABLE paquete DROP INDEX `" + indexName + "`");
        }
    }
}