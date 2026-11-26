import type { IncomingMessage, ServerResponse } from 'node:http';
import { TokenInvalido } from '../../usuarios/application/obtener-perfil';
import type { ConsultarReporte } from '../application/consultar-reporte';
import { AudioNoDisponible, ReporteAjeno, ReporteNoEncontrado } from '../domain/detalle-reporte';

function json(res: ServerResponse, estado: number, cuerpo: unknown): void {
    res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' });
    res.end(JSON.stringify(cuerpo));
}

function token(req: IncomingMessage): string | null {
    return req.headers.authorization?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
}

function fallar(res: ServerResponse, error: unknown): void {
    if (error instanceof TokenInvalido) return json(res, 401, { error: 'Token inválido o vencido' });
    if (error instanceof ReporteAjeno) return json(res, 403, { error: 'Este reporte pertenece a otra cuenta' });
    if (error instanceof ReporteNoEncontrado || error instanceof AudioNoDisponible) {
        return json(res, 404, { error: 'Reporte o audio no encontrado' });
    }
    console.error('Error al consultar reporte:', error);
    json(res, 500, { error: 'No se pudo consultar el reporte' });
}

export function crearResponderDetalleReporte(consultar: ConsultarReporte) {
    return async (req: IncomingMessage, res: ServerResponse, id: number, tipo: 'detalle' | 'seguimiento' | 'audio') => {
        const autorizacion = token(req);
        if (!autorizacion) return json(res, 401, { error: 'Token inválido o vencido' });
        try {
            if (tipo === 'audio') {
                const bytes = await consultar.audio(autorizacion, id);
                res.writeHead(200, {
                    'Content-Type': 'audio/wav', 'Content-Length': bytes.length,
                    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
                    'Content-Disposition': 'inline',
                });
                res.end(bytes);
            } else if (tipo === 'seguimiento') {
                json(res, 200, await consultar.seguimiento(autorizacion, id));
            } else {
                json(res, 200, await consultar.detalle(autorizacion, id));
            }
        } catch (error) { fallar(res, error); }
    };
}
