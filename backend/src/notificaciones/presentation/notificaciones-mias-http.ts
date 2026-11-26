import type { IncomingMessage, ServerResponse } from 'node:http';
import { leerPagina, ParametroPaginacionInvalido } from '../../shared/application/paginacion';
import { TokenInvalido } from '../../usuarios/application/obtener-perfil';
import type { ListarMisNotificaciones } from '../application/listar-mis-notificaciones';

function responder(res: ServerResponse, estado: number, cuerpo: unknown): void {
    res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(cuerpo));
}

export function crearResponderMisNotificaciones(listar: ListarMisNotificaciones) {
    return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        const autorizacion = req.headers.authorization?.match(/^Bearer\s+(\S+)$/i);
        if (!autorizacion) return responder(res, 401, { error: 'Token inválido o vencido' });
        try {
            const url = new URL(req.url ?? '/', 'http://localhost');
            if ([...url.searchParams.keys()].some((clave) => clave !== 'pagina')) {
                return responder(res, 400, { error: 'Parámetro de consulta no permitido' });
            }
            responder(res, 200, await listar(autorizacion[1], leerPagina(url.searchParams.get('pagina'))));
        } catch (error) {
            if (error instanceof ParametroPaginacionInvalido) return responder(res, 400, { error: 'pagina debe ser un entero positivo' });
            if (error instanceof TokenInvalido) return responder(res, 401, { error: 'Token inválido o vencido' });
            console.error('Error al consultar notificaciones propias:', error);
            responder(res, 500, { error: 'No se pudieron consultar tus notificaciones' });
        }
    };
}
