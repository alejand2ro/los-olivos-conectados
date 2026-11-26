export interface DatosCuentaInterna {
    nombre: string;
    correo: string;
    contrasena: string;
}

export interface UsuarioInternoCreado {
    id: number;
    nombre: string;
    correo: string;
    alias_chat: null;
    rol: 'autoridad' | 'administrador';
    zona_id: null;
}

export class CuentaInternaInvalida extends Error {}
export class CorreoInternoDuplicado extends Error {}
export class PermisoInternoDenegado extends Error {}
export class AdministradorInicialExistente extends Error {}

export function validarCuentaInterna(entrada: unknown): DatosCuentaInterna {
    if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
        throw new CuentaInternaInvalida('El cuerpo debe ser un objeto JSON');
    }
    const datos = entrada as Record<string, unknown>;
    if (Object.keys(datos).some((clave) => !['nombre', 'correo', 'contrasena'].includes(clave))) {
        throw new CuentaInternaInvalida('La cuenta contiene campos no permitidos');
    }
    const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : '';
    const correo = typeof datos.correo === 'string' ? datos.correo.trim().toLowerCase() : '';
    if (!nombre || nombre.length > 150) throw new CuentaInternaInvalida('El nombre admite entre 1 y 150 caracteres');
    if (!correo || correo.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        throw new CuentaInternaInvalida('El correo debe tener un formato válido y hasta 150 caracteres');
    }
    if (typeof datos.contrasena !== 'string' || datos.contrasena.length < 8 || datos.contrasena.length > 128) {
        throw new CuentaInternaInvalida('La contraseña debe tener entre 8 y 128 caracteres');
    }
    return { nombre, correo, contrasena: datos.contrasena };
}
