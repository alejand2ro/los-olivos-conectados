import type { RepositorioCatalogos } from '../application/obtener-catalogos';
import type {
    Catalogos,
    EstadoReporte,
    NivelGravedad,
    RolPublico,
    TipoIncidente,
    Zona,
} from '../domain/catalogos';
import { pool } from '../../shared/infrastructure/database/postgres';

export const repositorioCatalogosPostgres: RepositorioCatalogos = {
    async listar(): Promise<Catalogos> {
        const [zonas, roles, tipos, niveles, estados] = await Promise.all([
            pool.query<Zona>(
                'SELECT id, nombre, descripcion FROM zonas ORDER BY LOWER(nombre) COLLATE "C", id',
            ),
            pool.query<RolPublico>(
                `SELECT id, nombre FROM roles
                 WHERE nombre IN ('vecino', 'comerciante')
                 ORDER BY CASE nombre
                     WHEN 'vecino' THEN 1
                     WHEN 'comerciante' THEN 2
                 END, id`,
            ),
            pool.query<TipoIncidente>(
                'SELECT id, nombre, icono FROM tipos_incidente ORDER BY LOWER(nombre) COLLATE "C", id',
            ),
            pool.query<NivelGravedad>(
                'SELECT id, nombre, orden, color FROM niveles_gravedad ORDER BY orden, id',
            ),
            pool.query<EstadoReporte>(
                'SELECT id, codigo, nombre, orden FROM estados_reporte ORDER BY orden, id',
            ),
        ]);

        return {
            zonas: zonas.rows,
            roles_publicos: roles.rows,
            tipos_incidente: tipos.rows,
            niveles_gravedad: niveles.rows,
            estados_reporte: estados.rows,
        };
    },
};
