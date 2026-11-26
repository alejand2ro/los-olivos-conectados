import type { DatosRegistro, UsuarioPublico } from '../domain/usuario';

export class ErrorRegistro extends Error {
    constructor(
        message: string,
        readonly tipo: 'datos_invalidos' | 'correo_duplicado' | 'alias_duplicado',
    ) {
        super(message);
    }
}

export interface RepositorioRegistro {
    existeZona(id: number): Promise<boolean>;
    guardar(datos: DatosRegistro, hash: string, alias: string): Promise<UsuarioPublico>;
}

export interface SeguridadRegistro {
    hash(contrasena: string): Promise<string>;
    nuevoAlias(): string;
}

function validarEntrada(entrada: unknown): DatosRegistro {
    if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
        throw new ErrorRegistro('El cuerpo debe ser un objeto JSON', 'datos_invalidos');
    }

    const datos = entrada as Record<string, unknown>;
    if (Object.hasOwn(datos, 'rol_id')) {
        throw new ErrorRegistro('No se permite enviar rol_id', 'datos_invalidos');
    }
    const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : '';
    if (!nombre || nombre.length > 150) {
        throw new ErrorRegistro('El nombre es obligatorio y admite hasta 150 caracteres', 'datos_invalidos');
    }
    const correo = typeof datos.correo === 'string' ? datos.correo.trim().toLowerCase() : '';
    if (!correo || correo.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        throw new ErrorRegistro('El correo debe tener un formato válido y admitir hasta 150 caracteres', 'datos_invalidos');
    }
    if (typeof datos.contrasena !== 'string' || datos.contrasena.length < 8 || datos.contrasena.length > 128) {
        throw new ErrorRegistro('La contraseña debe tener entre 8 y 128 caracteres', 'datos_invalidos');
    }
    if (datos.rol !== 'vecino' && datos.rol !== 'comerciante') {
        throw new ErrorRegistro('El rol público debe ser vecino o comerciante', 'datos_invalidos');
    }
    if (typeof datos.zona_id !== 'number' || !Number.isSafeInteger(datos.zona_id) || datos.zona_id < 1) {
        throw new ErrorRegistro('La zona de residencia es obligatoria', 'datos_invalidos');
    }
    const telefono = datos.telefono === undefined || datos.telefono === null ? null : datos.telefono;
    if (telefono !== null && (typeof telefono !== 'string' || telefono.trim().length > 20)) {
        throw new ErrorRegistro('El teléfono debe ser texto de hasta 20 caracteres', 'datos_invalidos');
    }
    if (datos.modo_accesibilidad !== undefined && typeof datos.modo_accesibilidad !== 'boolean') {
        throw new ErrorRegistro('modo_accesibilidad debe ser booleano', 'datos_invalidos');
    }
    if (datos.consentimiento_privacidad_aceptado !== true || datos.compromiso_sos_aceptado !== true) {
        throw new ErrorRegistro('Debe aceptar la privacidad y el compromiso SOS', 'datos_invalidos');
    }

    return {
        nombre,
        correo,
        contrasena: datos.contrasena,
        telefono: typeof telefono === 'string' ? telefono.trim() || null : null,
        rol: datos.rol,
        zonaId: datos.zona_id,
        modoAccesibilidad: datos.modo_accesibilidad ?? false,
    };
}

export function crearRegistrarUsuario(repositorio: RepositorioRegistro, seguridad: SeguridadRegistro) {
    return async (entrada: unknown): Promise<UsuarioPublico> => {
        const datos = validarEntrada(entrada);
        if (!await repositorio.existeZona(datos.zonaId)) {
            throw new ErrorRegistro('La zona de residencia no existe', 'datos_invalidos');
        }
        const hash = await seguridad.hash(datos.contrasena);
        for (let intento = 0; intento < 5; intento++) {
            try {
                return await repositorio.guardar(datos, hash, seguridad.nuevoAlias());
            } catch (error) {
                if (error instanceof ErrorRegistro && error.tipo === 'alias_duplicado') {
                    if (intento < 4) continue;
                    throw new Error('No se pudo generar un alias único');
                }
                throw error;
            }
        }
        throw new Error('No se pudo generar un alias único');
    };
}

export type RegistrarUsuario = ReturnType<typeof crearRegistrarUsuario>;
