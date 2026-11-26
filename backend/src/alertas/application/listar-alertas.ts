import { paginacion, type Paginacion } from '../../shared/application/paginacion';
import type { AlertaPublica } from '../domain/alerta-publica';

export interface RepositorioAlertasPublicas {
    listar(pagina: number, zonaId: number | null): Promise<{ resultados: AlertaPublica[]; total: number }>;
}

export function crearListarAlertas(repositorio: RepositorioAlertasPublicas) {
    return async (pagina: number, zonaId: number | null): Promise<{ resultados: AlertaPublica[] } & Paginacion> => {
        const { resultados, total } = await repositorio.listar(pagina, zonaId);
        return { resultados, ...paginacion(pagina, total) };
    };
}

export type ListarAlertas = ReturnType<typeof crearListarAlertas>;
