import type { DatabaseError } from 'pg';
import { pool } from '../../shared/infrastructure/database/postgres';
import type { RepositorioAutoridad } from '../application/crear-autoridad';
import type { RepositorioPrimerAdministrador } from '../application/crear-primer-administrador';
import {
    AdministradorInicialExistente, CorreoInternoDuplicado, PermisoInternoDenegado,
    type UsuarioInternoCreado,
} from '../domain/cuenta-interna';

function correoDuplicado(error: unknown): never {
    const bd = error as DatabaseError;
    if (bd.code === '23505' && bd.constraint === 'usuarios_correo_key') {
        throw new CorreoInternoDuplicado('El correo ya está registrado');
    }
    throw error;
}

export const autoridadPostgres: RepositorioAutoridad = {
    async esAdministrador(usuarioId) {
        const resultado = await pool.query(
            `SELECT 1 FROM usuarios u JOIN roles r ON r.id=u.rol_id
             WHERE u.id=$1 AND r.nombre='administrador'`, [usuarioId],
        );
        return (resultado.rowCount ?? 0) > 0;
    },
    async crear(administradorId, datos, hash) {
        const cliente = await pool.connect();
        try {
            await cliente.query('BEGIN');
            const actor = await cliente.query<{ rol: string }>(
                `SELECT r.nombre AS rol FROM usuarios u JOIN roles r ON r.id=u.rol_id
                 WHERE u.id=$1 FOR SHARE OF u, r`, [administradorId],
            );
            if (actor.rows[0]?.rol !== 'administrador') throw new PermisoInternoDenegado();
            const resultado = await cliente.query<{ id: number; nombre: string; correo: string }>(
                `INSERT INTO usuarios(nombre,correo,contrasena_hash,rol_id,zona_id)
                 SELECT $1,$2,$3,r.id,NULL FROM roles r WHERE r.nombre='autoridad'
                 RETURNING id,nombre,correo`, [datos.nombre, datos.correo, hash],
            );
            if (resultado.rowCount !== 1) throw new Error('Falta el rol autoridad en el catálogo');
            await cliente.query('COMMIT');
            return { ...resultado.rows[0], alias_chat: null, rol: 'autoridad', zona_id: null } satisfies UsuarioInternoCreado;
        } catch (error) {
            await cliente.query('ROLLBACK').catch(() => {});
            correoDuplicado(error);
        } finally { cliente.release(); }
    },
};

export const primerAdministradorPostgres: RepositorioPrimerAdministrador = {
    async crear(datos, hash) {
        const cliente = await pool.connect();
        try {
            await cliente.query('BEGIN');
            await cliente.query("SELECT pg_advisory_xact_lock(hashtext('los_olivos_primer_administrador'))");
            await cliente.query(`CREATE TABLE IF NOT EXISTS public.inicio_administrador (
                singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
                usuario_id INTEGER NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
                fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
            )`);
            const anterior = await cliente.query('SELECT 1 FROM public.inicio_administrador WHERE singleton=TRUE');
            const administradores = await cliente.query(
                `SELECT 1 FROM usuarios u JOIN roles r ON r.id=u.rol_id
                 WHERE r.nombre='administrador' LIMIT 1`,
            );
            if (anterior.rowCount || administradores.rowCount) throw new AdministradorInicialExistente();
            const resultado = await cliente.query<{ id: number; nombre: string; correo: string }>(
                `INSERT INTO usuarios(nombre,correo,contrasena_hash,rol_id,zona_id)
                 SELECT $1,$2,$3,r.id,NULL FROM roles r WHERE r.nombre='administrador'
                 RETURNING id,nombre,correo`, [datos.nombre, datos.correo, hash],
            );
            if (resultado.rowCount !== 1) throw new Error('Falta el rol administrador en el catálogo');
            await cliente.query('INSERT INTO public.inicio_administrador(singleton,usuario_id) VALUES(TRUE,$1)', [resultado.rows[0].id]);
            await cliente.query('COMMIT');
            return { ...resultado.rows[0], alias_chat: null, rol: 'administrador', zona_id: null } satisfies UsuarioInternoCreado;
        } catch (error) {
            await cliente.query('ROLLBACK').catch(() => {});
            correoDuplicado(error);
        } finally { cliente.release(); }
    },
};
