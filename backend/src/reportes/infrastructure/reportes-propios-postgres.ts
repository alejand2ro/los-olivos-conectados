import { pool } from '../../shared/infrastructure/database/postgres';
import { TAMANO_PAGINA } from '../../shared/application/paginacion';
import type { RepositorioReportesPropios } from '../application/listar-mis-reportes';
import type { ResumenReporte } from '../domain/resumen-reporte';

export const reportesPropiosPostgres: RepositorioReportesPropios = {
    async listar(usuarioId, pagina) {
        const [cuenta, lista] = await Promise.all([
            pool.query<{ total: number }>(
                'SELECT count(*)::int AS total FROM reportes WHERE usuario_id = $1', [usuarioId],
            ),
            pool.query<ResumenReporte>(
                `SELECT rp.id, ti.nombre AS tipo_incidente, rp.zona_id,
                        er.codigo AS estado_codigo, er.nombre AS estado_nombre,
                        rp.verificado, rp.es_sos, rp.fecha_creacion
                 FROM reportes rp
                 LEFT JOIN tipos_incidente ti ON ti.id = rp.tipo_incidente_id
                 JOIN estados_reporte er ON er.id = rp.estado_actual_id
                 WHERE rp.usuario_id = $1
                 ORDER BY rp.fecha_creacion DESC, rp.id DESC
                 LIMIT $2 OFFSET $3`,
                [usuarioId, TAMANO_PAGINA, (pagina - 1) * TAMANO_PAGINA],
            ),
        ]);
        return { resultados: lista.rows, total: cuenta.rows[0].total };
    },
};
