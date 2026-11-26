import type { IncomingMessage, ServerResponse } from 'node:http';
import Busboy from 'busboy';
import { TokenInvalido } from '../../usuarios/application/obtener-perfil';
import type { GuardarEvidencia, LeerEvidencia, EntradaEvidencia } from '../application/guardar-evidencia';
import {
    ArchivoEvidenciaNoDisponible, EvidenciaDemasiadoGrande, EvidenciaInvalida,
    EvidenciaProhibida, LimiteEvidencias, MAX_VIDEO_BYTES, ReporteEvidenciaNoEncontrado,
} from '../domain/evidencia';

function json(res: ServerResponse, estado: number, cuerpo: unknown): void {
    res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(cuerpo));
}

function token(req: IncomingMessage): string | null {
    return req.headers.authorization?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
}

async function leerCarga(req: IncomingMessage): Promise<EntradaEvidencia> {
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'multipart/form-data') {
        throw new EvidenciaInvalida('Se requiere multipart/form-data');
    }
    let parser: ReturnType<typeof Busboy>;
    try { parser = Busboy({ headers: req.headers, limits: {
        fileSize: MAX_VIDEO_BYTES, files: 2, fields: 3, parts: 4, fieldSize: 128,
    } }); }
    catch { throw new EvidenciaInvalida('El cuerpo multipart/form-data es inválido'); }
    return new Promise((resolver, rechazar) => {
        const campos: Record<string, string> = Object.create(null);
        const partes: Buffer[] = [];
        let recibido = false;
        let error: Error | null = null;
        const fallar = (motivo: Error) => { error ??= motivo; };
        parser.on('field', (nombre, valor, info) => {
            if (!['tipo_archivo', 'clave_carga'].includes(nombre) || info.valueTruncated || Object.hasOwn(campos, nombre)) {
                fallar(new EvidenciaInvalida('Campo multipart no permitido, repetido o demasiado grande'));
            } else campos[nombre] = valor;
        });
        parser.on('file', (nombre, archivo) => {
            if (nombre !== 'archivo' || recibido) { fallar(new EvidenciaInvalida('Solo se permite un campo archivo')); archivo.resume(); return; }
            recibido = true;
            archivo.on('data', (parte: Buffer) => { if (!error) partes.push(parte); });
            archivo.on('limit', () => fallar(new EvidenciaDemasiadoGrande('El video supera 20 MiB')));
            archivo.on('error', () => fallar(new EvidenciaInvalida('No se pudo leer el archivo')));
        });
        parser.on('filesLimit', () => fallar(new EvidenciaInvalida('Solo se permite un archivo por petición')));
        parser.on('fieldsLimit', () => fallar(new EvidenciaInvalida('Hay demasiados campos')));
        parser.on('partsLimit', () => fallar(new EvidenciaInvalida('Hay demasiadas partes')));
        parser.on('error', () => fallar(new EvidenciaInvalida('El cuerpo multipart/form-data es inválido')));
        req.on('aborted', () => rechazar(new EvidenciaInvalida('La carga fue interrumpida')));
        req.on('error', () => rechazar(new EvidenciaInvalida('No se pudo leer la carga')));
        parser.on('close', () => error ? rechazar(error) : resolver({
            tipo: campos.tipo_archivo ?? null,
            clave: campos.clave_carga ?? null,
            archivo: recibido ? Buffer.concat(partes) : null,
        }));
        req.pipe(parser);
    });
}

function errorHttp(res: ServerResponse, error: unknown): void {
    if (error instanceof TokenInvalido) return json(res, 401, { error: 'Token inválido o vencido' });
    if (error instanceof EvidenciaProhibida) return json(res, 403, { error: 'No puedes consultar ni adjuntar evidencias a este reporte' });
    if (error instanceof ReporteEvidenciaNoEncontrado || error instanceof ArchivoEvidenciaNoDisponible) {
        return json(res, 404, { error: 'Reporte o evidencia no encontrado' });
    }
    if (error instanceof LimiteEvidencias) return json(res, 409, { error: error.message });
    if (error instanceof EvidenciaDemasiadoGrande) return json(res, 413, { error: error.message });
    if (error instanceof EvidenciaInvalida) return json(res, 400, { error: error.message });
    console.error('Error al gestionar evidencia:', error);
    json(res, 500, { error: 'No se pudo gestionar la evidencia' });
}

export function crearResponderGuardarEvidencia(guardar: GuardarEvidencia) {
    return async (req: IncomingMessage, res: ServerResponse, reporteId: number): Promise<void> => {
        const autorizacion = token(req);
        if (!autorizacion) return json(res, 401, { error: 'Token inválido o vencido' });
        try { json(res, 201, await guardar(autorizacion, reporteId, await leerCarga(req))); }
        catch (error) { errorHttp(res, error); }
    };
}

export function crearResponderLeerEvidencia(leer: LeerEvidencia) {
    return async (req: IncomingMessage, res: ServerResponse, reporteId: number, evidenciaId: number): Promise<void> => {
        const autorizacion = token(req);
        if (!autorizacion) return json(res, 401, { error: 'Token inválido o vencido' });
        try {
            const archivo = await leer(autorizacion, reporteId, evidenciaId);
            res.writeHead(200, {
                'Content-Type': archivo.mime,
                'Content-Length': archivo.bytes.length,
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
                'Content-Disposition': 'inline',
            });
            res.end(archivo.bytes);
        } catch (error) { errorHttp(res, error); }
    };
}
