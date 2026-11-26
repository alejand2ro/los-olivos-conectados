export type TipoEvidencia = 'foto' | 'video';

export const MAX_FOTOS = 4;
export const MAX_VIDEOS = 1;
export const MAX_EVIDENCIAS = MAX_FOTOS + MAX_VIDEOS;
export const MAX_FOTO_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_SEGUNDOS = 120;

export interface EvidenciaGuardada {
    id: number;
    reporte_id: number;
    tipo_archivo: TipoEvidencia;
    url_archivo: string;
}

export class EvidenciaInvalida extends Error {}
export class EvidenciaDemasiadoGrande extends Error {}
export class ReporteEvidenciaNoEncontrado extends Error {}
export class EvidenciaProhibida extends Error {}
export class LimiteEvidencias extends Error {}
export class ArchivoEvidenciaNoDisponible extends Error {}

export function validarTamanoEvidencia(tipo: TipoEvidencia, bytes: Buffer): void {
    const maximo = tipo === 'foto' ? MAX_FOTO_BYTES : MAX_VIDEO_BYTES;
    if (bytes.length > maximo) throw new EvidenciaDemasiadoGrande(
        tipo === 'foto' ? 'La fotografía supera 5 MiB' : 'El video supera 20 MiB',
    );
    if (!bytes.length) throw new EvidenciaInvalida('El archivo está vacío');
}
