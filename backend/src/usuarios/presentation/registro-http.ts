import type { IncomingMessage, ServerResponse } from 'node:http';
import { ErrorRegistro, type RegistrarUsuario } from '../application/registrar-usuario';

function responder(res: ServerResponse, estado: number, cuerpo: unknown): void {
    res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(cuerpo));
}

async function leerJson(req: IncomingMessage): Promise<unknown> {
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        throw new ErrorRegistro('Se requiere Content-Type: application/json', 'datos_invalidos');
    }
    const fragmentos: Buffer[] = [];
    let tamano = 0;
    for await (const fragmento of req) {
        const bytes = Buffer.isBuffer(fragmento) ? fragmento : Buffer.from(fragmento);
        tamano += bytes.length;
        if (tamano > 16 * 1024) throw new ErrorRegistro('El cuerpo JSON es demasiado grande', 'datos_invalidos');
        fragmentos.push(bytes);
    }
    try {
        return JSON.parse(Buffer.concat(fragmentos).toString('utf8'));
    } catch {
        throw new ErrorRegistro('El cuerpo debe contener JSON válido', 'datos_invalidos');
    }
}

export function crearResponderRegistro(registrarUsuario: RegistrarUsuario) {
    return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        try {
            const usuario = await registrarUsuario(await leerJson(req));
            responder(res, 201, usuario);
        } catch (error) {
            if (error instanceof ErrorRegistro) {
                responder(res, error.tipo === 'correo_duplicado' ? 409 : 400, { error: error.message });
                return;
            }
            console.error('Error al registrar usuario:', error);
            responder(res, 500, { error: 'No se pudo registrar el usuario' });
        }
    };
}
