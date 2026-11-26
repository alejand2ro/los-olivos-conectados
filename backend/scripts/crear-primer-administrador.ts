import { pool } from '../src/shared/infrastructure/database/postgres';
import { crearPrimerAdministrador } from '../src/usuarios/application/crear-primer-administrador';
import { primerAdministradorPostgres } from '../src/usuarios/infrastructure/cuentas-internas-postgres';
import { seguridadRegistro } from '../src/usuarios/infrastructure/registro-usuarios-postgres';
import { AdministradorInicialExistente, CorreoInternoDuplicado, CuentaInternaInvalida } from '../src/usuarios/domain/cuenta-interna';
import { env } from '../src/shared/config/env';

function leerLinea(etiqueta: string, oculta = false): Promise<string> {
    return new Promise((resolver, rechazar) => {
        let valor = '';
        process.stdout.write(etiqueta);
        const recibir = (fragmento: string) => {
            for (const caracter of fragmento) {
                if (caracter === '\u0003') {
                    process.stdin.off('data', recibir);
                    process.stdout.write('\n');
                    rechazar(new Error('Operación cancelada'));
                    return;
                }
                if (caracter === '\r' || caracter === '\n') {
                    process.stdin.off('data', recibir);
                    process.stdout.write('\n');
                    resolver(valor);
                    return;
                }
                if (caracter === '\u007f' || caracter === '\b') {
                    if (valor) {
                        valor = valor.slice(0, -1);
                        if (!oculta) process.stdout.write('\b \b');
                    }
                    continue;
                }
                if (caracter >= ' ' && caracter !== '\u007f') {
                    valor += caracter;
                    if (!oculta) process.stdout.write(caracter);
                }
            }
        };
        process.stdin.on('data', recibir);
    });
}

async function iniciar(): Promise<void> {
    if (process.argv.length !== 2 || !process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
        throw new Error('Ejecuta este procedimiento sin argumentos en una terminal interactiva');
    }
    process.stdout.write(`Base de datos destino: ${env.DB_NOMBRE}\nLa contraseña no se mostrará ni se recibirá por argumentos.\n`);
    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    try {
        const nombre = await leerLinea('Nombre del primer Administrador: ');
        const correo = await leerLinea('Correo: ');
        const contrasena = await leerLinea('Contraseña (oculta): ', true);
        const repetida = await leerLinea('Repite la contraseña (oculta): ', true);
        if (contrasena !== repetida) throw new CuentaInternaInvalida('Las contraseñas no coinciden');
        const confirmacion = await leerLinea(`Escribe CREAR para crear la cuenta en ${env.DB_NOMBRE}: `);
        if (confirmacion !== 'CREAR') throw new Error('Operación cancelada');
        const usuario = await crearPrimerAdministrador(primerAdministradorPostgres, seguridadRegistro)({ nombre, correo, contrasena });
        process.stdout.write(`Administrador creado: ID ${usuario.id}, correo ${usuario.correo}.\n`);
    } finally {
        process.stdin.setRawMode(false);
        process.stdin.pause();
    }
}

iniciar().catch((error: unknown) => {
    if (error instanceof AdministradorInicialExistente) process.stderr.write('Ya se creó o existe un Administrador inicial. No se creó otra cuenta.\n');
    else if (error instanceof CorreoInternoDuplicado || error instanceof CuentaInternaInvalida) process.stderr.write(`${error.message}\n`);
    else if (error instanceof Error && error.message === 'Operación cancelada') process.stderr.write('Operación cancelada.\n');
    else process.stderr.write('No se pudo crear el Administrador. Revisa la conexión y los permisos de PostgreSQL.\n');
    process.exitCode = 1;
}).finally(async () => { await pool.end().catch(() => {}); });
