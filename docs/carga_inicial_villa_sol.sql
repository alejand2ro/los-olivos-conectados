-- Carga inicial de Urbanización Villa Sol y su chat.
-- Ejecutar DESPUÉS de los_olivos_conectados_schema.sql, conectado a la
-- base nueva y vacía los_olivos_conectados. No se ha ejecutado.
-- El nombre es un dato inicial; ninguna regla de la aplicación depende
-- de este nombre ni de un id numérico. Se pueden agregar más zonas y chats.
-- Al repetir el script, reutiliza la zona y el chat existentes y asegura
-- su descripción y nombre acordados, sin duplicarlos.
-- Si ya hay varias zonas con ese mismo nombre (ignorando espacios extremos
-- y mayúsculas), se detiene para que se corrija la ambigüedad manualmente.

BEGIN;
SET LOCAL search_path = public;
LOCK TABLE zonas, chats IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
    zona_villa_sol_id INTEGER;
    coincidencias BIGINT;
    nombre_zona CONSTANT TEXT := 'Urbanización Villa Sol';
    descripcion_zona CONSTANT TEXT := 'Barrio estudiantil de Los Olivos, rodeado de universidades como la UCV y la UPN. Sus calles concentran pensiones para estudiantes, fotocopiadoras, cafés y departamentos en alquiler, con un ambiente joven y dinámico';
    nombre_chat CONSTANT TEXT := 'Chat Urbanización Villa Sol';
BEGIN
    SELECT COUNT(*), MIN(id)
      INTO coincidencias, zona_villa_sol_id
      FROM zonas
     WHERE LOWER(BTRIM(nombre)) = LOWER(nombre_zona);

    IF coincidencias > 1 THEN
        RAISE EXCEPTION
            'Hay % zonas llamadas Urbanización Villa Sol; resolver duplicados antes de la carga',
            coincidencias;
    ELSIF coincidencias = 0 THEN
        INSERT INTO zonas (nombre, descripcion)
        VALUES (nombre_zona, descripcion_zona)
        RETURNING id INTO zona_villa_sol_id;
    ELSE
        UPDATE zonas
           SET descripcion = descripcion_zona
         WHERE id = zona_villa_sol_id
           AND descripcion IS DISTINCT FROM descripcion_zona;
    END IF;

    -- La relación chats.zona_id es UNIQUE. Si ya existe el chat, sólo
    -- se corrige su nombre; los mensajes y el resto de zonas no cambian.
    INSERT INTO chats (zona_id, nombre)
    VALUES (zona_villa_sol_id, nombre_chat)
    ON CONFLICT (zona_id) DO UPDATE
        SET nombre = EXCLUDED.nombre
        WHERE chats.nombre IS DISTINCT FROM EXCLUDED.nombre;
END;
$$;

COMMIT;
