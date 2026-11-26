import { pool } from '../../shared/infrastructure/database/postgres';
import { AutorReporteNoEncontrado, DatosReporteInvalidos, type RepositorioCreacionReporte } from '../application/crear-reporte-escrito';

interface ContextoCreacion {
    zona_residencia_id: number | null;
    tipo_valido: boolean;
    gravedad_valida: boolean;
    zona_valida: boolean;
    estado_id: number | null;
    estado_nombre: string | null;
}

export const creadorReportePostgres: RepositorioCreacionReporte = {
    async crear(usuarioId, datos) {
        const contexto = await pool.query<ContextoCreacion>(
            `SELECT u.zona_id AS zona_residencia_id,
                    EXISTS (SELECT 1 FROM tipos_incidente WHERE id = $2) AS tipo_valido,
                    EXISTS (SELECT 1 FROM niveles_gravedad WHERE id = $3) AS gravedad_valida,
                    EXISTS (SELECT 1 FROM zonas WHERE id = COALESCE($4, u.zona_id)) AS zona_valida,
                    (SELECT id FROM estados_reporte WHERE codigo = 'recibido') AS estado_id,
                    (SELECT nombre FROM estados_reporte WHERE codigo = 'recibido') AS estado_nombre
             FROM usuarios u WHERE u.id = $1`,
            [usuarioId, datos.tipoIncidenteId, datos.nivelGravedadId, datos.zonaId ?? null],
        );
        const valores = contexto.rows[0];
        if (!valores) throw new AutorReporteNoEncontrado();
        if (!valores.tipo_valido) throw new DatosReporteInvalidos('El tipo de incidente no existe');
        if (!valores.gravedad_valida) throw new DatosReporteInvalidos('El nivel de gravedad no existe');
        if (!valores.zona_valida) throw new DatosReporteInvalidos('La zona del incidente no existe o la cuenta no tiene zona de residencia');
        if (valores.estado_id === null || valores.estado_nombre === null) {
            throw new Error('Falta el estado inicial recibido en la base de datos');
        }

        const zonaId = datos.zonaId ?? valores.zona_residencia_id;
        const resultado = await pool.query<{ id: number; fecha_creacion: Date }>(
            `INSERT INTO reportes
                (usuario_id, tipo_incidente_id, zona_id, descripcion_texto, descripcion_audio_url,
                 latitud, longitud, nivel_gravedad_id, es_sos, estado_actual_id, verificado)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, false)
             RETURNING id, fecha_creacion`,
            [usuarioId, datos.tipoIncidenteId, zonaId, datos.descripcionTexto ?? null, datos.descripcionAudioUrl ?? null,
                datos.latitud, datos.longitud, datos.nivelGravedadId, valores.estado_id],
        );
        return {
            id: resultado.rows[0].id,
            estado_codigo: 'recibido',
            estado_nombre: valores.estado_nombre,
            fecha_creacion: resultado.rows[0].fecha_creacion.toISOString(),
        };
    },
};
