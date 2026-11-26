import type { Pagina } from '../../shared/domain/pagina';
import type { NotificacionPropia } from '../domain/notificacion';

export interface ApiNotificaciones {
  listar(token: string, pagina: number): Promise<Pagina<NotificacionPropia>>;
}

export function crearListarMisNotificaciones(api: ApiNotificaciones) {
  return (token: string, pagina = 1) => api.listar(token, pagina);
}
