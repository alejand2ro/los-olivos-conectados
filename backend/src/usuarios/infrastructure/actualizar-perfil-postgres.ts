import { pool } from '../../shared/infrastructure/database/postgres';
import type { RepositorioActualizacionPerfil } from '../application/actualizar-perfil';
import type { PerfilUsuario } from '../domain/usuario';

export const actualizadorPerfilPostgres: RepositorioActualizacionPerfil = {
    async actualizar(usuarioId, cambios) {
        const cambiaTelefono = Object.hasOwn(cambios, 'telefono');
        const cambiaAccesibilidad = Object.hasOwn(cambios, 'modo_accesibilidad');
        const resultado = await pool.query<PerfilUsuario>(
            `UPDATE usuarios u
             SET telefono = CASE WHEN $2::boolean THEN $3::text ELSE u.telefono END,
                 modo_accesibilidad = CASE WHEN $4::boolean THEN $5::boolean ELSE u.modo_accesibilidad END
             FROM roles r
             WHERE u.id = $1 AND r.id = u.rol_id
             RETURNING u.id, u.nombre, u.correo, u.telefono, r.nombre AS rol,
                       u.zona_id, u.alias_chat, u.modo_accesibilidad`,
            [usuarioId, cambiaTelefono, cambios.telefono ?? null,
                cambiaAccesibilidad, cambios.modo_accesibilidad ?? null],
        );
        const perfil = resultado.rows[0];
        if (!perfil) return null;
        return {
            id: perfil.id,
            nombre: perfil.nombre,
            correo: perfil.correo,
            telefono: perfil.telefono,
            rol: perfil.rol,
            zona_id: perfil.zona_id,
            alias_chat: perfil.alias_chat,
            modo_accesibilidad: perfil.modo_accesibilidad,
        };
    },
};
