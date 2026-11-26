import { pool } from '../../shared/infrastructure/database/postgres';
import type { RepositorioDetalleReporte } from '../application/consultar-reporte';
import { AudioNoDisponible, ReporteAjeno, ReporteNoEncontrado, type DetalleReporte } from '../domain/detalle-reporte';

async function comprobarAutor(usuarioId: number, reporteId: number) {
    const consulta = await pool.query<{ usuario_id: number; descripcion_audio_url: string | null }>(
        'SELECT usuario_id, descripcion_audio_url FROM reportes WHERE id=$1', [reporteId],
    );
    const reporte = consulta.rows[0];
    if (!reporte) throw new ReporteNoEncontrado();
    if (reporte.usuario_id !== usuarioId) throw new ReporteAjeno();
    return reporte;
}

export const detalleReportePostgres: RepositorioDetalleReporte = {
    async detalle(usuarioId, reporteId) {
        await comprobarAutor(usuarioId, reporteId);
        const consulta = await pool.query<Omit<DetalleReporte, 'evidencias'>>(
            `SELECT r.id, t.nombre AS tipo_incidente, r.zona_id, z.nombre AS zona_nombre,
                    r.descripcion_texto,
                    CASE WHEN r.descripcion_audio_url IS NULL THEN NULL ELSE '/reportes/' || r.id || '/audio' END AS descripcion_audio_url,
                    r.latitud::float8 AS latitud, r.longitud::float8 AS longitud,
                    g.nombre AS nivel_gravedad, e.codigo AS estado_codigo, e.nombre AS estado_nombre,
                    r.verificado, r.es_sos, r.fecha_creacion
             FROM reportes r LEFT JOIN tipos_incidente t ON t.id=r.tipo_incidente_id
             JOIN zonas z ON z.id=r.zona_id JOIN niveles_gravedad g ON g.id=r.nivel_gravedad_id
             JOIN estados_reporte e ON e.id=r.estado_actual_id WHERE r.id=$1`, [reporteId],
        );
        const evidencias = await pool.query<{ id: number; tipo_archivo: 'foto' | 'video'; fecha_subida: Date }>(
            `SELECT id, tipo_archivo, fecha_subida FROM evidencias
             WHERE reporte_id=$1 AND tipo_archivo IN ('foto','video') ORDER BY fecha_subida, id`, [reporteId],
        );
        return {
            ...consulta.rows[0],
            evidencias: evidencias.rows.map((item) => ({ ...item,
                url_archivo: `/reportes/${reporteId}/evidencias/${item.id}/archivo` })),
        };
    },
    async seguimiento(usuarioId, reporteId) {
        await comprobarAutor(usuarioId, reporteId);
        const consulta = await pool.query<{ estado_codigo: string; estado_nombre: string }>(
            `SELECT e.codigo AS estado_codigo, e.nombre AS estado_nombre
             FROM reportes r JOIN estados_reporte e ON e.id=r.estado_actual_id WHERE r.id=$1`, [reporteId],
        );
        const historial = await pool.query<{ estado_codigo: string; estado_nombre: string; fecha: Date; comentario: string | null }>(
            `SELECT e.codigo AS estado_codigo, e.nombre AS estado_nombre,
                    h.fecha_cambio AS fecha, h.comentario
             FROM historial_estados h JOIN estados_reporte e ON e.id=h.estado_nuevo_id
             WHERE h.reporte_id=$1 ORDER BY h.fecha_cambio, h.id`, [reporteId],
        );
        return { ...consulta.rows[0], historial: historial.rows };
    },
    async audio(usuarioId, reporteId) {
        const reporte = await comprobarAutor(usuarioId, reporteId);
        if (!reporte.descripcion_audio_url) throw new AudioNoDisponible();
        return reporte.descripcion_audio_url;
    },
};
