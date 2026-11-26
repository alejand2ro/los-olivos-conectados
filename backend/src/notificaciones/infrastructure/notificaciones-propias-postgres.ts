import { pool } from '../../shared/infrastructure/database/postgres';
import { TAMANO_PAGINA } from '../../shared/application/paginacion';
import type { RepositorioNotificacionesPropias } from '../application/listar-mis-notificaciones';
import type { NotificacionPropia } from '../domain/notificacion';

export const notificacionesPropiasPostgres: RepositorioNotificacionesPropias = {
    async listar(usuarioId, pagina) {
        const [cuenta, lista] = await Promise.all([
            pool.query<{ total: number }>('SELECT count(*)::int AS total FROM notificaciones WHERE usuario_id = $1', [usuarioId]),
            pool.query<NotificacionPropia>(
                `SELECT id, tipo, alerta_id, reporte_id, leido, fecha_envio
                 FROM notificaciones WHERE usuario_id = $1
                 ORDER BY fecha_envio DESC, id DESC LIMIT $2 OFFSET $3`,
                [usuarioId, TAMANO_PAGINA, (pagina - 1) * TAMANO_PAGINA],
            ),
        ]);
        return { resultados: lista.rows, total: cuenta.rows[0].total };
    },
};
