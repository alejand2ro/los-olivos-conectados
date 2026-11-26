import { TokenInvalido, type VerificadorToken } from './obtener-perfil';
import type { SeguridadRegistro } from './registrar-usuario';
import { PermisoInternoDenegado, validarCuentaInterna, type DatosCuentaInterna, type UsuarioInternoCreado } from '../domain/cuenta-interna';

export interface RepositorioAutoridad {
    esAdministrador(usuarioId: number): Promise<boolean>;
    crear(administradorId: number, datos: DatosCuentaInterna, hash: string): Promise<UsuarioInternoCreado>;
}

export function crearAltaAutoridad(tokens: VerificadorToken, repositorio: RepositorioAutoridad, seguridad: Pick<SeguridadRegistro, 'hash'>) {
    return async (token: string, entrada: unknown): Promise<UsuarioInternoCreado> => {
        const identidad = tokens.verificar(token);
        if (!identidad) throw new TokenInvalido();
        if (!await repositorio.esAdministrador(identidad.usuarioId)) throw new PermisoInternoDenegado();
        const datos = validarCuentaInterna(entrada);
        const hash = await seguridad.hash(datos.contrasena);
        return repositorio.crear(identidad.usuarioId, datos, hash);
    };
}

export type AltaAutoridad = ReturnType<typeof crearAltaAutoridad>;
