import type { PerfilUsuario } from '../domain/usuario';
import { PerfilNoEncontrado, TokenInvalido, type VerificadorToken } from './obtener-perfil';

export interface CambiosPerfil {
    telefono?: string | null;
    modo_accesibilidad?: boolean;
}

export interface RepositorioActualizacionPerfil {
    actualizar(usuarioId: number, cambios: CambiosPerfil): Promise<PerfilUsuario | null>;
}

export class DatosPerfilInvalidos extends Error {}

function validarCambios(entrada: unknown): CambiosPerfil {
    if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
        throw new DatosPerfilInvalidos('El cuerpo debe ser un objeto JSON');
    }
    const datos = entrada as Record<string, unknown>;
    const claves = Object.keys(datos);
    if (claves.length === 0) {
        throw new DatosPerfilInvalidos('Indique al menos un campo para actualizar');
    }
    if (claves.some((clave) => clave !== 'telefono' && clave !== 'modo_accesibilidad')) {
        throw new DatosPerfilInvalidos('El perfil solo permite actualizar telefono y modo_accesibilidad');
    }

    const cambios: CambiosPerfil = {};
    if (Object.hasOwn(datos, 'telefono')) {
        if (datos.telefono !== null && typeof datos.telefono !== 'string') {
            throw new DatosPerfilInvalidos('El teléfono debe ser texto o null');
        }
        const telefono = typeof datos.telefono === 'string' ? datos.telefono.trim() : null;
        if (telefono !== null && telefono.length > 20) {
            throw new DatosPerfilInvalidos('El teléfono admite hasta 20 caracteres');
        }
        cambios.telefono = telefono || null;
    }
    if (Object.hasOwn(datos, 'modo_accesibilidad')) {
        if (typeof datos.modo_accesibilidad !== 'boolean') {
            throw new DatosPerfilInvalidos('modo_accesibilidad debe ser booleano');
        }
        cambios.modo_accesibilidad = datos.modo_accesibilidad;
    }
    return cambios;
}

export function crearActualizarPerfil(repositorio: RepositorioActualizacionPerfil, tokens: VerificadorToken) {
    return async (token: string, entrada: unknown): Promise<PerfilUsuario> => {
        const identidad = tokens.verificar(token);
        if (!identidad) throw new TokenInvalido();

        const cambios = validarCambios(entrada);
        const perfil = await repositorio.actualizar(identidad.usuarioId, cambios);
        if (!perfil) throw new PerfilNoEncontrado();
        return perfil;
    };
}

export type ActualizarPerfil = ReturnType<typeof crearActualizarPerfil>;
