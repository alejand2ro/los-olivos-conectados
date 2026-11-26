import type { DetalleReporte, SeguimientoReporte } from '../domain/detalle-reporte';

export interface ApiDetalleReporte {
  detalle(token: string, id: number): Promise<DetalleReporte>;
  seguimiento(token: string, id: number): Promise<SeguimientoReporte>;
  archivo(token: string, ruta: string, signal?: AbortSignal): Promise<Blob>;
}

export function consultarReporte(api: ApiDetalleReporte) {
  return {
    detalle: (token: string, id: number) => api.detalle(token, id),
    seguimiento: (token: string, id: number) => api.seguimiento(token, id),
    archivo: (token: string, ruta: string, signal?: AbortSignal) => api.archivo(token, ruta, signal),
  };
}
