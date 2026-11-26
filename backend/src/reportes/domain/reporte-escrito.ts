export interface DatosReporteNormal {
    tipoIncidenteId: number;
    zonaId?: number;
    descripcionTexto?: string;
    descripcionAudioUrl?: string;
    latitud: number;
    longitud: number;
    nivelGravedadId: number;
}

export interface DatosReporteEscrito extends DatosReporteNormal {
    descripcionTexto: string;
}

export interface ReporteCreado {
    id: number;
    estado_codigo: 'recibido';
    estado_nombre: string;
    fecha_creacion: string;
}
