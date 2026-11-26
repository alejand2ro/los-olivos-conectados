import type { Pagina } from '../../shared/domain/pagina';
import type { AlertaPublica } from '../domain/alerta-publica';

export interface ApiAlertasPublicas {
  listar(pagina: number, zonaId?: number): Promise<Pagina<AlertaPublica>>;
}

export function crearListarAlertas(api: ApiAlertasPublicas) {
  return (pagina = 1, zonaId?: number) => api.listar(pagina, zonaId);
}
