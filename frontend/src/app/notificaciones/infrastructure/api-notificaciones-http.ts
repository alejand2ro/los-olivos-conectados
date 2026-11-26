import { solicitarJson } from '../../shared/infrastructure/solicitar-json';
import type { ApiNotificaciones } from '../application/listar-mis-notificaciones';
import type { NotificacionPropia } from '../domain/notificacion';
import type { Pagina } from '../../shared/domain/pagina';

export const apiNotificacionesHttp: ApiNotificaciones = {
  listar: (token, pagina) => solicitarJson<Pagina<NotificacionPropia>>(`/notificaciones/mias?pagina=${pagina}`, token),
};
