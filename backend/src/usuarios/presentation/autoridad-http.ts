import type { IncomingMessage, ServerResponse } from 'node:http';
import { TokenInvalido } from '../application/obtener-perfil';
import type { AltaAutoridad } from '../application/crear-autoridad';
import { CorreoInternoDuplicado, CuentaInternaInvalida, PermisoInternoDenegado } from '../domain/cuenta-interna';

function json(res: ServerResponse, estado: number, cuerpo: unknown): void {
    res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(cuerpo));
}

async function leerJson(req: IncomingMessage): Promise<unknown> {
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        throw new CuentaInternaInvalida('Se requiere Content-Type: application/json');
    }
    const fragmentos: Buffer[] = [];
    let tamano = 0;
    for await (const fragmento of req) {
        const bytes = Buffer.isBuffer(fragmento) ? fragmento : Buffer.from(fragmento);
        tamano += bytes.length;
        if (tamano > 16 * 1024) throw new CuentaInternaInvalida('El cuerpo JSON es demasiado grande');
        fragmentos.push(bytes);
    }
    try { return JSON.parse(Buffer.concat(fragmentos).toString('utf8')); }
    catch { throw new CuentaInternaInvalida('El cuerpo debe contener JSON válido'); }
}

export function crearResponderAltaAutoridad(alta: AltaAutoridad) {
    return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        const token = req.headers.authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
        if (!token) return json(res, 401, { error: 'Token inválido o vencido' });
        try { json(res, 201, await alta(token, await leerJson(req))); }
        catch (error) {
            if (error instanceof TokenInvalido) return json(res, 401, { error: 'Token inválido o vencido' });
            if (error instanceof PermisoInternoDenegado) return json(res, 403, { error: 'Solo un Administrador puede crear cuentas de Autoridad' });
            if (error instanceof CuentaInternaInvalida) return json(res, 400, { error: error.message });
            if (error instanceof CorreoInternoDuplicado) return json(res, 409, { error: error.message });
            console.error('Error al crear cuenta de Autoridad:', error);
            json(res, 500, { error: 'No se pudo crear la cuenta de Autoridad' });
        }
    };
}
