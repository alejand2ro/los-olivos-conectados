import type { IncomingMessage, ServerResponse } from 'node:http';
import { PerfilNoEncontrado, TokenInvalido, type ObtenerPerfil } from '../application/obtener-perfil';

function responder(res: ServerResponse, estado: number, cuerpo: unknown): void {
    res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(cuerpo));
}

export function crearResponderPerfil(obtenerPerfil: ObtenerPerfil) {
    return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        const autorizacion = req.headers.authorization?.match(/^Bearer\s+(\S+)$/i);
        if (!autorizacion) {
            responder(res, 401, { error: 'Token inválido o vencido' });
            return;
        }
        try {
            responder(res, 200, await obtenerPerfil(autorizacion[1]));
        } catch (error) {
            if (error instanceof TokenInvalido) {
                responder(res, 401, { error: 'Token inválido o vencido' });
                return;
            }
            if (error instanceof PerfilNoEncontrado) {
                responder(res, 404, { error: 'Usuario no encontrado' });
                return;
            }
            console.error('Error al consultar el perfil:', error);
            responder(res, 500, { error: 'No se pudo consultar el perfil' });
        }
    };
}
