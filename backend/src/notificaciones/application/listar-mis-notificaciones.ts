import { paginacion, type Paginacion } from '../../shared/application/paginacion';
import { TokenInvalido, type VerificadorToken } from '../../usuarios/application/obtener-perfil';
import type { NotificacionPropia } from '../domain/notificacion';

export interface RepositorioNotificacionesPropias {
    listar(usuarioId: number, pagina: number): Promise<{ resultados: NotificacionPropia[]; total: number }>;
}

export function crearListarMisNotificaciones(repositorio: RepositorioNotificacionesPropias, tokens: VerificadorToken) {
    return async (token: string, pagina: number): Promise<{ resultados: NotificacionPropia[] } & Paginacion> => {
        const identidad = tokens.verificar(token);
        if (!identidad) throw new TokenInvalido();
        const { resultados, total } = await repositorio.listar(identidad.usuarioId, pagina);
        return { resultados, ...paginacion(pagina, total) };
    };
}

export type ListarMisNotificaciones = ReturnType<typeof crearListarMisNotificaciones>;
