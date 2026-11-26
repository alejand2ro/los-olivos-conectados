import { TokenInvalido, type VerificadorToken } from '../../usuarios/application/obtener-perfil';
import { validarAudioWav } from '../domain/audio-reporte';
import type { DatosReporteNormal, ReporteCreado } from '../domain/reporte-escrito';
import { DatosReporteInvalidos, type RepositorioCreacionReporte } from './crear-reporte-escrito';

export interface AlmacenAudioReporte {
    guardar(bytes: Buffer): Promise<string>;
    eliminar(referencia: string): Promise<void>;
    leer(referencia: string): Promise<Buffer>;
}

export interface EntradaReporteAudio {
    campos: Record<string, string>;
    archivo: Buffer | null;
}

function enteroPositivo(valor: string | undefined, nombre: string): number {
    if (!valor || !/^[1-9]\d*$/.test(valor) || !Number.isSafeInteger(Number(valor))) {
        throw new DatosReporteInvalidos(`${nombre} debe ser un entero positivo`);
    }
    return Number(valor);
}

function coordenada(valor: string | undefined, nombre: string, minimo: number, maximo: number): number {
    if (!valor || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(valor.trim())) {
        throw new DatosReporteInvalidos(`${nombre} debe ser una coordenada válida`);
    }
    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero < minimo || numero > maximo) {
        throw new DatosReporteInvalidos(`${nombre} debe estar dentro de su rango`);
    }
    return numero;
}

function validarCampos(campos: Record<string, string>): Omit<DatosReporteNormal, 'descripcionAudioUrl'> {
    const permitidos = new Set(['tipo_incidente_id', 'nivel_gravedad_id', 'zona_id', 'latitud', 'longitud', 'descripcion_texto']);
    if (Object.keys(campos).some((campo) => !permitidos.has(campo))) {
        throw new DatosReporteInvalidos('El reporte contiene campos no permitidos');
    }
    const descripcionTexto = campos.descripcion_texto?.trim();
    if (descripcionTexto && descripcionTexto.length > 5000) {
        throw new DatosReporteInvalidos('La descripción escrita complementaria supera 5000 caracteres');
    }
    return {
        tipoIncidenteId: enteroPositivo(campos.tipo_incidente_id, 'tipo_incidente_id'),
        nivelGravedadId: enteroPositivo(campos.nivel_gravedad_id, 'nivel_gravedad_id'),
        ...(campos.zona_id !== undefined ? { zonaId: enteroPositivo(campos.zona_id, 'zona_id') } : {}),
        latitud: coordenada(campos.latitud, 'latitud', -90, 90),
        longitud: coordenada(campos.longitud, 'longitud', -180, 180),
        ...(descripcionTexto ? { descripcionTexto } : {}),
    };
}

export function crearReporteAudio(repositorio: RepositorioCreacionReporte, tokens: VerificadorToken, almacen: AlmacenAudioReporte) {
    return async (token: string, entrada: EntradaReporteAudio): Promise<ReporteCreado> => {
        const identidad = tokens.verificar(token);
        if (!identidad) throw new TokenInvalido();
        const datos = validarCampos(entrada.campos);
        if (!entrada.archivo) throw new DatosReporteInvalidos('Falta archivo_descripcion_audio');
        validarAudioWav(entrada.archivo);
        const referencia = await almacen.guardar(entrada.archivo);
        try {
            return await repositorio.crear(identidad.usuarioId, { ...datos, descripcionAudioUrl: referencia });
        } catch (error) {
            try { await almacen.eliminar(referencia); }
            catch (limpieza) { console.error('No se pudo limpiar el audio de un reporte fallido:', limpieza); }
            throw error;
        }
    };
}

export type CrearReporteAudio = ReturnType<typeof crearReporteAudio>;
