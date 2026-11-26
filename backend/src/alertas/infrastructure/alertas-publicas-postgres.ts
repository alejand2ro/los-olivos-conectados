import { pool } from '../../shared/infrastructure/database/postgres';
import { TAMANO_PAGINA } from '../../shared/application/paginacion';
import type { RepositorioAlertasPublicas } from '../application/listar-alertas';
import type { AlertaPublica } from '../domain/alerta-publica';

const desde = `FROM alertas a
    JOIN reportes rp ON rp.id = a.reporte_id
    JOIN verificaciones_reporte vr ON vr.reporte_id = rp.id
    JOIN zonas z ON z.id = rp.zona_id
    LEFT JOIN tipos_incidente ti ON ti.id = rp.tipo_incidente_id
    WHERE rp.verificado = TRUE AND ($1::int IS NULL OR rp.zona_id = $1)`;

export const alertasPublicasPostgres: RepositorioAlertasPublicas = {
    async listar(pagina, zonaId) {
        const [cuenta, lista] = await Promise.all([
            pool.query<{ total: number }>(`SELECT count(*)::int AS total ${desde}`, [zonaId]),
            pool.query<AlertaPublica>(
                `SELECT a.id, ti.nombre AS tipo_incidente, z.nombre AS zona, a.fecha_publicacion
                 ${desde}
                 ORDER BY a.fecha_publicacion DESC, a.id DESC
                 LIMIT $2 OFFSET $3`,
                [zonaId, TAMANO_PAGINA, (pagina - 1) * TAMANO_PAGINA],
            ),
        ]);
        return { resultados: lista.rows, total: cuenta.rows[0].total };
    },
};
