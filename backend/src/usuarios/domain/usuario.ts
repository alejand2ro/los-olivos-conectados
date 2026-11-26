export type RolPublico = 'vecino' | 'comerciante';

export interface DatosRegistro {
    nombre: string;
    correo: string;
    contrasena: string;
    telefono: string | null;
    rol: RolPublico;
    zonaId: number;
    modoAccesibilidad: boolean;
}

export interface UsuarioPublico {
    id: number;
    nombre: string;
    correo: string;
    alias_chat: string;
    rol: RolPublico;
    zona_id: number;
}

export interface PerfilUsuario {
    id: number;
    nombre: string;
    correo: string;
    telefono: string | null;
    rol: string;
    zona_id: number | null;
    alias_chat: string | null;
    modo_accesibilidad: boolean;
}
