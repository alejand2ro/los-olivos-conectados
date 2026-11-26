import type { AutoridadCreada, NuevaAutoridad } from '../domain/cuenta-autoridad';

export interface ApiAltaAutoridad {
  crear(token: string, datos: NuevaAutoridad): Promise<AutoridadCreada>;
}

export function crearAltaAutoridad(api: ApiAltaAutoridad) {
  return (token: string, datos: NuevaAutoridad) => api.crear(token, datos);
}
