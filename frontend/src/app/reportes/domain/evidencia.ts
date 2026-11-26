export type TipoEvidencia = 'foto' | 'video';
export type EstadoEvidencia = 'seleccionado' | 'subiendo' | 'guardado' | 'fallido';

export interface EvidenciaLocal {
  clave: string;
  archivo: File;
  tipo: TipoEvidencia;
  vistaPrevia: string;
  estado: EstadoEvidencia;
  evidenciaId?: number;
  error?: string;
}

export interface EvidenciaGuardada {
  id: number;
  reporte_id: number;
  tipo_archivo: TipoEvidencia;
  url_archivo: string;
}

export const MAX_FOTOS = 4;
export const MAX_VIDEOS = 1;
export const MAX_FOTO_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
