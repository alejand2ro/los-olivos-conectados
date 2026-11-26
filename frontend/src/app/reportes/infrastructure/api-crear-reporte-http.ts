import { environment } from '../../../environments/environment';
import { ErrorCrearReporte, type ApiCrearReporte } from '../application/crear-reporte-escrito';
import type { ReporteCreado } from '../domain/reporte-escrito';

const base = environment.apiBaseUrl.replace(/\/$/, '');

async function confirmarRespuesta(respuesta: Response): Promise<ReporteCreado> {
  let contenido: unknown;
  try { contenido = await respuesta.json(); }
  catch { throw new ErrorCrearReporte(respuesta.status, 'El servidor devolvió una respuesta inesperada.'); }
  if (!respuesta.ok) {
    const mensaje = typeof contenido === 'object' && contenido !== null && 'error' in contenido && typeof contenido.error === 'string'
      ? contenido.error : 'No se pudo crear el reporte.';
    throw new ErrorCrearReporte(respuesta.status, mensaje);
  }
  if (respuesta.status !== 201) throw new ErrorCrearReporte(respuesta.status, 'El servidor no confirmó la creación del reporte.');
  return contenido as ReporteCreado;
}

export const apiCrearReporteHttp: ApiCrearReporte = {
  async crear(token, datos): Promise<ReporteCreado> {
    let respuesta: Response;
    try {
      respuesta = await fetch(`${base}/reportes`, {
        method: 'POST',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
    } catch {
      throw new ErrorCrearReporte(0, 'No se pudo conectar con el servidor. Inténtalo de nuevo.');
    }
    return confirmarRespuesta(respuesta);
  },
  async crearAudio(token, datos, archivo): Promise<ReporteCreado> {
    const cuerpo = new FormData();
    cuerpo.set('tipo_incidente_id', String(datos.tipo_incidente_id));
    cuerpo.set('nivel_gravedad_id', String(datos.nivel_gravedad_id));
    cuerpo.set('zona_id', String(datos.zona_id));
    cuerpo.set('latitud', String(datos.latitud));
    cuerpo.set('longitud', String(datos.longitud));
    cuerpo.set('archivo_descripcion_audio', archivo);
    let respuesta: Response;
    try {
      respuesta = await fetch(`${base}/reportes`, {
        method: 'POST', cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }, body: cuerpo,
      });
    } catch {
      throw new ErrorCrearReporte(0, 'No se pudo conectar con el servidor. Inténtalo de nuevo.');
    }
    return confirmarRespuesta(respuesta);
  },
};
