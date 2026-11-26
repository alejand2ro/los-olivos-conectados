export interface UsuarioParaLogin {
    id: number;
    nombre: string;
    rol: string;
    zona_id: number | null;
    contrasena_hash: string;
}

export interface UsuarioSesion {
    id: number;
    nombre: string;
    rol: string;
    zona_id: number | null;
}

export interface RepositorioLogin {
    buscarPorCorreo(correo: string): Promise<UsuarioParaLogin | null>;
}

export interface VerificadorContrasena {
    verificar(contrasena: string, hash: string | null): Promise<boolean>;
}

export interface EmisorToken {
    emitir(usuarioId: number): string;
}

export class CredencialesInvalidas extends Error {
    constructor() {
        super('Credenciales inválidas');
    }
}

export function crearIniciarSesion(
    repositorio: RepositorioLogin,
    contrasenas: VerificadorContrasena,
    tokens: EmisorToken,
) {
    return async (entrada: unknown): Promise<{ token: string; usuario: UsuarioSesion }> => {
        if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
            throw new CredencialesInvalidas();
        }
        const datos = entrada as Record<string, unknown>;
        const correo = typeof datos.correo === 'string' ? datos.correo.trim().toLowerCase() : '';
        const contrasena = datos.contrasena;
        if (!correo || correo.length > 150 || typeof contrasena !== 'string' || !contrasena) {
            throw new CredencialesInvalidas();
        }

        const encontrado = await repositorio.buscarPorCorreo(correo);
        const valida = await contrasenas.verificar(contrasena, encontrado?.contrasena_hash ?? null);
        if (!encontrado || !valida) throw new CredencialesInvalidas();

        const { id, nombre, rol, zona_id } = encontrado;
        return { token: tokens.emitir(id), usuario: { id, nombre, rol, zona_id } };
    };
}

export type IniciarSesion = ReturnType<typeof crearIniciarSesion>;
