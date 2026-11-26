import { environment } from '../../../environments/environment';
import { ErrorApi, type ApiAcceso } from '../application/acceso';

const base = environment.apiBaseUrl.replace(/\/$/, '');

async function solicitar<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${base}${ruta}`, { cache: 'no-store', ...opciones });
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor. Inténtalo de nuevo.');
  }
  let contenido: unknown;
  try {
    contenido = await respuesta.json();
  } catch {
    throw new ErrorApi(respuesta.status, 'El servidor devolvió una respuesta inesperada.');
  }
  if (!respuesta.ok) {
    const mensaje = typeof contenido === 'object' && contenido !== null && 'error' in contenido &&
      typeof contenido.error === 'string' ? contenido.error : 'No se pudo completar la solicitud.';
    throw new ErrorApi(respuesta.status, mensaje);
  }
  return contenido as T;
}

export const apiAccesoHttp: ApiAcceso = {
  catalogos: () => solicitar('/catalogos'),
  login: (credenciales) => solicitar('/usuarios/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credenciales),
  }),
  registro: (datos) => solicitar('/usuarios/registro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  }),
  perfil: (token) => solicitar('/usuarios/perfil', {
    headers: { Authorization: `Bearer ${token}` },
  }),
  actualizarPerfil: (token, cambios) => solicitar('/usuarios/perfil', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cambios),
  }),
};
