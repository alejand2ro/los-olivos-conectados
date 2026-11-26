export interface ResumenReporte {
  id: number;
  tipo_incidente: string | null;
  zona_id: number;
  estado_codigo: string;
  estado_nombre: string;
  verificado: boolean;
  es_sos: boolean;
  fecha_creacion: string;
}
