import type { IncomingMessage, ServerResponse } from 'node:http';
import { CredencialesInvalidas, type IniciarSesion } from '../application/iniciar-sesion';

class ErrorCuerpoLogin extends Error {}

function responder(res: ServerResponse, estado: number, cuerpo: unknown): void {
    res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(cuerpo));
}

async function leerJson(req: IncomingMessage): Promise<unknown> {
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        throw new ErrorCuerpoLogin('Se requiere Content-Type: application/json');
    }
    const fragmentos: Buffer[] = [];
    let tamano = 0;
    for await (const fragmento of req) {
        const bytes = Buffer.isBuffer(fragmento) ? fragmento : Buffer.from(fragmento);
        tamano += bytes.length;
        if (tamano > 16 * 1024) throw new ErrorCuerpoLogin('El cuerpo JSON es demasiado grande');
        fragmentos.push(bytes);
    }
    try {
        return JSON.parse(Buffer.concat(fragmentos).toString('utf8'));
    } catch {
        throw new ErrorCuerpoLogin('El cuerpo debe contener JSON válido');
    }
}

export function crearResponderLogin(iniciarSesion: IniciarSesion) {
    return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        try {
            responder(res, 200, await iniciarSesion(await leerJson(req)));
        } catch (error) {
            if (error instanceof CredencialesInvalidas) {
                responder(res, 401, { error: 'Credenciales inválidas' });
                return;
            }
            if (error instanceof ErrorCuerpoLogin) {
                responder(res, 400, { error: error.message });
                return;
            }
            console.error('Error al iniciar sesión:', error);
            responder(res, 500, { error: 'No se pudo iniciar sesión' });
        }
    };
}
