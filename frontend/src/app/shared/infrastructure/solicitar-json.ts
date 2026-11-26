import { environment } from '../../../environments/environment';

const base = environment.apiBaseUrl.replace(/\/$/, '');

export async function solicitarJson<T>(ruta: string, token?: string): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${base}${ruta}`, {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  let contenido: unknown;
  try {
    contenido = await respuesta.json();
  } catch {
    throw new Error('El servidor devolvió una respuesta inesperada.');
  }
  if (!respuesta.ok) {
    const mensaje = typeof contenido === 'object' && contenido !== null && 'error' in contenido &&
      typeof contenido.error === 'string' ? contenido.error : 'No se pudo completar la consulta.';
    throw new Error(mensaje);
  }
  return contenido as T;
}
