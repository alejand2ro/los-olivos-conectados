import type { PerfilUsuario } from '../domain/usuario';

export interface RepositorioPerfil {
    buscarPorId(usuarioId: number): Promise<PerfilUsuario | null>;
}

export interface VerificadorToken {
    verificar(token: string): { usuarioId: number } | null;
}

export class TokenInvalido extends Error {}
export class PerfilNoEncontrado extends Error {}

export function crearObtenerPerfil(repositorio: RepositorioPerfil, tokens: VerificadorToken) {
    return async (token: string): Promise<PerfilUsuario> => {
        const identidad = tokens.verificar(token);
        if (!identidad) throw new TokenInvalido();

        const perfil = await repositorio.buscarPorId(identidad.usuarioId);
        if (!perfil) throw new PerfilNoEncontrado();
        return perfil;
    };
}

export type ObtenerPerfil = ReturnType<typeof crearObtenerPerfil>;
