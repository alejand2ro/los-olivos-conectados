import type { IncomingMessage, ServerResponse } from 'node:http';
import { leerPagina, ParametroPaginacionInvalido } from '../../shared/application/paginacion';
import type { ListarAlertas } from '../application/listar-alertas';

function responder(res: ServerResponse, estado: number, cuerpo: unknown): void {
    res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(cuerpo));
}

export function crearResponderAlertas(listar: ListarAlertas) {
    return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        try {
            const url = new URL(req.url ?? '/', 'http://localhost');
            if ([...url.searchParams.keys()].some((clave) => clave !== 'pagina' && clave !== 'zona_id')) {
                return responder(res, 400, { error: 'Parámetro de consulta no permitido' });
            }
            const pagina = leerPagina(url.searchParams.get('pagina'));
            const zonaTexto = url.searchParams.get('zona_id');
            let zonaId: number | null = null;
            if (zonaTexto !== null && zonaTexto !== '') {
                if (!/^[1-9]\d*$/.test(zonaTexto)) throw new ParametroPaginacionInvalido();
                zonaId = Number(zonaTexto);
                if (!Number.isSafeInteger(zonaId) || zonaId > 2147483647) throw new ParametroPaginacionInvalido();
            }
            responder(res, 200, await listar(pagina, zonaId));
        } catch (error) {
            if (error instanceof ParametroPaginacionInvalido) return responder(res, 400, { error: 'pagina y zona_id deben ser enteros positivos' });
            console.error('Error al consultar alertas:', error);
            responder(res, 500, { error: 'No se pudieron consultar las alertas' });
        }
    };
}
