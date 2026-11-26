import { pool } from '../../shared/infrastructure/database/postgres';
import type { RepositorioPerfil } from '../application/obtener-perfil';
import type { PerfilUsuario } from '../domain/usuario';

export const repositorioPerfilPostgres: RepositorioPerfil = {
    async buscarPorId(usuarioId) {
        const resultado = await pool.query<PerfilUsuario>(
            `SELECT u.id, u.nombre, u.correo, u.telefono, r.nombre AS rol, u.zona_id,
                    u.alias_chat, u.modo_accesibilidad
             FROM usuarios u
             JOIN roles r ON r.id = u.rol_id
             WHERE u.id = $1`,
            [usuarioId],
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
