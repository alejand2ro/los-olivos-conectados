import type { DatosReporteEscrito, DatosReporteNormal, ReporteCreado } from '../domain/reporte-escrito';
import { TokenInvalido, type VerificadorToken } from '../../usuarios/application/obtener-perfil';

export class DatosReporteInvalidos extends Error {}
export class AutorReporteNoEncontrado extends Error {}

export interface RepositorioCreacionReporte {
    crear(usuarioId: number, datos: DatosReporteNormal): Promise<ReporteCreado>;
}

function enteroPositivo(valor: unknown): valor is number {
    return typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0;
}

function validarEntrada(entrada: unknown): DatosReporteEscrito {
    if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
        throw new DatosReporteInvalidos('El cuerpo debe ser un objeto JSON');
    }
    const datos = entrada as Record<string, unknown>;
    const campos = new Set(['tipo_incidente_id', 'zona_id', 'descripcion_texto', 'latitud', 'longitud', 'nivel_gravedad_id']);
    if (Object.keys(datos).some((campo) => !campos.has(campo))) {
        throw new DatosReporteInvalidos('El reporte contiene campos no permitidos');
    }
    if (!enteroPositivo(datos.tipo_incidente_id)) {
        throw new DatosReporteInvalidos('tipo_incidente_id debe ser un entero positivo');
    }
    if (!enteroPositivo(datos.nivel_gravedad_id)) {
        throw new DatosReporteInvalidos('nivel_gravedad_id debe ser un entero positivo');
    }
    if (datos.zona_id !== undefined && !enteroPositivo(datos.zona_id)) {
        throw new DatosReporteInvalidos('zona_id debe ser un entero positivo');
    }
    const descripcionTexto = typeof datos.descripcion_texto === 'string' ? datos.descripcion_texto.trim() : '';
    if (!descripcionTexto) {
        throw new DatosReporteInvalidos('La descripción escrita es obligatoria');
    }
    if (typeof datos.latitud !== 'number' || !Number.isFinite(datos.latitud) || datos.latitud < -90 || datos.latitud > 90 ||
        typeof datos.longitud !== 'number' || !Number.isFinite(datos.longitud) || datos.longitud < -180 || datos.longitud > 180) {
        throw new DatosReporteInvalidos('Las coordenadas reales deben ser números válidos dentro de sus rangos');
    }
    return {
        tipoIncidenteId: datos.tipo_incidente_id,
        ...(datos.zona_id !== undefined ? { zonaId: datos.zona_id } : {}),
        descripcionTexto,
        latitud: datos.latitud,
        longitud: datos.longitud,
        nivelGravedadId: datos.nivel_gravedad_id,
    };
}

export function crearReporteEscrito(repositorio: RepositorioCreacionReporte, tokens: VerificadorToken) {
    return async (token: string, entrada: unknown): Promise<ReporteCreado> => {
        const identidad = tokens.verificar(token);
        if (!identidad) throw new TokenInvalido();
        return repositorio.crear(identidad.usuarioId, validarEntrada(entrada));
    };
}

export type CrearReporteEscrito = ReturnType<typeof crearReporteEscrito>;
