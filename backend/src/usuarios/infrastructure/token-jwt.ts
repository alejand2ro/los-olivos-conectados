import jwt from 'jsonwebtoken';
import type { EmisorToken } from '../application/iniciar-sesion';

const EMISOR = 'los-olivos-conectados';
const AUDIENCIA = 'los-olivos-conectados-api';

function claveJwt(): string {
    const clave = process.env.JWT_SECRET;
    if (!clave || Buffer.byteLength(clave, 'utf8') < 32) {
        throw new Error('JWT_SECRET debe contener al menos 32 bytes y estar definida en el entorno');
    }
    return clave;
}

export const emisorTokenJwt: EmisorToken = {
    emitir(usuarioId) {
        return jwt.sign({}, claveJwt(), {
            algorithm: 'HS256',
            subject: String(usuarioId),
            issuer: EMISOR,
            audience: AUDIENCIA,
            expiresIn: '1h',
        });
    },
};

// Lista para reutilizarse al añadir rutas protegidas; aún no autentica ninguna ruta.
export function verificarToken(token: string): { usuarioId: number } | null {
    try {
        const contenido = jwt.verify(token, claveJwt(), {
            algorithms: ['HS256'],
            issuer: EMISOR,
            audience: AUDIENCIA,
        });
        if (typeof contenido === 'string' || typeof contenido.sub !== 'string') return null;
        const usuarioId = Number(contenido.sub);
        if (!Number.isSafeInteger(usuarioId) || usuarioId < 1) return null;
        return { usuarioId };
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) return null;
        throw error;
    }
}
