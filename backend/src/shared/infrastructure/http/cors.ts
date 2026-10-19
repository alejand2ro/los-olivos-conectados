import type { IncomingMessage, ServerResponse } from 'node:http';

const ORIGEN_PERMITIDO = 'http://localhost:8100';

// Devuelve true si la petición era un "preflight" (OPTIONS) y ya fue respondida
export function aplicarCors(req: IncomingMessage, res: ServerResponse): boolean {
    res.setHeader('Access-Control-Allow-Origin', ORIGEN_PERMITIDO);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return true;
    }
    return false;
}