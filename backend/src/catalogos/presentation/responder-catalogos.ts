import type { ServerResponse } from 'node:http';
import type { ObtenerCatalogos } from '../application/obtener-catalogos';

export function crearResponderCatalogos(obtenerCatalogos: ObtenerCatalogos) {
    return async (res: ServerResponse): Promise<void> => {
        try {
            const catalogos = await obtenerCatalogos();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(catalogos));
        } catch (error) {
            console.error('Error al consultar los catálogos:', error);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'No se pudieron consultar los catálogos' }));
        }
    };
}
