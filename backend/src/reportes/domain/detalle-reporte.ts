export interface EvidenciaDetalle {
    id: number;
    tipo_archivo: 'foto' | 'video';
    url_archivo: string;
    fecha_subida: Date;
}

export interface DetalleReporte {
    id: number;
    tipo_incidente: string | null;
    zona_id: number;
    zona_nombre: string;
    descripcion_texto: string | null;
    descripcion_audio_url: string | null;
    latitud: number;
    longitud: number;
    nivel_gravedad: string;
    estado_codigo: string;
    estado_nombre: string;
    verificado: boolean;
    es_sos: boolean;
    fecha_creacion: Date;
    evidencias: EvidenciaDetalle[];
}

export interface CambioEstado {
    estado_codigo: string;
    estado_nombre: string;
    fecha: Date;
    comentario: string | null;
}

export interface SeguimientoReporte {
    estado_codigo: string;
    estado_nombre: string;
    historial: CambioEstado[];
}

export class ReporteNoEncontrado extends Error {}
export class ReporteAjeno extends Error {}
export class AudioNoDisponible extends Error {}
