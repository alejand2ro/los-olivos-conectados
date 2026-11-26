export interface DatosReporteBase {
  tipo_incidente_id: number;
  zona_id: number;
  latitud: number;
  longitud: number;
  nivel_gravedad_id: number;
}

export interface DatosReporteEscrito extends DatosReporteBase { descripcion_texto: string }
export type DatosReporteAudio = DatosReporteBase;

export interface ReporteCreado {
  id: number;
  estado_codigo: string;
  estado_nombre: string;
  fecha_creacion: string;
}
