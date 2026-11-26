import { argon2, timingSafeEqual } from 'node:crypto';
import { pool } from '../../shared/infrastructure/database/postgres';
import type { RepositorioLogin, UsuarioParaLogin, VerificadorContrasena } from '../application/iniciar-sesion';

const SAL_FICTICIA = Buffer.alloc(16);
const HASH_FICTICIO = Buffer.alloc(32);
const FORMATO_ARGON2ID = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

function leerHash(hash: string | null) {
    const partes = hash?.match(FORMATO_ARGON2ID);
    if (!partes) return null;
    const memoria = Number(partes[1]);
    const pasadas = Number(partes[2]);
    const paralelismo = Number(partes[3]);
    const sal = Buffer.from(partes[4], 'base64');
    const esperado = Buffer.from(partes[5], 'base64');
    if (!Number.isSafeInteger(memoria) || memoria < 8 * paralelismo || memoria > 262144 ||
        !Number.isSafeInteger(pasadas) || pasadas < 1 || pasadas > 10 ||
        !Number.isSafeInteger(paralelismo) || paralelismo < 1 || paralelismo > 8 ||
        sal.length < 16 || esperado.length < 16 || esperado.length > 64) return null;
    return { memoria, pasadas, paralelismo, sal, esperado };
}

function derivar(contrasena: string, sal: Buffer, memoria: number, pasadas: number, paralelismo: number, longitud: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        argon2('argon2id', {
            message: contrasena,
            nonce: sal,
            memory: memoria,
            passes: pasadas,
            parallelism: paralelismo,
            tagLength: longitud,
        }, (error, resultado) => error ? reject(error) : resolve(resultado));
    });
}

export const repositorioLoginPostgres: RepositorioLogin = {
    async buscarPorCorreo(correo) {
        const resultado = await pool.query<UsuarioParaLogin>(
            `SELECT u.id, u.nombre, r.nombre AS rol, u.zona_id, u.contrasena_hash
             FROM usuarios u JOIN roles r ON r.id = u.rol_id
             WHERE u.correo = $1 LIMIT 1`,
            [correo],
        );
        return resultado.rows[0] ?? null;
    },
};

export const verificadorContrasenaArgon2id: VerificadorContrasena = {
    async verificar(contrasena, hash) {
        const datos = leerHash(hash);
        const derivado = await derivar(
            contrasena,
            datos?.sal ?? SAL_FICTICIA,
            datos?.memoria ?? 19456,
            datos?.pasadas ?? 2,
            datos?.paralelismo ?? 1,
            datos?.esperado.length ?? HASH_FICTICIO.length,
        );
        return datos !== null && timingSafeEqual(derivado, datos.esperado);
    },
};
