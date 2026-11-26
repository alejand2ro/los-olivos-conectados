import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import type { AlmacenEvidencias } from '../application/guardar-evidencia';
import { ArchivoEvidenciaNoDisponible, EvidenciaDemasiadoGrande, EvidenciaInvalida, MAX_FOTO_BYTES, MAX_VIDEO_SEGUNDOS } from '../domain/evidencia';

const ejecutar = promisify(execFile);
const ffprobe = (require('ffprobe-static') as { path?: string }).path;
const directorio = path.resolve(process.env.REPORTES_EVIDENCIAS_DIR || path.join(process.cwd(), 'private-evidencias'));
const referenciaValida = /^privado\/evidencias\/[0-9a-f-]{36}-[0-9a-f-]{36}\.(jpg|png|mp4)$/;

async function prepararFoto(bytes: Buffer): Promise<{ bytes: Buffer; extension: 'jpg' | 'png' }> {
    try {
        const opciones = { failOn: 'error' as const, limitInputPixels: 20_000_000 };
        const imagen = sharp(bytes, opciones);
        const metadatos = await imagen.metadata();
        if ((metadatos.format !== 'jpeg' && metadatos.format !== 'png') ||
            !metadatos.width || !metadatos.height || (metadatos.pages ?? 1) !== 1) {
            throw new EvidenciaInvalida('Solo se admiten fotografías JPEG o PNG válidas');
        }
        // Reprocesar elimina metadatos de la foto, incluidos posibles datos de ubicación.
        const salida = metadatos.format === 'jpeg'
            ? await sharp(bytes, opciones).rotate().resize(4096, 4096, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
            : await sharp(bytes, opciones).rotate().resize(4096, 4096, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
        if (salida.length > MAX_FOTO_BYTES) throw new EvidenciaDemasiadoGrande('La fotografía procesada supera 5 MiB');
        return { bytes: salida, extension: metadatos.format === 'jpeg' ? 'jpg' : 'png' };
    } catch (error) {
        if (error instanceof EvidenciaInvalida || error instanceof EvidenciaDemasiadoGrande) throw error;
        throw new EvidenciaInvalida('El archivo no contiene una fotografía JPEG o PNG válida');
    }
}

async function validarVideo(ruta: string, bytes: Buffer): Promise<void> {
    if (bytes.length < 32 || bytes.toString('ascii', 4, 8) !== 'ftyp') {
        throw new EvidenciaInvalida('Se requiere un video MP4 válido');
    }
    if (!ffprobe) throw new Error('No está disponible el analizador de video');
    let salida: string;
    try {
        ({ stdout: salida } = await ejecutar(ffprobe, [
            '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', ruta,
        ], { timeout: 15000, maxBuffer: 1024 * 1024, windowsHide: true }));
    } catch {
        throw new EvidenciaInvalida('El video MP4 no se pudo analizar');
    }
    let informacion: { format?: { format_name?: string; duration?: string }; streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; nb_read_frames?: string }> };
    try { informacion = JSON.parse(salida); }
    catch { throw new EvidenciaInvalida('El video MP4 no se pudo analizar'); }
    const duracion = Number(informacion.format?.duration);
    if (!informacion.format?.format_name?.includes('mp4') || !Number.isFinite(duracion) ||
        duracion <= 0 || duracion > MAX_VIDEO_SEGUNDOS ||
        !informacion.streams?.some((pista) => pista.codec_type === 'video' && pista.codec_name === 'h264' &&
            (pista.width ?? 0) > 0 && (pista.height ?? 0) > 0 && Number(pista.nb_read_frames) > 0)) {
        throw new EvidenciaInvalida('Se requiere MP4 con video H.264 de hasta 120 segundos');
    }
}

async function escribirPrivado(ruta: string, bytes: Buffer): Promise<void> {
    const archivo = await open(ruta, 'wx', 0o600);
    try { await archivo.writeFile(bytes); await archivo.close(); }
    catch (error) {
        await archivo.close().catch(() => {});
        await unlink(ruta).catch(() => {});
        throw error;
    }
}

export const almacenEvidenciasPrivado: AlmacenEvidencias = {
    async guardar(bytes, tipo, clave) {
        const foto = tipo === 'foto' ? await prepararFoto(bytes) : null;
        const contenido = foto?.bytes ?? bytes;
        const extension = foto?.extension ?? 'mp4';
        await mkdir(directorio, { recursive: true, mode: 0o700 });
        const nombre = `${clave}-${randomUUID()}.${extension}`;
        const ruta = path.join(directorio, nombre);
        await escribirPrivado(ruta, contenido);
        try {
            if (tipo === 'video') await validarVideo(ruta, bytes);
            return `privado/evidencias/${nombre}`;
        } catch (error) {
            await unlink(ruta).catch(() => {});
            throw error;
        }
    },
    async eliminar(referencia) {
        if (!referenciaValida.test(referencia)) throw new Error('Referencia de evidencia inválida');
        await unlink(path.join(directorio, path.basename(referencia)));
    },
    async leer(referencia) {
        if (!referenciaValida.test(referencia)) throw new ArchivoEvidenciaNoDisponible();
        const extension = path.extname(referencia);
        const mime = extension === '.jpg' ? 'image/jpeg' : extension === '.png' ? 'image/png' : 'video/mp4';
        try { return { bytes: await readFile(path.join(directorio, path.basename(referencia))), mime }; }
        catch { throw new ArchivoEvidenciaNoDisponible(); }
    },
};
