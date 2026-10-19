import { Pool } from 'pg';
import { env } from '../../config/env';

// Un Pool reutiliza conexiones: se crea una vez y lo comparten todos los repositorios
export const pool = new Pool({
    host: env.DB_HOST,
    port: env.DB_PUERTO,
    database: env.DB_NOMBRE,
    user: env.DB_USUARIO,
    password: env.DB_CLAVE,
});

export async function verificarConexion(): Promise<void> {
    const { rows } = await pool.query('SELECT count(*)::int AS total FROM roles');
    console.log(`Conexión a PostgreSQL OK. Roles en la BD: ${rows[0].total}`);
}