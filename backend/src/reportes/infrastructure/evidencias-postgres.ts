import { pool } from '../../shared/infrastructure/database/postgres';
import type { RepositorioEvidencias } from '../application/guardar-evidencia';
import { EvidenciaProhibida, LimiteEvidencias, ReporteEvidenciaNoEncontrado, MAX_EVIDENCIAS, MAX_FOTOS, MAX_VIDEOS } from '../domain/evidencia';

export const evidenciasPostgres: RepositorioEvidencias = {
    async registrar(usuarioId, reporteId, tipo, clave, referencia) {
        const cliente = await pool.connect();
        try {
            await cliente.query('BEGIN');
            const reporte = await cliente.query<{ usuario_id: number }>('SELECT usuario_id FROM reportes WHERE id=$1 FOR UPDATE', [reporteId]);
            if (!reporte.rows[0]) throw new ReporteEvidenciaNoEncontrado();
            if (reporte.rows[0].usuario_id !== usuarioId) throw new EvidenciaProhibida();
            const anterior = await cliente.query<{ id: number; tipo_archivo: 'foto' | 'video' }>(
                `SELECT id,tipo_archivo FROM evidencias WHERE reporte_id=$1 AND url_archivo LIKE $2 ORDER BY id LIMIT 1`,
                [reporteId, `privado/evidencias/${clave}-%`],
            );
            if (anterior.rows[0]) {
                await cliente.query('COMMIT');
                return { id: anterior.rows[0].id, tipo: anterior.rows[0].tipo_archivo, duplicado: true };
            }
            const conteos = await cliente.query<{ fotos: number; videos: number; total: number }>(
                `SELECT count(*) FILTER (WHERE tipo_archivo='foto')::int AS fotos,
                        count(*) FILTER (WHERE tipo_archivo='video')::int AS videos,
                        count(*)::int AS total FROM evidencias WHERE reporte_id=$1`, [reporteId],
            );
            const { fotos, videos, total } = conteos.rows[0];
            if (total >= MAX_EVIDENCIAS || (tipo === 'foto' && fotos >= MAX_FOTOS) || (tipo === 'video' && videos >= MAX_VIDEOS)) {
                throw new LimiteEvidencias('Se permiten hasta 4 fotografías y 1 video por reporte');
            }
            const nueva = await cliente.query<{ id: number }>(
                'INSERT INTO evidencias(reporte_id,tipo_archivo,url_archivo) VALUES($1,$2,$3) RETURNING id',
                [reporteId, tipo, referencia],
            );
            await cliente.query('COMMIT');
            return { id: nueva.rows[0].id, tipo, duplicado: false };
        } catch (error) {
            await cliente.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            cliente.release();
        }
    },
    async consultar(usuarioId, reporteId, evidenciaId) {
        const reporte = await pool.query<{ usuario_id: number }>('SELECT usuario_id FROM reportes WHERE id=$1', [reporteId]);
        if (!reporte.rows[0]) throw new ReporteEvidenciaNoEncontrado();
        if (reporte.rows[0].usuario_id !== usuarioId) throw new EvidenciaProhibida();
        const evidencia = await pool.query<{ url_archivo: string; tipo_archivo: 'foto' | 'video' }>(
            'SELECT url_archivo,tipo_archivo FROM evidencias WHERE id=$1 AND reporte_id=$2', [evidenciaId, reporteId],
        );
        if (!evidencia.rows[0] || (evidencia.rows[0].tipo_archivo !== 'foto' && evidencia.rows[0].tipo_archivo !== 'video')) {
            throw new ReporteEvidenciaNoEncontrado();
        }
        return { referencia: evidencia.rows[0].url_archivo, tipo: evidencia.rows[0].tipo_archivo };
    },
};
