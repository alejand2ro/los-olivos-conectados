import { TokenInvalido, type VerificadorToken } from '../../usuarios/application/obtener-perfil';
import {
    EvidenciaInvalida, validarTamanoEvidencia, type EvidenciaGuardada, type TipoEvidencia,
} from '../domain/evidencia';

export interface AlmacenEvidencias {
    guardar(bytes: Buffer, tipo: TipoEvidencia, clave: string): Promise<string>;
    eliminar(referencia: string): Promise<void>;
    leer(referencia: string): Promise<{ bytes: Buffer; mime: string }>;
}

export interface RepositorioEvidencias {
    registrar(usuarioId: number, reporteId: number, tipo: TipoEvidencia, clave: string, referencia: string): Promise<{ id: number; tipo: TipoEvidencia; duplicado: boolean }>;
    consultar(usuarioId: number, reporteId: number, evidenciaId: number): Promise<{ referencia: string; tipo: TipoEvidencia }>;
}

export interface EntradaEvidencia {
    tipo: string | null;
    clave: string | null;
    archivo: Buffer | null;
}

function idPositivo(valor: number): boolean { return Number.isSafeInteger(valor) && valor > 0; }

export function crearGuardarEvidencia(tokens: VerificadorToken, repositorio: RepositorioEvidencias, almacen: AlmacenEvidencias) {
    return async (token: string, reporteId: number, entrada: EntradaEvidencia): Promise<EvidenciaGuardada> => {
        const identidad = tokens.verificar(token);
        if (!identidad) throw new TokenInvalido();
        if (!idPositivo(reporteId)) throw new EvidenciaInvalida('El ID del reporte es inválido');
        if (entrada.tipo !== 'foto' && entrada.tipo !== 'video') throw new EvidenciaInvalida('tipo_archivo debe ser foto o video');
        if (!entrada.clave || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entrada.clave)) {
            throw new EvidenciaInvalida('clave_carga debe ser un UUID');
        }
        if (!entrada.archivo) throw new EvidenciaInvalida('Falta el archivo');
        validarTamanoEvidencia(entrada.tipo, entrada.archivo);
        const referencia = await almacen.guardar(entrada.archivo, entrada.tipo, entrada.clave.toLowerCase());
        try {
            const resultado = await repositorio.registrar(identidad.usuarioId, reporteId, entrada.tipo, entrada.clave.toLowerCase(), referencia);
            if (resultado.duplicado) await almacen.eliminar(referencia);
            return {
                id: resultado.id,
                reporte_id: reporteId,
                tipo_archivo: resultado.tipo,
                url_archivo: `/reportes/${reporteId}/evidencias/${resultado.id}/archivo`,
            };
        } catch (error) {
            await almacen.eliminar(referencia).catch((limpieza) => console.error('No se pudo limpiar una evidencia fallida:', limpieza));
            throw error;
        }
    };
}

export function crearLeerEvidencia(tokens: VerificadorToken, repositorio: RepositorioEvidencias, almacen: AlmacenEvidencias) {
    return async (token: string, reporteId: number, evidenciaId: number) => {
        const identidad = tokens.verificar(token);
        if (!identidad) throw new TokenInvalido();
        if (!idPositivo(reporteId) || !idPositivo(evidenciaId)) throw new EvidenciaInvalida('ID de evidencia inválido');
        const evidencia = await repositorio.consultar(identidad.usuarioId, reporteId, evidenciaId);
        return almacen.leer(evidencia.referencia);
    };
}

export type GuardarEvidencia = ReturnType<typeof crearGuardarEvidencia>;
export type LeerEvidencia = ReturnType<typeof crearLeerEvidencia>;
