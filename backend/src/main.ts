import http from 'node:http';
import { env } from './shared/config/env';
import { verificarConexion } from './shared/infrastructure/database/postgres';
import { aplicarCors } from './shared/infrastructure/http/cors';

function responderJson(res: http.ServerResponse, estado: number, cuerpo: unknown) {
    res.writeHead(estado, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cuerpo));
}

async function iniciar() {
    await verificarConexion();

    const servidor = http.createServer((req, res) => {
        if (aplicarCors(req, res)) return;

        if (req.method === 'GET' && req.url === '/salud') {
            return responderJson(res, 200, { estado: 'ok' });
        }
        responderJson(res, 404, { error: 'Ruta no encontrada' });
    });

    servidor.listen(env.PUERTO, () => {
        console.log(`Servidor escuchando en http://localhost:${env.PUERTO}`);
    });
}

iniciar().catch((error) => {
    console.error('No se pudo iniciar el backend:', error);
    process.exit(1);
});