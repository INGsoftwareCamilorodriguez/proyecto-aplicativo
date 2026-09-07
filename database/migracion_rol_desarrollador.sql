-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN: ROL DESARROLLADOR — CAPCOB
-- ══════════════════════════════════════════════════════════════
-- Ejecuta este script UNA sola vez sobre la base de datos
-- (gestion_productos), en orden, de arriba hacia abajo.
-- ══════════════════════════════════════════════════════════════


-- ── 1) Nuevas columnas en "usuarios" ──────────────────────────
-- Guardan los datos de la empresa cliente que el Desarrollador
-- captura al crear un Administrador. Quedan en NULL para los
-- usuarios EMPLEADO y DESARROLLADOR.
ALTER TABLE usuarios
  ADD COLUMN telefono          VARCHAR(30)  NULL,
  ADD COLUMN empresa_nombre    VARCHAR(150) NULL,
  ADD COLUMN empresa_identidad VARCHAR(50)  NULL,
  ADD COLUMN empresa_logo      LONGTEXT     NULL;


-- ── 2) Permitir el valor 'DESARROLLADOR' en la columna "rol" ──
-- SOLO necesario si tu columna "rol" es de tipo ENUM nativo de
-- MySQL. Antes de correr esta línea, revisa el tipo real con:
--   SHOW CREATE TABLE usuarios;
-- Si ves algo como  rol enum('ADMIN','EMPLEADO')  entonces SÍ
-- necesitas esta línea. Si en cambio es VARCHAR(...), NO la
-- ejecutes (ya acepta cualquier texto y no hace falta nada).
ALTER TABLE usuarios
  MODIFY COLUMN rol ENUM('ADMIN','EMPLEADO','DESARROLLADOR') NOT NULL;


-- ── 3) Crear los DOS usuarios del rol Desarrollador ───────────
-- Aquí es donde debes colocar el correo y la contraseña de cada
-- cuenta de Desarrollador:
--
--   a) Reemplaza 'correo1@ejemplo.com' y 'correo2@ejemplo.com'
--      por los correos reales que van a usar para entrar.
--
--   b) La contraseña NO se guarda en texto plano: se guarda su
--      hash BCrypt. Para generarlo:
--        1. Abre backend/gestion-productos/.../herramientas/GenerarContrasena.java
--        2. Cambia la línea `String passwordPlano = "admin1234";`
--           por la contraseña real que quieras para ESE usuario
--           (o pásala como argumento, ver el comentario del archivo).
--        3. Ejecuta el main() de esa clase (clic derecho > Run,
--           en IntelliJ/Eclipse/VS Code) y copia el texto que
--           imprime como "Hash generado: $2a$10$....".
--        4. Pega ese hash abajo, reemplazando
--           'PEGA_AQUI_EL_HASH_GENERADO_1' / '...2'.
--        5. Repite para el segundo usuario con su propia
--           contraseña (puede ser distinta a la del primero).
--
-- Los dos quedan activos (activo = 1) y sin sesión abierta.

INSERT INTO usuarios (nombre, usuario, password_hash, rol, activo)
VALUES
  ('Desarrollador 1', 'correo1@ejemplo.com', 'PEGA_AQUI_EL_HASH_GENERADO_1', 'DESARROLLADOR', 1),
  ('Desarrollador 2', 'correo2@ejemplo.com', 'PEGA_AQUI_EL_HASH_GENERADO_2', 'DESARROLLADOR', 1);


-- ── Verificación rápida (opcional) ────────────────────────────
-- SELECT id, nombre, usuario, rol, activo FROM usuarios WHERE rol = 'DESARROLLADOR';
