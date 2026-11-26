import { solicitarJson } from '../../shared/infrastructure/solicitar-json';
import type { Pagina } from '../../shared/domain/pagina';
import type { ApiReportesPropios } from '../application/listar-mis-reportes';
import type { ResumenReporte } from '../domain/resumen-reporte';

export const apiReportesHttp: ApiReportesPropios = {
  listar: (token, pagina) => solicitarJson<Pagina<ResumenReporte>>(`/reportes/mios?pagina=${pagina}`, token),
};
