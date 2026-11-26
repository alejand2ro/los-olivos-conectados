import { environment } from '../../../environments/environment';
import { solicitarJson } from '../../shared/infrastructure/solicitar-json';
import type { ApiDetalleReporte } from '../application/consultar-reporte';
import type { DetalleReporte, SeguimientoReporte } from '../domain/detalle-reporte';

const base = environment.apiBaseUrl.replace(/\/$/, '');

export const apiDetalleReporteHttp: ApiDetalleReporte = {
  detalle: (token, id) => solicitarJson<DetalleReporte>(`/reportes/${id}`, token),
  seguimiento: (token, id) => solicitarJson<SeguimientoReporte>(`/reportes/${id}/estado`, token),
  async archivo(token, ruta, signal) {
    if (!/^\/reportes\/[1-9]\d*(?:\/audio|\/evidencias\/[1-9]\d*\/archivo)$/.test(ruta)) {
      throw new Error('La referencia del archivo no es válida.');
    }
    let respuesta: Response;
    try {
      respuesta = await fetch(`${base}${ruta}`, {
        cache: 'no-store', signal, headers: { Authorization: `Bearer ${token}` },
      });
    } catch { throw new Error('No se pudo conectar para consultar el archivo.'); }
    if (!respuesta.ok) throw new Error(respuesta.status === 401 ? 'La sesión venció.' : 'No se pudo abrir el archivo.');
    return respuesta.blob();
  },
};
