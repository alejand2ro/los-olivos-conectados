import type { IncomingMessage, ServerResponse } from 'node:http';
import { AutorReporteNoEncontrado, DatosReporteInvalidos, type CrearReporteEscrito } from '../application/crear-reporte-escrito';
import { TokenInvalido } from '../../usuarios/application/obtener-perfil';
import Busboy from 'busboy';
import { AudioDemasiadoGrande, AudioInvalido, MAX_AUDIO_BYTES } from '../domain/audio-reporte';
import type { CrearReporteAudio, EntradaReporteAudio } from '../application/crear-reporte-audio';

function responder(res: ServerResponse, estado: number, cuerpo: unknown): void {
    res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(cuerpo));
}

async function leerJson(req: IncomingMessage): Promise<unknown> {
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        throw new DatosReporteInvalidos('Se requiere Content-Type: application/json para la descripción escrita');
    }
    const fragmentos: Buffer[] = [];
    let tamano = 0;
    for await (const fragmento of req) {
        const bytes = Buffer.isBuffer(fragmento) ? fragmento : Buffer.from(fragmento);
        tamano += bytes.length;
        if (tamano > 64 * 1024) throw new DatosReporteInvalidos('El cuerpo JSON es demasiado grande');
        fragmentos.push(bytes);
    }
    try {
        return JSON.parse(Buffer.concat(fragmentos).toString('utf8'));
    } catch {
        throw new DatosReporteInvalidos('El cuerpo debe contener JSON válido');
    }
}

async function leerMultipart(req: IncomingMessage): Promise<EntradaReporteAudio> {
    let parser: ReturnType<typeof Busboy>;
    try {
        parser = Busboy({ headers: req.headers, limits: {
            fileSize: MAX_AUDIO_BYTES, files: 2, fields: 7, parts: 8, fieldSize: 8 * 1024,
        } });
    } catch {
        throw new DatosReporteInvalidos('El cuerpo multipart/form-data es inválido');
    }
    return new Promise((resolver, rechazar) => {
        const campos: Record<string, string> = Object.create(null);
        const partes: Buffer[] = [];
        let archivoRecibido = false;
        let error: Error | null = null;
        const fallar = (motivo: Error) => { error ??= motivo; };
        parser.on('field', (nombre, valor, info) => {
            if (info.valueTruncated || Object.hasOwn(campos, nombre)) fallar(new DatosReporteInvalidos('Campo multipart repetido o demasiado grande'));
            else campos[nombre] = valor;
        });
        parser.on('file', (nombre, archivo) => {
            if (nombre !== 'archivo_descripcion_audio' || archivoRecibido) {
                fallar(new DatosReporteInvalidos('Solo se permite archivo_descripcion_audio'));
                archivo.resume();
                return;
            }
            archivoRecibido = true;
            archivo.on('data', (parte: Buffer) => { if (!error) partes.push(parte); });
            archivo.on('limit', () => fallar(new AudioDemasiadoGrande('El audio supera 3 MiB')));
            archivo.on('error', () => fallar(new DatosReporteInvalidos('No se pudo leer el audio')));
        });
        parser.on('filesLimit', () => fallar(new DatosReporteInvalidos('Solo se permite un archivo de audio')));
        parser.on('fieldsLimit', () => fallar(new DatosReporteInvalidos('Hay demasiados campos')));
        parser.on('partsLimit', () => fallar(new DatosReporteInvalidos('Hay demasiadas partes')));
        parser.on('error', () => fallar(new DatosReporteInvalidos('El cuerpo multipart/form-data es inválido')));
        req.on('aborted', () => rechazar(new DatosReporteInvalidos('La carga de audio fue interrumpida')));
        req.on('error', () => rechazar(new DatosReporteInvalidos('No se pudo leer la carga de audio')));
        parser.on('close', () => {
            if (error) return rechazar(error);
            resolver({ campos, archivo: archivoRecibido ? Buffer.concat(partes) : null });
        });
        req.pipe(parser);
    });
}

export function crearResponderReporte(crearEscrito: CrearReporteEscrito, crearAudio: CrearReporteAudio) {
    return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        const autorizacion = req.headers.authorization?.match(/^Bearer\s+(\S+)$/i);
        if (!autorizacion) return responder(res, 401, { error: 'Token inválido o vencido' });
        try {
            const tipo = req.headers['content-type']?.split(';')[0].trim().toLowerCase();
            if (tipo === 'multipart/form-data') {
                return responder(res, 201, await crearAudio(autorizacion[1], await leerMultipart(req)));
            }
            responder(res, 201, await crearEscrito(autorizacion[1], await leerJson(req)));
        } catch (error) {
            if (error instanceof TokenInvalido) return responder(res, 401, { error: 'Token inválido o vencido' });
            if (error instanceof AutorReporteNoEncontrado) return responder(res, 404, { error: 'Usuario no encontrado' });
            if (error instanceof AudioDemasiadoGrande) return responder(res, 413, { error: error.message });
            if (error instanceof AudioInvalido) return responder(res, 415, { error: error.message });
            if (error instanceof DatosReporteInvalidos) return responder(res, 400, { error: error.message });
            console.error('Error al crear reporte:', error);
            responder(res, 500, { error: 'No se pudo crear el reporte' });
        }
    };
}
