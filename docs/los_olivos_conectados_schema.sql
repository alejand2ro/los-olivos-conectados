-- Los Olivos Conectados: esquema y catálogos del MVP.
-- Ejecutar solamente en la base NUEVA y VACÍA los_olivos_conectados.
-- Después ejecutar carga_inicial_villa_sol.sql para la primera zona y chat.
-- No se fija ninguna zona ni ID: pueden existir múltiples zonas y chats.
BEGIN;
SET LOCAL search_path = public;

CREATE TABLE zonas (
    id SERIAL PRIMARY KEY, nombre VARCHAR(100) NOT NULL, descripcion TEXT
);
CREATE TABLE roles (
    id SERIAL PRIMARY KEY, nombre VARCHAR(50) NOT NULL UNIQUE, descripcion TEXT
);
CREATE TABLE niveles_gravedad (
    id SERIAL PRIMARY KEY, nombre VARCHAR(30) NOT NULL UNIQUE,
    orden INTEGER NOT NULL, color VARCHAR(20)
);
CREATE TABLE estados_reporte (
    id SERIAL PRIMARY KEY, codigo VARCHAR(40) NOT NULL UNIQUE,
    nombre VARCHAR(50) NOT NULL UNIQUE, orden INTEGER NOT NULL, descripcion TEXT
);
CREATE TABLE tipos_incidente (
    id SERIAL PRIMARY KEY, nombre VARCHAR(80) NOT NULL UNIQUE, icono VARCHAR(100)
);

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    correo VARCHAR(150) NOT NULL UNIQUE,
    telefono VARCHAR(20),
    contrasena_hash VARCHAR(255) NOT NULL,
    rol_id INTEGER NOT NULL REFERENCES roles(id),
    zona_id INTEGER REFERENCES zonas(id),
    alias_chat VARCHAR(50) UNIQUE,
    modo_accesibilidad BOOLEAN NOT NULL DEFAULT FALSE,
    compromiso_sos_aceptado BOOLEAN NOT NULL DEFAULT FALSE,
    consentimiento_privacidad_aceptado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_consentimiento TIMESTAMPTZ,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- La condición consulta el nombre del rol, nunca su ID numérico.
CREATE FUNCTION exigir_zona_residencia() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE nombre_rol text;
BEGIN
    SELECT nombre INTO nombre_rol FROM roles WHERE id = NEW.rol_id;
    IF nombre_rol IN ('vecino', 'comerciante') AND NEW.zona_id IS NULL THEN
        RAISE EXCEPTION 'El rol % exige zona de residencia', nombre_rol;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_usuarios_zona
BEFORE INSERT OR UPDATE OF rol_id, zona_id ON usuarios
FOR EACH ROW EXECUTE FUNCTION exigir_zona_residencia();

-- Renombrar un rol tampoco puede dejar cuentas vecinales sin zona.
CREATE FUNCTION validar_cambio_nombre_rol() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.nombre IN ('vecino', 'comerciante') AND EXISTS (
        SELECT 1 FROM usuarios WHERE rol_id = NEW.id AND zona_id IS NULL
    ) THEN
        RAISE EXCEPTION 'El rol % tiene cuentas sin zona', NEW.nombre;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_roles_zona
BEFORE UPDATE OF nombre ON roles
FOR EACH ROW EXECUTE FUNCTION validar_cambio_nombre_rol();

CREATE TABLE reportes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    tipo_incidente_id INTEGER REFERENCES tipos_incidente(id),
    zona_id INTEGER NOT NULL REFERENCES zonas(id),
    descripcion_texto TEXT,
    descripcion_audio_url VARCHAR(255),
    latitud DECIMAL(10,7) NOT NULL CHECK (latitud BETWEEN -90 AND 90),
    longitud DECIMAL(10,7) NOT NULL CHECK (longitud BETWEEN -180 AND 180),
    nivel_gravedad_id INTEGER NOT NULL REFERENCES niveles_gravedad(id),
    es_sos BOOLEAN NOT NULL DEFAULT FALSE,
    estado_actual_id INTEGER NOT NULL REFERENCES estados_reporte(id),
    verificado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_reporte_normal_completo CHECK (
        es_sos OR (tipo_incidente_id IS NOT NULL AND
            (NULLIF(BTRIM(descripcion_texto), '') IS NOT NULL OR
             NULLIF(BTRIM(descripcion_audio_url), '') IS NOT NULL))
    )
);

-- Sólo la creación exige Recibido; los cambios posteriores usan historial.
CREATE FUNCTION validar_reporte_nuevo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM estados_reporte
        WHERE id = NEW.estado_actual_id AND codigo = 'recibido'
    ) THEN
        RAISE EXCEPTION 'El reporte nuevo debe comenzar en Recibido';
    END IF;
    IF NEW.es_sos AND NOT EXISTS (
        SELECT 1 FROM niveles_gravedad
        WHERE id = NEW.nivel_gravedad_id AND nombre = 'Alta'
    ) THEN
        RAISE EXCEPTION 'El SOS debe tener gravedad Alta';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_reporte_nuevo
BEFORE INSERT ON reportes FOR EACH ROW EXECUTE FUNCTION validar_reporte_nuevo();

CREATE TABLE evidencias (
    id SERIAL PRIMARY KEY,
    reporte_id INTEGER NOT NULL REFERENCES reportes(id) ON DELETE CASCADE,
    tipo_archivo VARCHAR(10) NOT NULL CHECK (tipo_archivo IN ('foto', 'audio', 'video')),
    url_archivo VARCHAR(255) NOT NULL,
    fecha_subida TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE historial_estados (
    id SERIAL PRIMARY KEY,
    reporte_id INTEGER NOT NULL REFERENCES reportes(id),
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    estado_anterior_id INTEGER REFERENCES estados_reporte(id),
    estado_nuevo_id INTEGER NOT NULL REFERENCES estados_reporte(id),
    comentario TEXT,
    fecha_cambio TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- El estado inicial se guarda con el autor y la fecha del reporte.
CREATE FUNCTION registrar_estado_inicial() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO historial_estados
        (reporte_id, usuario_id, estado_anterior_id, estado_nuevo_id, fecha_cambio)
    VALUES (NEW.id, NEW.usuario_id, NULL, NEW.estado_actual_id, NEW.fecha_creacion);
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_reporte_estado_inicial
AFTER INSERT ON reportes FOR EACH ROW EXECUTE FUNCTION registrar_estado_inicial();

-- Protección efectiva incluso si la cuenta de aplicación es dueña de la tabla.
CREATE FUNCTION impedir_edicion_historial() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'historial_estados es de sólo inserción';
END;
$$;
CREATE TRIGGER trg_historial_inmutable
BEFORE UPDATE OR DELETE ON historial_estados
FOR EACH ROW EXECUTE FUNCTION impedir_edicion_historial();
REVOKE UPDATE, DELETE ON historial_estados FROM PUBLIC;

CREATE TABLE verificaciones_reporte (
    id SERIAL PRIMARY KEY,
    reporte_id INTEGER NOT NULL UNIQUE REFERENCES reportes(id),
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    fecha_verificacion TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE verificaciones_reporte IS
    'Una verificación por reporte; se inserta en la misma transacción que verificado, alerta y avisos.';

CREATE TABLE alertas (
    id SERIAL PRIMARY KEY,
    reporte_id INTEGER NOT NULL UNIQUE REFERENCES reportes(id),
    fecha_publicacion TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE alertas IS
    'Sólo para reportes verificados. El marcador público se aproxima fuera de la base.';

CREATE TABLE notificaciones (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('alerta', 'sos', 'cambio_estado')),
    alerta_id INTEGER REFERENCES alertas(id),
    reporte_id INTEGER REFERENCES reportes(id),
    leido BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_envio TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_notificacion_referencia_valida CHECK (
        (tipo = 'alerta' AND alerta_id IS NOT NULL AND reporte_id IS NULL) OR
        (tipo IN ('sos', 'cambio_estado') AND reporte_id IS NOT NULL AND alerta_id IS NULL)
    )
);
COMMENT ON TABLE notificaciones IS
    'Avisos internos: SOS a Autoridad; alerta verificada a vecinos de la zona; cambio de estado al autor. El backend elige destinatarios.';

CREATE TABLE chats (
    id SERIAL PRIMARY KEY, zona_id INTEGER NOT NULL UNIQUE REFERENCES zonas(id),
    nombre VARCHAR(100) NOT NULL
);
CREATE TABLE mensajes (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES chats(id),
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    contenido TEXT NOT NULL,
    oculto BOOLEAN NOT NULL DEFAULT FALSE,
    reportado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_envio TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usuarios_zona ON usuarios(zona_id);
CREATE INDEX idx_reportes_zona ON reportes(zona_id);
CREATE INDEX idx_reportes_gravedad ON reportes(nivel_gravedad_id);
CREATE INDEX idx_reportes_estado ON reportes(estado_actual_id);
CREATE INDEX idx_reportes_fecha_creacion ON reportes(fecha_creacion);
CREATE INDEX idx_historial_reporte ON historial_estados(reporte_id);
CREATE INDEX idx_verificaciones_reporte_usuario ON verificaciones_reporte(usuario_id);
CREATE INDEX idx_mensajes_chat ON mensajes(chat_id);
CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_id);
CREATE INDEX idx_notificaciones_usuario_fecha ON notificaciones(usuario_id, fecha_envio DESC);

INSERT INTO roles (nombre, descripcion) VALUES
    ('vecino', 'Usuario que reporta y consulta alertas y chat de su zona.'),
    ('comerciante', 'Usuario con negocio local; mismos permisos iniciales que vecino.'),
    ('autoridad', 'Gestiona y verifica reportes; cuenta creada internamente.'),
    ('administrador', 'Administra cuentas de autoridad y modera contenido.');
INSERT INTO niveles_gravedad (nombre, orden, color) VALUES
    ('Baja', 1, '#4CAF50'), ('Media', 2, '#FFC107'), ('Alta', 3, '#F44336');
INSERT INTO estados_reporte (codigo, nombre, orden, descripcion) VALUES
    ('recibido', 'Recibido', 1, 'Reporte registrado y pendiente de revisión.'),
    ('en_revision', 'En revisión', 2, 'Reporte en revisión por Autoridad.'),
    ('en_proceso', 'En proceso', 3, 'Reporte en atención.'),
    ('resuelto', 'Resuelto', 4, 'Caso cerrado por Autoridad.');
INSERT INTO tipos_incidente (nombre, icono) VALUES
    ('Robo', 'icon-robo.svg'), ('Accidente', 'icon-accidente.svg'),
    ('Acoso', 'icon-acoso.svg'), ('Sospechoso', 'icon-sospechoso.svg'),
    ('Incendio', 'icon-incendio.svg');

-- La primera zona y su chat se cargan en el script separado.
COMMIT;
