import { environment } from '../../../environments/environment';
import { ErrorEvidencia, type ApiEvidencias } from '../application/subir-evidencia';
import type { EvidenciaGuardada } from '../domain/evidencia';

const base = environment.apiBaseUrl.replace(/\/$/, '');

export const apiEvidenciasHttp: ApiEvidencias = {
  async subir(token, reporteId, tipo, clave, archivo): Promise<EvidenciaGuardada> {
    const cuerpo = new FormData();
    cuerpo.set('tipo_archivo', tipo);
    cuerpo.set('clave_carga', clave);
    cuerpo.set('archivo', archivo);
    let respuesta: Response;
    try {
      respuesta = await fetch(`${base}/reportes/${reporteId}/evidencias`, {
        method: 'POST', cache: 'no-store', headers: { Authorization: `Bearer ${token}` }, body: cuerpo,
      });
    } catch { throw new ErrorEvidencia(0, 'No se pudo conectar con el servidor para subir el archivo.'); }
    let contenido: unknown;
    try { contenido = await respuesta.json(); }
    catch { throw new ErrorEvidencia(respuesta.status, 'El servidor devolvió una respuesta inesperada.'); }
    if (!respuesta.ok) {
      const mensaje = typeof contenido === 'object' && contenido !== null && 'error' in contenido && typeof contenido.error === 'string'
        ? contenido.error : 'No se pudo guardar el archivo.';
      throw new ErrorEvidencia(respuesta.status, mensaje);
    }
    if (respuesta.status !== 201) throw new ErrorEvidencia(respuesta.status, 'El servidor no confirmó el archivo.');
    if (typeof contenido !== 'object' || contenido === null ||
      !('id' in contenido) || !Number.isSafeInteger(contenido.id) || Number(contenido.id) < 1 ||
      !('reporte_id' in contenido) || contenido.reporte_id !== reporteId ||
      !('tipo_archivo' in contenido) || (contenido.tipo_archivo !== 'foto' && contenido.tipo_archivo !== 'video') ||
      !('url_archivo' in contenido) || typeof contenido.url_archivo !== 'string' ||
      !contenido.url_archivo.startsWith(`/reportes/${reporteId}/evidencias/`)) {
      throw new ErrorEvidencia(201, 'El servidor no confirmó los datos del archivo.');
    }
    return contenido as EvidenciaGuardada;
  },
};
