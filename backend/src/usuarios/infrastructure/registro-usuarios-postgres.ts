import { argon2, randomBytes } from 'node:crypto';
import type { DatabaseError } from 'pg';
import { pool } from '../../shared/infrastructure/database/postgres';
import { ErrorRegistro, type RepositorioRegistro, type SeguridadRegistro } from '../application/registrar-usuario';

export const repositorioRegistroPostgres: RepositorioRegistro = {
    async existeZona(id) {
        const resultado = await pool.query('SELECT 1 FROM zonas WHERE id = $1', [id]);
        return (resultado.rowCount ?? 0) > 0;
    },

    async guardar(datos, hash, alias) {
        try {
            const resultado = await pool.query<{ id: number; nombre: string; correo: string; alias_chat: string; zona_id: number }>(
                `INSERT INTO usuarios (
                    nombre, correo, telefono, contrasena_hash, rol_id, zona_id, alias_chat,
                    modo_accesibilidad, compromiso_sos_aceptado,
                    consentimiento_privacidad_aceptado, fecha_consentimiento
                )
                SELECT $1, $2, $3, $4, roles.id, $6, $7, $8, TRUE, TRUE, NOW()
                FROM roles WHERE roles.nombre = $5
                RETURNING id, nombre, correo, alias_chat, zona_id`,
                [datos.nombre, datos.correo, datos.telefono, hash, datos.rol, datos.zonaId, alias, datos.modoAccesibilidad],
            );
            if (resultado.rowCount !== 1) throw new Error('Falta el rol público en el catálogo');
            const usuario = resultado.rows[0];
            return {
                id: usuario.id,
                nombre: usuario.nombre,
                correo: usuario.correo,
                alias_chat: usuario.alias_chat,
                rol: datos.rol,
                zona_id: usuario.zona_id,
            };
        } catch (error) {
            const errorBd = error as DatabaseError;
            if (errorBd.code === '23505' && errorBd.constraint === 'usuarios_correo_key') {
                throw new ErrorRegistro('El correo ya está registrado', 'correo_duplicado');
            }
            if (errorBd.code === '23505' && errorBd.constraint === 'usuarios_alias_chat_key') {
                throw new ErrorRegistro('El alias ya existe', 'alias_duplicado');
            }
            if (errorBd.code === '23503' && errorBd.constraint === 'usuarios_zona_id_fkey') {
                throw new ErrorRegistro('La zona de residencia no existe', 'datos_invalidos');
            }
            throw error;
        }
    },
};

export const seguridadRegistro: SeguridadRegistro = {
    hash(contrasena) {
        const sal = randomBytes(16);
        return new Promise((resolve, reject) => {
            argon2('argon2id', {
                message: contrasena,
                nonce: sal,
                memory: 19 * 1024,
                passes: 2,
                parallelism: 1,
                tagLength: 32,
            }, (error, resultado) => {
                if (error) return reject(error);
                resolve(`$argon2id$v=19$m=19456,t=2,p=1$${sal.toString('base64').replace(/=+$/, '')}$${resultado.toString('base64').replace(/=+$/, '')}`);
            });
        });
    },
    nuevoAlias() {
        return `Usuario-${randomBytes(6).toString('hex').toUpperCase()}`;
    },
};
