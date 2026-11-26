import type { CatalogosRegistro, PerfilPropio } from '../../inicio/domain/acceso';
import type { Pagina } from '../../shared/domain/pagina';
import type { ResumenReporte } from '../../reportes/domain/resumen-reporte';
import type { AlertaPublica } from '../../alertas/domain/alerta-publica';

export interface FuentesDashboard {
  catalogos(): Promise<CatalogosRegistro>;
  reportes(): Promise<Pagina<ResumenReporte>>;
  alertas(zonaId: number): Promise<Pagina<AlertaPublica>>;
}

export interface ResumenDashboard {
  zonaNombre: string | null;
  zonaError: boolean;
  ultimoReporte: ResumenReporte | null;
  reportesError: boolean;
  actividad: AlertaPublica[];
  alertasError: boolean;
}

export function crearCargarDashboard(fuentes: FuentesDashboard) {
  return async (perfil: PerfilPropio): Promise<ResumenDashboard> => {
    const [catalogos, reportes, alertas] = await Promise.allSettled([
      fuentes.catalogos(),
      fuentes.reportes(),
      perfil.zona_id === null ? Promise.resolve(null) : fuentes.alertas(perfil.zona_id),
    ]);
    return {
      zonaNombre: catalogos.status === 'fulfilled'
        ? catalogos.value.zonas.find((zona) => zona.id === perfil.zona_id)?.nombre ?? null : null,
      zonaError: catalogos.status === 'rejected',
      ultimoReporte: reportes.status === 'fulfilled' ? reportes.value.resultados[0] ?? null : null,
      reportesError: reportes.status === 'rejected',
      actividad: alertas.status === 'fulfilled' ? alertas.value?.resultados.slice(0, 3) ?? [] : [],
      alertasError: alertas.status === 'rejected',
    };
  };
}
