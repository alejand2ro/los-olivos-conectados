import { TokenInvalido, type VerificadorToken } from '../../usuarios/application/obtener-perfil';
import type { DetalleReporte, SeguimientoReporte } from '../domain/detalle-reporte';

export interface RepositorioDetalleReporte {
    detalle(usuarioId: number, reporteId: number): Promise<DetalleReporte>;
    seguimiento(usuarioId: number, reporteId: number): Promise<SeguimientoReporte>;
    audio(usuarioId: number, reporteId: number): Promise<string>;
}

export interface LectorAudioPrivado {
    leer(referencia: string): Promise<Buffer>;
}

export function crearConsultarReporte(tokens: VerificadorToken, repositorio: RepositorioDetalleReporte, almacen: LectorAudioPrivado) {
    function identidad(token: string): number {
        const usuario = tokens.verificar(token);
        if (!usuario) throw new TokenInvalido();
        return usuario.usuarioId;
    }
    return {
        detalle: (token: string, id: number) => repositorio.detalle(identidad(token), id),
        seguimiento: (token: string, id: number) => repositorio.seguimiento(identidad(token), id),
        async audio(token: string, id: number) {
            const referencia = await repositorio.audio(identidad(token), id);
            return almacen.leer(referencia);
        },
    };
}

export type ConsultarReporte = ReturnType<typeof crearConsultarReporte>;
