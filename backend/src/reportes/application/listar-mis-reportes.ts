import type { ResumenReporte } from '../domain/resumen-reporte';
import { paginacion, type Paginacion } from '../../shared/application/paginacion';
import type { VerificadorToken } from '../../usuarios/application/obtener-perfil';
import { TokenInvalido } from '../../usuarios/application/obtener-perfil';

export interface RepositorioReportesPropios {
    listar(usuarioId: number, pagina: number): Promise<{ resultados: ResumenReporte[]; total: number }>;
}

export function crearListarMisReportes(repositorio: RepositorioReportesPropios, tokens: VerificadorToken) {
    return async (token: string, pagina: number): Promise<{ resultados: ResumenReporte[] } & Paginacion> => {
        const identidad = tokens.verificar(token);
        if (!identidad) throw new TokenInvalido();
        const { resultados, total } = await repositorio.listar(identidad.usuarioId, pagina);
        return { resultados, ...paginacion(pagina, total) };
    };
}

export type ListarMisReportes = ReturnType<typeof crearListarMisReportes>;
