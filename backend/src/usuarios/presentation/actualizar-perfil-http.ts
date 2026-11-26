import type { IncomingMessage, ServerResponse } from 'node:http';
import { DatosPerfilInvalidos, type ActualizarPerfil } from '../application/actualizar-perfil';
import { PerfilNoEncontrado, TokenInvalido } from '../application/obtener-perfil';

class ErrorCuerpoPerfil extends Error {}

function responder(res: ServerResponse, estado: number, cuerpo: unknown): void {
    res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(cuerpo));
}

async function leerJson(req: IncomingMessage): Promise<unknown> {
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        throw new ErrorCuerpoPerfil('Se requiere Content-Type: application/json');
    }
    const fragmentos: Buffer[] = [];
    let tamano = 0;
    for await (const fragmento of req) {
        const bytes = Buffer.isBuffer(fragmento) ? fragmento : Buffer.from(fragmento);
        tamano += bytes.length;
        if (tamano > 16 * 1024) throw new ErrorCuerpoPerfil('El cuerpo JSON es demasiado grande');
        fragmentos.push(bytes);
    }
    try {
        return JSON.parse(Buffer.concat(fragmentos).toString('utf8'));
    } catch {
        throw new ErrorCuerpoPerfil('El cuerpo debe contener JSON válido');
    }
}

export function crearResponderActualizarPerfil(actualizarPerfil: ActualizarPerfil) {
    return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        const autorizacion = req.headers.authorization?.match(/^Bearer\s+(\S+)$/i);
        if (!autorizacion) {
            responder(res, 401, { error: 'Token inválido o vencido' });
            return;
        }
        try {
            const entrada = await leerJson(req);
            responder(res, 200, await actualizarPerfil(autorizacion[1], entrada));
        } catch (error) {
            if (error instanceof TokenInvalido) {
                responder(res, 401, { error: 'Token inválido o vencido' });
                return;
            }
            if (error instanceof PerfilNoEncontrado) {
                responder(res, 404, { error: 'Usuario no encontrado' });
                return;
            }
            if (error instanceof DatosPerfilInvalidos || error instanceof ErrorCuerpoPerfil) {
                responder(res, 400, { error: error.message });
                return;
            }
            console.error('Error al actualizar el perfil:', error);
            responder(res, 500, { error: 'No se pudo actualizar el perfil' });
        }
    };
}
