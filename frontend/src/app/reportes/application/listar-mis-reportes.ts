import type { Pagina } from '../../shared/domain/pagina';
import type { ResumenReporte } from '../domain/resumen-reporte';

export interface ApiReportesPropios {
  listar(token: string, pagina: number): Promise<Pagina<ResumenReporte>>;
}

export function crearListarMisReportes(api: ApiReportesPropios) {
  return (token: string, pagina = 1) => api.listar(token, pagina);
}
