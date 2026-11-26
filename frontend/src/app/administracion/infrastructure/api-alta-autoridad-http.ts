import { environment } from '../../../environments/environment';
import type { ApiAltaAutoridad } from '../application/crear-autoridad';
import type { AutoridadCreada } from '../domain/cuenta-autoridad';

const base = environment.apiBaseUrl.replace(/\/$/, '');

export const apiAltaAutoridadHttp: ApiAltaAutoridad = {
  async crear(token, datos): Promise<AutoridadCreada> {
    let respuesta: Response;
    try {
      respuesta = await fetch(`${base}/usuarios/autoridad`, {
        method: 'POST', cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
    } catch { throw new Error('No se pudo conectar con el servidor.'); }
    let cuerpo: unknown;
    try { cuerpo = await respuesta.json(); }
    catch { throw new Error('El servidor devolvió una respuesta inesperada.'); }
    if (!respuesta.ok) {
      const mensaje = typeof cuerpo === 'object' && cuerpo !== null && 'error' in cuerpo && typeof cuerpo.error === 'string'
        ? cuerpo.error : 'No se pudo crear la cuenta.';
      throw new Error(mensaje);
    }
    if (respuesta.status !== 201 || typeof cuerpo !== 'object' || cuerpo === null ||
        !('id' in cuerpo) || !Number.isSafeInteger(cuerpo.id) || !('rol' in cuerpo) || cuerpo.rol !== 'autoridad') {
      throw new Error('El servidor no confirmó la cuenta de Autoridad.');
    }
    return cuerpo as AutoridadCreada;
  },
};
