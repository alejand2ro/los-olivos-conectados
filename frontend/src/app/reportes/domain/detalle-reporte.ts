export interface EvidenciaRemota {
  id: number;
  tipo_archivo: 'foto' | 'video';
  url_archivo: string;
  fecha_subida: string;
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
  fecha_creacion: string;
  evidencias: EvidenciaRemota[];
}

export interface SeguimientoReporte {
  estado_codigo: string;
  estado_nombre: string;
  historial: { estado_codigo: string; estado_nombre: string; fecha: string; comentario: string | null }[];
}
