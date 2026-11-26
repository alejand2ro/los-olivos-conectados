import { solicitarJson } from '../../shared/infrastructure/solicitar-json';
import type { Pagina } from '../../shared/domain/pagina';
import type { ApiAlertasPublicas } from '../application/listar-alertas';
import type { AlertaPublica } from '../domain/alerta-publica';

export const apiAlertasHttp: ApiAlertasPublicas = {
  listar: (pagina, zonaId) => solicitarJson<Pagina<AlertaPublica>>(
    `/alertas?pagina=${pagina}${zonaId === undefined ? '' : `&zona_id=${zonaId}`}`,
  ),
};
