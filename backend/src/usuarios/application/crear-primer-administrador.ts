import { validarCuentaInterna, type DatosCuentaInterna, type UsuarioInternoCreado } from '../domain/cuenta-interna';
import type { SeguridadRegistro } from './registrar-usuario';

export interface RepositorioPrimerAdministrador {
    crear(datos: DatosCuentaInterna, hash: string): Promise<UsuarioInternoCreado>;
}

export function crearPrimerAdministrador(repositorio: RepositorioPrimerAdministrador, seguridad: Pick<SeguridadRegistro, 'hash'>) {
    return async (entrada: unknown): Promise<UsuarioInternoCreado> => {
        const datos = validarCuentaInterna(entrada);
        const hash = await seguridad.hash(datos.contrasena);
        return repositorio.crear(datos, hash);
    };
}
