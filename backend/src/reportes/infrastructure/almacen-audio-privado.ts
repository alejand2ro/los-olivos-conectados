import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { AlmacenAudioReporte } from '../application/crear-reporte-audio';
import { AudioNoDisponible } from '../domain/detalle-reporte';

const directorio = path.resolve(process.env.REPORTES_AUDIO_DIR || path.join(process.cwd(), 'private-audio'));

function rutaPrivada(referencia: string): string {
    const nombre = referencia.replace(/^privado\/reportes-audio\//, '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.wav$/.test(nombre) ||
        referencia !== `privado/reportes-audio/${nombre}`) throw new AudioNoDisponible();
    return path.join(directorio, nombre);
}

export const almacenAudioPrivado: AlmacenAudioReporte = {
    async guardar(bytes) {
        await mkdir(directorio, { recursive: true, mode: 0o700 });
        const nombre = `${randomUUID()}.wav`;
        const ruta = path.join(directorio, nombre);
        const archivo = await open(ruta, 'wx', 0o600);
        try {
            await archivo.writeFile(bytes);
            await archivo.close();
            return `privado/reportes-audio/${nombre}`;
        } catch (error) {
            await archivo.close().catch(() => {});
            await unlink(ruta).catch(() => {});
            throw error;
        }
    },
    async eliminar(referencia) {
        const nombre = referencia.replace(/^privado\/reportes-audio\//, '');
        if (!/^[0-9a-f-]{36}\.wav$/.test(nombre) || referencia !== `privado/reportes-audio/${nombre}`) {
            throw new Error('Referencia de audio inválida');
        }
        await unlink(rutaPrivada(referencia));
    },
    async leer(referencia) {
        try { return await readFile(rutaPrivada(referencia)); }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new AudioNoDisponible();
            throw error;
        }
    },
};
