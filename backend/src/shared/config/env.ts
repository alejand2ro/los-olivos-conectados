import 'dotenv/config';

function requerida(nombre: string): string {
    const valor = process.env[nombre];
    if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
    return valor;
}

export const env = {
    PUERTO: Number(process.env.PUERTO ?? 3000),
    DB_HOST: requerida('DB_HOST'),
    DB_PUERTO: Number(process.env.DB_PUERTO ?? 5432),
    DB_NOMBRE: requerida('DB_NOMBRE'),
    DB_USUARIO: requerida('DB_USUARIO'),
    DB_CLAVE: requerida('DB_CLAVE'),
};