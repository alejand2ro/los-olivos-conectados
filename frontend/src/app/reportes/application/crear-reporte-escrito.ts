import type { DatosReporteAudio, DatosReporteEscrito, ReporteCreado } from '../domain/reporte-escrito';

export class ErrorCrearReporte extends Error {
  constructor(readonly estado: number, mensaje: string) { super(mensaje); }
}

export interface ApiCrearReporte {
  crear(token: string, datos: DatosReporteEscrito): Promise<ReporteCreado>;
  crearAudio(token: string, datos: DatosReporteAudio, archivo: File): Promise<ReporteCreado>;
}

export function crearReporteEscrito(api: ApiCrearReporte) {
  return (token: string, datos: DatosReporteEscrito) => api.crear(token, datos);
}

export function crearReporteConAudio(api: ApiCrearReporte) {
  return (token: string, datos: DatosReporteAudio, archivo: File) => api.crearAudio(token, datos, archivo);
}
